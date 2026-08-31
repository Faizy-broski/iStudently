import { supabase } from '../../config/supabase'
import { CallerContext } from './types'
import { getGuardianStudentIds, getStudentSectionIds } from './access-policy.service'

/**
 * The wall feed (spec §16.2): strictly reverse-chronological, pinned first,
 * no ranking algorithm. Cursor-paginated (offset degrades past ~10k posts,
 * per spec §13). Eager-loads media+author in one batch and resolves
 * reaction/comment counts via two bulk queries rather than per-post
 * lookups — the spec's own explicit N+1 warning (§23).
 *
 * A post's mere presence in a viewer's feed is itself gated by audience
 * matching below (never showing a 'classes'/'students'-targeted post's
 * title/text to someone outside that audience) — but the actual photo BYTES
 * are independently re-gated by GET /fina/media/:id/:variant regardless,
 * via consent-gate.service.ts. That per-image gate is why a post CAN safely
 * appear here without a second per-viewer effectiveScope check on its
 * media: assertPublishable() already guaranteed at publish time that every
 * attached media's scope clears the post's own audience-implied threshold,
 * so anyone who passes the audience filter below is, by construction,
 * within that threshold too.
 */

// super_admin excluded — spec §12: SYSADMIN's view scope is "operational
// only", not the wall/feed content this list grants full staff-level
// visibility into (every audience_type, not just their own matching one).
export const STAFF_VIEW_ROLES = ['teacher', 'admin', 'media_officer']
const PAGE_SIZE = 20

export interface WallFilters {
  cursor?: string
  type?: string
  q?: string
}

// Escapes a user search string for safe embedding in a PostgREST `.or()`
// filter value: first the SQL ILIKE meta-characters (so a search for e.g.
// "50%" or "a_b" matches literally instead of acting as a wildcard), then
// the backslash/quote characters PostgREST itself requires quoting for
// (its filter grammar treats `,` `(` `)` as syntax, so the whole value is
// wrapped in double quotes).
function ilikeOrFilter(columns: string[], q: string): string {
  const likeEscaped = q.replace(/[\\%_]/g, '\\$&')
  const pattern = `%${likeEscaped}%`
  const quoted = `"${pattern.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
  return columns.map((col) => `${col}.ilike.${quoted}`).join(',')
}

export interface AudienceContext {
  ownStudentIds: string[]
  ownSectionIds: string[]
  myGroupIds: Set<string>
}

async function getMyGroupIds(profileId: string): Promise<Set<string>> {
  const { data } = await supabase.from('fina_group_members').select('group_id').eq('user_id', profileId)
  return new Set((data || []).map((m) => m.group_id as string))
}

export async function getViewerAudienceContext(caller: CallerContext): Promise<AudienceContext> {
  const myGroupIds = await getMyGroupIds(caller.profileId)
  if (caller.role === 'parent') {
    const studentIds = await getGuardianStudentIds(caller.profileId)
    const sectionsById = await getStudentSectionIds(studentIds)
    return { ownStudentIds: studentIds, ownSectionIds: [...new Set([...sectionsById.values()].filter(Boolean) as string[])], myGroupIds }
  }
  if (caller.role === 'student') {
    const { data } = await supabase.from('students').select('id, section_id').eq('profile_id', caller.profileId).maybeSingle()
    return { ownStudentIds: data ? [data.id as string] : [], ownSectionIds: data?.section_id ? [data.section_id as string] : [], myGroupIds }
  }
  return { ownStudentIds: [], ownSectionIds: [], myGroupIds }
}

export function matchesAudience(post: { audience_type: string; audience_ref: any }, ctx: AudienceContext): boolean {
  if (post.audience_type === 'school') return true
  if (post.audience_type === 'classes') {
    const sectionIds: string[] = post.audience_ref?.section_ids || []
    return sectionIds.some((id) => ctx.ownSectionIds.includes(id))
  }
  if (post.audience_type === 'students') {
    const studentIds: string[] = post.audience_ref?.student_ids || []
    return studentIds.some((id) => ctx.ownStudentIds.includes(id))
  }
  if (post.audience_type === 'group') {
    const groupId: string | undefined = post.audience_ref?.group_id
    return !!groupId && ctx.myGroupIds.has(groupId)
  }
  return false
}

function mapMedia(row: any) {
  // Never surface storage_key/variants raw keys to the client — only id/kind,
  // which the client resolves to real bytes via the gated /:variant endpoint.
  return { id: row.media?.id, kind: row.media?.kind }
}

function mapPost(post: any, reactionCounts: Map<string, number>, myReaction: Map<string, string>, commentCounts: Map<string, number>) {
  const { audience_ref, ...rest } = post
  return {
    ...rest,
    media: (post.media || []).sort((a: any, b: any) => a.sort - b.sort).map(mapMedia),
    reactionsCount: reactionCounts.get(post.id) ?? 0,
    myReaction: myReaction.get(post.id) ?? null,
    commentsCount: commentCounts.get(post.id) ?? 0,
  }
}

export async function listWall(caller: CallerContext, filters: WallFilters) {
  // spec §12: SYSADMIN's view scope is "operational only" — the wall itself
  // is content, so this is an explicit, unconditional denial rather than
  // relying on the audience-matching fallthrough below (a 'school'-audience
  // post — the common case — matches everyone unconditionally).
  if (caller.role === 'super_admin') throw new Error('Access denied')
  const isStaffViewer = STAFF_VIEW_ROLES.includes(caller.role)
  const ctx = await getViewerAudienceContext(caller)

  let query = supabase
    .from('fina_posts')
    .select('*, author:profiles!fina_posts_author_id_fkey(first_name, last_name), media:fina_post_media(sort, media:fina_media(id, kind))')
    .eq('school_id', caller.schoolId)
    .eq('state', 'published')
    .is('deleted_at', null)
    .order('is_pinned', { ascending: false })
    .order('published_at', { ascending: false })
    .limit(PAGE_SIZE + 1)

  if (filters.type) query = query.eq('type', filters.type)
  if (filters.cursor) query = query.lt('published_at', filters.cursor)
  if (filters.q?.trim()) query = query.or(ilikeOrFilter(['title', 'body'], filters.q.trim()))

  const { data, error } = await query
  if (error) throw new Error(`Failed to load wall: ${error.message}`)

  const rows = data || []
  const hasMore = rows.length > PAGE_SIZE
  const page = rows.slice(0, PAGE_SIZE)
  const visible = isStaffViewer ? page : page.filter((post) => matchesAudience(post, ctx))

  const postIds = visible.map((p) => p.id)
  const [{ data: reactions }, { data: comments }] = await Promise.all([
    postIds.length ? supabase.from('fina_reactions').select('post_id, user_id, kind').in('post_id', postIds) : Promise.resolve({ data: [] as any[] }),
    postIds.length ? supabase.from('fina_comments').select('post_id').eq('state', 'approved').in('post_id', postIds) : Promise.resolve({ data: [] as any[] }),
  ])

  const reactionCounts = new Map<string, number>()
  const myReaction = new Map<string, string>()
  for (const r of reactions || []) {
    reactionCounts.set(r.post_id, (reactionCounts.get(r.post_id) ?? 0) + 1)
    if (r.user_id === caller.profileId) myReaction.set(r.post_id, r.kind)
  }
  const commentCounts = new Map<string, number>()
  for (const c of comments || []) {
    commentCounts.set(c.post_id, (commentCounts.get(c.post_id) ?? 0) + 1)
  }

  const mapped = visible.map((post) => mapPost(post, reactionCounts, myReaction, commentCounts))
  const nextCursor = hasMore && page.length > 0 ? page[page.length - 1].published_at : null

  return { posts: mapped, nextCursor }
}

export async function getPostDetail(caller: CallerContext, postId: string) {
  if (caller.role === 'super_admin') throw new Error('Access denied') // spec §12: SYSADMIN has zero content access

  const { data: post, error } = await supabase
    .from('fina_posts')
    .select('*, author:profiles!fina_posts_author_id_fkey(first_name, last_name), media:fina_post_media(sort, media:fina_media(id, kind))')
    .eq('id', postId)
    .eq('state', 'published')
    .is('deleted_at', null)
    .maybeSingle()
  if (error || !post) throw new Error('Post not found')

  if (post.school_id !== caller.schoolId) throw new Error('Access denied')

  if (!STAFF_VIEW_ROLES.includes(caller.role)) {
    const ctx = await getViewerAudienceContext(caller)
    if (!matchesAudience(post, ctx)) throw new Error('Access denied')
  }

  const [{ data: reactions }, { data: comments }] = await Promise.all([
    supabase.from('fina_reactions').select('post_id, user_id, kind').eq('post_id', postId),
    supabase.from('fina_comments').select('post_id').eq('post_id', postId).eq('state', 'approved'),
  ])
  const reactionCounts = new Map<string, number>([[postId, (reactions || []).length]])
  const myReaction = new Map<string, string>()
  const mine = (reactions || []).find((r) => r.user_id === caller.profileId)
  if (mine) myReaction.set(postId, mine.kind)
  const commentCounts = new Map<string, number>([[postId, (comments || []).length]])

  return mapPost(post, reactionCounts, myReaction, commentCounts)
}
