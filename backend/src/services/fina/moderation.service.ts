import { supabase } from '../../config/supabase'
import { CallerContext } from './types'
import { logAuditFromCaller } from './audit-logger.service'
import { runAutoFilter } from './auto-filter.service'
import { assertPublishable } from './consent-gate.service'
import { notifyPublishBlockedToOfficers, notifyNewPost } from './notifications.service'
import { getGuardianProfileIdsForStudent } from './access-policy.service'

/**
 * The post moderation state machine (spec §11):
 *   draft -> pending_auto -> [auto-filter] -> pending_review -> [officer] ->
 *   pending_approval -> [principal] -> published
 * with blocked/rejected branches looping back to draft on edit, and a
 * principal-only emergency path (draft -> published directly, is_emergency,
 * mandatory post-hoc review). Approval cannot be disabled by any school
 * setting — there is no toggle for it anywhere in this schema, which is
 * itself the enforcement (absence, not a flag defaulting true).
 */

// super_admin excluded from every role below — spec §12: SYSADMIN has no
// Publish/Approve access to Al-Fina' content.
const COMPOSE_ROLES = ['teacher', 'admin', 'media_officer']
const PRINCIPAL_ROLES = ['admin']
const REVIEWER_ROLES = ['media_officer']
const NO_TYPE_FREEFORM = ['activity', 'announcement', 'achievement', 'congratulation', 'urgent', 'resource', 'poll', 'reminder']
// fina_posts has FOUR foreign keys to profiles (author_id, approved_by,
// rejected_by, reviewed_by) — PostgREST can't infer which one `author:
// profiles(...)` means without the explicit `!constraint_name` hint below;
// omitting it makes every query using this select fail with PGRST201
// ("more than one relationship was found"), including on zero-row results
// (it's a query-parse-time error, not a row-level one).
const POST_LIST_SELECT = '*, author:profiles!fina_posts_author_id_fkey(first_name, last_name), media:fina_post_media(sort, media:fina_media(id, kind))'

export interface CreatePostInput {
  type: string
  title?: string
  body?: string
  audience_type?: 'school' | 'classes' | 'students'
  audience_ref?: Record<string, unknown>
  type_data?: Record<string, unknown>
  is_emergency?: boolean
  comments_enabled?: boolean
  media_ids?: string[]
}

async function loadPostRow(postId: string) {
  const { data, error } = await supabase.from('fina_posts').select('*').eq('id', postId).maybeSingle()
  if (error || !data) throw new Error('Post not found')
  return data
}

async function loadOwnedPost(caller: CallerContext, postId: string) {
  if (caller.role === 'super_admin') throw new Error('Access denied') // spec §12: SYSADMIN has zero content access
  const post = await loadPostRow(postId)
  if (post.school_id !== caller.schoolId) {
    throw new Error('Access denied: post belongs to a different school')
  }
  const isAuthor = post.author_id === caller.profileId
  const isPrincipal = PRINCIPAL_ROLES.includes(caller.role)
  if (!isAuthor && !isPrincipal) throw new Error('Access denied: not the author of this post')
  return post
}

/** Resolves who should be notified a post just went live, matching the
 * post's own audience (spec §14 "new post involving the ward"). Never
 * awaited by the publish path itself — see each call site's `.catch()`. */
async function resolveNotificationRecipients(post: { school_id: string; audience_type: string; audience_ref: any }): Promise<string[]> {
  if (post.audience_type === 'students') {
    const studentIds: string[] = post.audience_ref?.student_ids || []
    const lists = await Promise.all(studentIds.map((id) => getGuardianProfileIdsForStudent(id)))
    return [...new Set(lists.flat())]
  }
  if (post.audience_type === 'classes') {
    const sectionIds: string[] = post.audience_ref?.section_ids || []
    if (sectionIds.length === 0) return []
    const { data: students } = await supabase.from('students').select('id').in('section_id', sectionIds)
    const lists = await Promise.all((students || []).map((s) => getGuardianProfileIdsForStudent(s.id)))
    return [...new Set(lists.flat())]
  }
  // 'school' (and 'group', not yet modeled — treated the same as school-wide
  // for notification purposes, matching consent-gate's own Phase 4 stand-in)
  const { data: parents } = await supabase.from('profiles').select('id').eq('school_id', post.school_id).eq('role', 'parent')
  return (parents || []).map((p) => p.id)
}

function fireNewPostNotification(post: { id: string; school_id: string; audience_type: string; audience_ref: any; type: string }) {
  resolveNotificationRecipients(post)
    .then((ids) => notifyNewPost(post.school_id, ids, post.type))
    .catch((err) => console.error('Failed to fan out new-post notifications:', err))
}

async function attachMedia(schoolId: string, postId: string, mediaIds: string[]) {
  if (mediaIds.length === 0) return
  const { data: mediaRows, error } = await supabase.from('fina_media').select('id, school_id, processing_state').in('id', mediaIds)
  if (error) throw new Error(`Failed to verify attached media: ${error.message}`)
  const found = new Map((mediaRows || []).map((m) => [m.id, m]))
  for (const id of mediaIds) {
    const m = found.get(id)
    if (!m) throw new Error('One or more attached media items were not found')
    if (m.school_id !== schoolId) throw new Error('Access denied: attached media belongs to a different school')
    if (m.processing_state !== 'ready') throw new Error('One or more attached photos/videos are still processing — wait for tagging and processing to finish')
  }
  const rows = mediaIds.map((mediaId, i) => ({ post_id: postId, media_id: mediaId, sort: i }))
  const { error: insertError } = await supabase.from('fina_post_media').insert(rows)
  if (insertError) throw new Error(`Failed to attach media: ${insertError.message}`)
}

export async function createPost(caller: CallerContext, input: CreatePostInput) {
  if (!COMPOSE_ROLES.includes(caller.role)) throw new Error('Access denied: staff access required')
  if (!NO_TYPE_FREEFORM.includes(input.type)) throw new Error('Invalid post type')
  if (input.type === 'urgent' && !PRINCIPAL_ROLES.includes(caller.role)) {
    throw new Error('Access denied: only the principal may create an urgent post')
  }

  // achievement posts force comments off regardless of caller input, per spec §17.
  const commentsEnabled = input.type === 'achievement' ? false : input.comments_enabled ?? true

  const { data: created, error } = await supabase
    .from('fina_posts')
    .insert({
      school_id: caller.schoolId,
      author_id: caller.profileId,
      type: input.type,
      title: input.title ?? null,
      body: input.body ?? null,
      audience_type: input.audience_type ?? 'school',
      audience_ref: input.audience_ref ?? {},
      type_data: input.type_data ?? {},
      comments_enabled: commentsEnabled,
      is_emergency: input.type === 'urgent' ? !!input.is_emergency : false,
    })
    .select()
    .single()

  if (error || !created) throw new Error(`Failed to create post: ${error?.message}`)

  if (input.media_ids?.length) {
    try {
      await attachMedia(caller.schoolId, created.id, input.media_ids)
    } catch (attachError) {
      await supabase.from('fina_posts').delete().eq('id', created.id) // draft never submitted — safe to hard-delete, not yet subject to the soft-delete-only rule
      throw attachError
    }
  }

  await logAuditFromCaller(caller, 'post.created', { subjectType: 'post', subjectId: created.id, meta: { type: input.type } })
  return created
}

export async function updatePost(caller: CallerContext, postId: string, updates: Partial<CreatePostInput>) {
  const post = await loadOwnedPost(caller, postId)
  if (!['draft', 'rejected', 'blocked'].includes(post.state)) {
    throw new Error('Cannot edit a post that is not in draft, rejected, or blocked state')
  }

  const patch: Record<string, unknown> = { state: 'draft', rejected_reason: null, blocked_reason: null }
  if (updates.title !== undefined) patch.title = updates.title
  if (updates.body !== undefined) patch.body = updates.body
  if (updates.audience_type !== undefined) patch.audience_type = updates.audience_type
  if (updates.audience_ref !== undefined) patch.audience_ref = updates.audience_ref
  if (updates.type_data !== undefined) patch.type_data = updates.type_data
  if (updates.comments_enabled !== undefined) patch.comments_enabled = post.type === 'achievement' ? false : updates.comments_enabled

  const { data: updated, error } = await supabase.from('fina_posts').update(patch).eq('id', postId).select().single()
  if (error || !updated) throw new Error(`Failed to update post: ${error?.message}`)

  if (updates.media_ids) {
    const { error: clearError } = await supabase.from('fina_post_media').delete().eq('post_id', postId)
    if (clearError) throw new Error(`Failed to update attached media: ${clearError.message}`)
    await attachMedia(caller.schoolId, postId, updates.media_ids)
  }

  return updated
}

export async function submitPost(caller: CallerContext, postId: string) {
  const post = await loadOwnedPost(caller, postId)
  if (post.state !== 'draft') throw new Error('Only a draft post can be submitted')

  const { data: claimed, error: claimError } = await supabase
    .from('fina_posts')
    .update({ state: 'pending_auto' })
    .eq('id', postId)
    .eq('state', 'draft')
    .select()
    .single()
  if (claimError || !claimed) throw new Error('Failed to submit — this post may have already changed')

  const filterResult = await runAutoFilter({ id: claimed.id, title: claimed.title, body: claimed.body })
  if (!filterResult.passed) {
    await supabase.from('fina_posts').update({ state: 'blocked', blocked_reason: filterResult.reason }).eq('id', postId)
    await logAuditFromCaller(caller, 'post.blocked', { subjectType: 'post', subjectId: postId, meta: { reason: filterResult.reason, commercialSuspected: filterResult.commercialSuspected } })
    notifyPublishBlockedToOfficers(caller.schoolId, postId, filterResult.reason || 'blocked').catch((err) =>
      console.error('Failed to notify officers of blocked publish:', err)
    )
    throw new Error(filterResult.reason || 'This content cannot be published.')
  }

  if (claimed.is_emergency && PRINCIPAL_ROLES.includes(caller.role)) {
    const { data: published, error: publishError } = await supabase
      .from('fina_posts')
      .update({ state: 'published', published_at: new Date().toISOString(), approved_by: caller.profileId, needs_post_hoc_review: true })
      .eq('id', postId)
      .select()
      .single()
    if (publishError || !published) throw new Error('Failed to publish emergency post')
    await logAuditFromCaller(caller, 'post.published_emergency', { subjectType: 'post', subjectId: postId })
    fireNewPostNotification(published)
    return published
  }

  // A principal's OWN post publishes directly once it clears the auto-filter
  // — spec §12's access table marks PRINCIPAL's publish column "direct", not
  // "after approval": the review/approval queues exist so the principal can
  // approve a TEACHER's work, not so they approve their own. The auto-filter
  // (including the consent hard-stop, already run above) is never skipped.
  if (PRINCIPAL_ROLES.includes(caller.role) && claimed.author_id === caller.profileId) {
    const { data: published, error: publishError } = await supabase
      .from('fina_posts')
      .update({ state: 'published', published_at: new Date().toISOString(), approved_by: caller.profileId })
      .eq('id', postId)
      .select()
      .single()
    if (publishError || !published) throw new Error('Failed to publish')
    await logAuditFromCaller(caller, 'post.published', { subjectType: 'post', subjectId: postId, meta: { directByPrincipal: true } })
    fireNewPostNotification(published)
    return published
  }

  const { data: forReview, error: reviewError } = await supabase
    .from('fina_posts')
    .update({ state: 'pending_review' })
    .eq('id', postId)
    .select()
    .single()
  if (reviewError || !forReview) throw new Error('Failed to submit for review')
  await logAuditFromCaller(caller, 'post.submitted', { subjectType: 'post', subjectId: postId })
  return forReview
}

export async function reviewPost(caller: CallerContext, postId: string, decision: 'approve' | 'reject', reason?: string) {
  if (!REVIEWER_ROLES.includes(caller.role)) throw new Error('Access denied: media officer access required')

  if (decision === 'approve') {
    const { data, error } = await supabase
      .from('fina_posts')
      .update({ state: 'pending_approval', reviewed_by: caller.profileId, reviewed_at: new Date().toISOString() })
      .eq('id', postId)
      .eq('state', 'pending_review')
      .select()
      .single()
    if (error || !data) throw new Error('Failed to review — this post may have already changed')
    await logAuditFromCaller(caller, 'post.reviewed_approved', { subjectType: 'post', subjectId: postId })
    return data
  }

  if (!reason) throw new Error('A rejection reason is required')
  const { data, error } = await supabase
    .from('fina_posts')
    .update({
      state: 'rejected',
      reviewed_by: caller.profileId,
      reviewed_at: new Date().toISOString(),
      rejected_by: caller.profileId,
      rejected_reason: reason,
    })
    .eq('id', postId)
    .eq('state', 'pending_review')
    .select()
    .single()
  if (error || !data) throw new Error('Failed to review — this post may have already changed')
  await logAuditFromCaller(caller, 'post.reviewed_rejected', { subjectType: 'post', subjectId: postId, meta: { reason } })
  return data
}

export async function approvePost(caller: CallerContext, postId: string) {
  if (!PRINCIPAL_ROLES.includes(caller.role)) throw new Error('Access denied: principal access required')
  const post = await loadPostRow(postId)
  if (post.state !== 'pending_approval') throw new Error('Post is not awaiting approval')

  await assertPublishable(postId) // the hard stop, re-checked right here — never trusted from submission time alone

  const { data, error } = await supabase
    .from('fina_posts')
    .update({ state: 'published', published_at: new Date().toISOString(), approved_by: caller.profileId })
    .eq('id', postId)
    .eq('state', 'pending_approval')
    .select()
    .single()
  if (error || !data) throw new Error('Failed to publish — this post may have already changed')
  await logAuditFromCaller(caller, 'post.published', { subjectType: 'post', subjectId: postId })
  fireNewPostNotification(data)
  return data
}

export async function rejectApproval(caller: CallerContext, postId: string, reason: string) {
  if (!PRINCIPAL_ROLES.includes(caller.role)) throw new Error('Access denied: principal access required')
  if (!reason) throw new Error('A rejection reason is required')

  const { data, error } = await supabase
    .from('fina_posts')
    .update({ state: 'rejected', rejected_by: caller.profileId, rejected_reason: reason })
    .eq('id', postId)
    .eq('state', 'pending_approval')
    .select()
    .single()
  if (error || !data) throw new Error('Failed to reject — this post may have already changed')
  await logAuditFromCaller(caller, 'post.approval_rejected', { subjectType: 'post', subjectId: postId, meta: { reason } })
  return data
}

export async function acknowledgePostHocReview(caller: CallerContext, postId: string) {
  if (!REVIEWER_ROLES.includes(caller.role) && !PRINCIPAL_ROLES.includes(caller.role)) throw new Error('Access denied')
  const { data, error } = await supabase
    .from('fina_posts')
    .update({ needs_post_hoc_review: false, reviewed_by: caller.profileId, reviewed_at: new Date().toISOString() })
    .eq('id', postId)
    .eq('needs_post_hoc_review', true)
    .select()
    .single()
  if (error || !data) throw new Error('Failed to acknowledge — it may have already been acknowledged')
  await logAuditFromCaller(caller, 'post.post_hoc_reviewed', { subjectType: 'post', subjectId: postId })
  return data
}

export async function pinPost(caller: CallerContext, postId: string, pinned: boolean) {
  if (!PRINCIPAL_ROLES.includes(caller.role)) throw new Error('Access denied: principal access required')
  const { data, error } = await supabase
    .from('fina_posts')
    .update({ is_pinned: pinned })
    .eq('id', postId)
    .eq('state', 'published')
    .select()
    .single()
  if (error || !data) throw new Error('Post not found or not published')
  return data
}

export async function deletePost(caller: CallerContext, postId: string) {
  if (caller.role === 'super_admin') throw new Error('Access denied') // spec §12: SYSADMIN has zero content access
  const post = await loadPostRow(postId)
  if (post.school_id !== caller.schoolId) throw new Error('Access denied')

  const isAuthor = post.author_id === caller.profileId
  const isPrincipal = PRINCIPAL_ROLES.includes(caller.role)
  if (post.state === 'published') {
    if (!isPrincipal) throw new Error('Access denied: only an administrator can remove a published post')
  } else if (!isAuthor && !isPrincipal) {
    throw new Error('Access denied')
  }

  const { error } = await supabase.from('fina_posts').update({ deleted_at: new Date().toISOString() }).eq('id', postId)
  if (error) throw new Error(`Failed to delete post: ${error.message}`)
  await logAuditFromCaller(caller, 'post.deleted', { subjectType: 'post', subjectId: postId })
}

export async function listMyPosts(caller: CallerContext) {
  if (!COMPOSE_ROLES.includes(caller.role)) throw new Error('Access denied: staff access required')
  const { data, error } = await supabase
    .from('fina_posts')
    .select(POST_LIST_SELECT)
    .eq('author_id', caller.profileId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
  if (error) throw new Error(`Failed to load posts: ${error.message}`)
  return data || []
}

export async function listReviewQueue(caller: CallerContext) {
  if (!REVIEWER_ROLES.includes(caller.role)) throw new Error('Access denied: media officer access required')
  const { data, error } = await supabase
    .from('fina_posts')
    .select(POST_LIST_SELECT)
    .eq('school_id', caller.schoolId)
    .eq('state', 'pending_review')
    .order('created_at', { ascending: true })
  if (error) throw new Error(`Failed to load review queue: ${error.message}`)
  return data || []
}

export async function listApprovalQueue(caller: CallerContext) {
  if (!PRINCIPAL_ROLES.includes(caller.role)) throw new Error('Access denied: principal access required')
  const { data, error } = await supabase
    .from('fina_posts')
    .select(POST_LIST_SELECT)
    .eq('school_id', caller.schoolId)
    .in('state', ['pending_approval'])
    .order('created_at', { ascending: true })
  if (error) throw new Error(`Failed to load approval queue: ${error.message}`)
  return data || []
}

export async function listPostHocReviewQueue(caller: CallerContext) {
  if (!REVIEWER_ROLES.includes(caller.role) && !PRINCIPAL_ROLES.includes(caller.role)) throw new Error('Access denied')
  const { data, error } = await supabase
    .from('fina_posts')
    .select(POST_LIST_SELECT)
    .eq('school_id', caller.schoolId)
    .eq('needs_post_hoc_review', true)
    .order('published_at', { ascending: true })
  if (error) throw new Error(`Failed to load post-hoc review queue: ${error.message}`)
  return data || []
}
