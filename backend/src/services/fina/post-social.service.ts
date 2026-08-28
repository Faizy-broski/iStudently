import { supabase } from '../../config/supabase'
import { CallerContext } from './types'
import { logAuditFromCaller } from './audit-logger.service'

/**
 * Reactions and comments on published posts (spec §7.5, §12). Comment
 * moderation follows the access table: TEACHER/ADMIN/MEDIA_OFFICER comments
 * are auto-approved; GUARDIAN and STUDENT comments start 'pending' — see
 * 244_create_fina_reactions_comments.sql's header for why STUDENT is folded
 * into the same "moderated" bucket as GUARDIAN in this build.
 */

// super_admin excluded from both — spec §12: SYSADMIN has zero
// Comment/content access to Al-Fina'.
const AUTO_APPROVE_ROLES = ['teacher', 'admin', 'media_officer']
const MODERATOR_ROLES = ['admin', 'media_officer']

async function assertPublishedAndVisible(caller: CallerContext, postId: string) {
  if (caller.role === 'super_admin') throw new Error('Access denied') // spec §12: SYSADMIN has zero content access
  const { data: post, error } = await supabase
    .from('fina_posts')
    .select('id, school_id, author_id, comments_enabled, state')
    .eq('id', postId)
    .maybeSingle()
  if (error || !post) throw new Error('Post not found')
  if (post.state !== 'published') throw new Error('This post is not currently published')
  if (post.school_id !== caller.schoolId) throw new Error('Access denied')
  return post
}

export async function setReaction(caller: CallerContext, postId: string, kind: string) {
  await assertPublishedAndVisible(caller, postId)
  const { data, error } = await supabase
    .from('fina_reactions')
    .upsert({ post_id: postId, user_id: caller.profileId, kind }, { onConflict: 'post_id,user_id' })
    .select()
    .single()
  if (error) throw new Error(`Failed to react: ${error.message}`)
  return data
}

export async function removeReaction(caller: CallerContext, postId: string) {
  const { error } = await supabase.from('fina_reactions').delete().eq('post_id', postId).eq('user_id', caller.profileId)
  if (error) throw new Error(`Failed to remove reaction: ${error.message}`)
}

export async function addComment(caller: CallerContext, postId: string, body: string) {
  if (!body?.trim()) throw new Error('Comment body is required')
  const post = await assertPublishedAndVisible(caller, postId)
  if (!post.comments_enabled) throw new Error('Comments are disabled on this post')

  const state = AUTO_APPROVE_ROLES.includes(caller.role) ? 'approved' : 'pending'
  const { data, error } = await supabase
    .from('fina_comments')
    .insert({ post_id: postId, author_id: caller.profileId, body: body.trim(), state })
    .select()
    .single()
  if (error) throw new Error(`Failed to add comment: ${error.message}`)

  await logAuditFromCaller(caller, 'comment.created', { subjectType: 'comment', subjectId: data.id, meta: { postId, state } })
  return data
}

export async function listComments(caller: CallerContext, postId: string) {
  await assertPublishedAndVisible(caller, postId)
  const { data, error } = await supabase
    .from('fina_comments')
    // fina_comments has two FKs to profiles (author_id, reviewed_by) — the
    // explicit !constraint hint is required or PostgREST rejects the query
    // as ambiguous (PGRST201), same issue fixed in moderation.service.ts.
    .select('*, author:profiles!fina_comments_author_id_fkey(first_name, last_name, role)')
    .eq('post_id', postId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
  if (error) throw new Error(`Failed to load comments: ${error.message}`)

  const canModerate = MODERATOR_ROLES.includes(caller.role)
  return (data || []).filter((c) => c.state === 'approved' || c.author_id === caller.profileId || canModerate)
}

export async function moderateComment(caller: CallerContext, commentId: string, decision: 'approve' | 'reject') {
  const { data: comment, error: loadError } = await supabase
    .from('fina_comments')
    .select('id, post_id, state')
    .eq('id', commentId)
    .maybeSingle()
  if (loadError || !comment) throw new Error('Comment not found')

  const { data: post } = await supabase.from('fina_posts').select('school_id, author_id').eq('id', comment.post_id).maybeSingle()
  const isPostAuthor = post?.author_id === caller.profileId
  if (!MODERATOR_ROLES.includes(caller.role) && !isPostAuthor) throw new Error('Access denied')
  if (post && post.school_id !== caller.schoolId) throw new Error('Access denied')

  if (comment.state !== 'pending') throw new Error('This comment has already been reviewed')

  const { data, error } = await supabase
    .from('fina_comments')
    .update({ state: decision === 'approve' ? 'approved' : 'rejected', reviewed_by: caller.profileId, reviewed_at: new Date().toISOString() })
    .eq('id', commentId)
    .eq('state', 'pending')
    .select()
    .single()
  if (error || !data) throw new Error('Failed to moderate — it may have already changed')
  return data
}
