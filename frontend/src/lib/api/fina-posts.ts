import { getAuthToken } from './schools'
import { handleSessionExpiry } from '@/context/AuthContext'
import { API_URL } from '@/config/api'
import { getImpersonationHeaders } from './abortable-fetch'
import { withCampusParam } from './fina-campus'

interface ApiResponse<T = unknown> {
  data: T | null
  error: string | null
}

export type PostType = 'activity' | 'announcement' | 'achievement' | 'congratulation' | 'urgent' | 'resource' | 'poll' | 'reminder'
export type PostState = 'draft' | 'pending_auto' | 'pending_review' | 'pending_approval' | 'published' | 'blocked' | 'rejected' | 'restricted' | 'archived'
export type AudienceType = 'school' | 'classes' | 'students'

export interface FinaPostMedia {
  id: string
  kind: 'image' | 'video'
}

export interface FinaPost {
  id: string
  school_id: string
  author_id: string
  type: PostType
  title: string | null
  body: string | null
  audience_type: AudienceType
  audience_ref: Record<string, any>
  type_data: Record<string, any>
  state: PostState
  is_pinned: boolean
  is_emergency: boolean
  needs_post_hoc_review: boolean
  comments_enabled: boolean
  published_at: string | null
  created_at: string
  rejected_reason: string | null
  blocked_reason: string | null
  author?: { first_name: string | null; last_name: string | null } | null
  media: FinaPostMedia[]
  reactionsCount: number
  myReaction: string | null
  /** Whether the viewer's own reaction (if any) was a 3x golden super-reaction. */
  myReactionIsSuper: boolean
  commentsCount: number
  /** Positive & Skill-Based Reaction Engine — "Wall Spotlight" badge (5+ academic_skill reactions). */
  isHonorRoll: boolean
}

export type ReactionKind = 'thumbs_up' | 'clap' | 'bright_idea' | 'star' | 'thinker' | 'artistic' | 'teamwork' | 'bookworm'

export interface ReactionActionResult {
  action: 'CREATED' | 'UPDATED' | 'REMOVED'
  pointsEarnedByAuthor: number
  isSuperReaction: boolean
  promotedToHonorRoll: boolean
}

export interface ReactionSummary {
  totalCount: number
  currentUserReaction: string | null
  topReactions: { kind: string; count: number; hasSuperReaction: boolean }[]
}

export interface CreatePostInput {
  type: PostType
  title?: string
  body?: string
  audience_type?: AudienceType
  audience_ref?: Record<string, any>
  type_data?: Record<string, any>
  is_emergency?: boolean
  comments_enabled?: boolean
  media_ids?: string[]
}

export interface FinaComment {
  id: string
  post_id: string
  author_id: string
  body: string
  state: 'pending' | 'approved' | 'rejected'
  created_at: string
  author?: { first_name: string | null; last_name: string | null; role: string }
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  try {
    const token = await getAuthToken()
    const res = await fetch(`${API_URL}${withCampusParam(path)}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...getImpersonationHeaders(),
        ...options.headers,
      },
    })
    if (res.status === 401) {
      await handleSessionExpiry()
      return { data: null, error: 'Session expired' }
    }
    const json = await res.json()
    if (!res.ok) return { data: null, error: json.error || 'Request failed' }
    return json
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Network error' }
  }
}

// ── Wall ─────────────────────────────────────────────────────────────────

export const listWall = (params?: { cursor?: string | null; type?: string; q?: string }) => {
  const qs = new URLSearchParams()
  if (params?.cursor) qs.set('cursor', params.cursor)
  if (params?.type) qs.set('type', params.type)
  if (params?.q?.trim()) qs.set('q', params.q.trim())
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  return apiFetch<{ posts: FinaPost[]; nextCursor: string | null }>(`/fina/posts/wall${suffix}`)
}

export const getPostDetail = (postId: string) => apiFetch<FinaPost>(`/fina/posts/${postId}`)

export const getComposerOptions = () =>
  apiFetch<{
    gradeLevels: { id: string; name: string }[]
    sections: { id: string; name: string; gradeLevelId: string | null }[]
    students: { id: string; sectionId: string | null; name: string }[]
  }>('/fina/posts/composer-options')

// ── Composer / moderation ───────────────────────────────────────────────────

export const createPost = (input: CreatePostInput) => apiFetch<FinaPost>('/fina/posts', { method: 'POST', body: JSON.stringify(input) })

export const updatePost = (postId: string, input: Partial<CreatePostInput>) =>
  apiFetch<FinaPost>(`/fina/posts/${postId}`, { method: 'PATCH', body: JSON.stringify(input) })

export const submitPost = (postId: string) => apiFetch<FinaPost>(`/fina/posts/${postId}/submit`, { method: 'POST' })

export const deletePost = (postId: string) => apiFetch<null>(`/fina/posts/${postId}`, { method: 'DELETE' })

export const listMyPosts = () => apiFetch<FinaPost[]>('/fina/posts/mine')

export const listReviewQueue = () => apiFetch<FinaPost[]>('/fina/posts/review-queue')

export const reviewPost = (postId: string, decision: 'approve' | 'reject', reason?: string) =>
  apiFetch<FinaPost>(`/fina/posts/${postId}/review`, { method: 'POST', body: JSON.stringify({ decision, reason }) })

export const listApprovalQueue = () => apiFetch<FinaPost[]>('/fina/posts/approval-queue')

export const approvePost = (postId: string) => apiFetch<FinaPost>(`/fina/posts/${postId}/approve`, { method: 'POST' })

export const rejectApproval = (postId: string, reason: string) =>
  apiFetch<FinaPost>(`/fina/posts/${postId}/reject-approval`, { method: 'POST', body: JSON.stringify({ reason }) })

export const pinPost = (postId: string, pinned: boolean) =>
  apiFetch<FinaPost>(`/fina/posts/${postId}/pin`, { method: 'POST', body: JSON.stringify({ pinned }) })

// ── Reactions / comments ────────────────────────────────────────────────────

export const setReaction = (postId: string, kind: ReactionKind = 'clap') =>
  apiFetch<ReactionActionResult>(`/fina/posts/${postId}/reactions`, { method: 'POST', body: JSON.stringify({ kind }) })

export const removeReaction = (postId: string) =>
  apiFetch<ReactionActionResult>(`/fina/posts/${postId}/reactions`, { method: 'DELETE' })

export const getReactionSummary = (postId: string) => apiFetch<ReactionSummary>(`/fina/posts/${postId}/reactions`)

export const listComments = (postId: string) => apiFetch<FinaComment[]>(`/fina/posts/${postId}/comments`)

export const addComment = (postId: string, body: string) =>
  apiFetch<FinaComment>(`/fina/posts/${postId}/comments`, { method: 'POST', body: JSON.stringify({ body }) })

export const moderateComment = (commentId: string, decision: 'approve' | 'reject') =>
  apiFetch<FinaComment>(`/fina/posts/comments/${commentId}/moderate`, { method: 'POST', body: JSON.stringify({ decision }) })

// ── Class Goal Engine ────────────────────────────────────────────────────────

export interface FinaClassGoal {
  id: string
  school_id: string
  // Exactly one of these is set — a goal targets either a single section or
  // a whole grade level (every section under it). See migration 303.
  section_id: string | null
  grade_level_id: string | null
  reaction_kind: ReactionKind
  target_count: number
  week_start: string
  week_end: string
  currentCount: number
}

export const listClassGoals = (sectionId?: string) => {
  const qs = sectionId ? `?sectionId=${sectionId}` : ''
  return apiFetch<FinaClassGoal[]>(`/fina/posts/class-goals${qs}`)
}

// Exactly one of sectionId/gradeLevelId — see FinaClassGoal above.
export const createClassGoal = (input: { sectionId?: string; gradeLevelId?: string; reactionKind: ReactionKind; targetCount: number }) =>
  apiFetch<FinaClassGoal>('/fina/posts/class-goals', { method: 'POST', body: JSON.stringify(input) })

// ── Albums ───────────────────────────────────────────────────────────────

export interface FinaAlbum {
  id: string
  school_id: string
  title: string
  activity_date: string | null
  section_id: string | null
}

export const listAlbums = () => apiFetch<FinaAlbum[]>('/fina/albums')

export const createAlbum = (input: { title: string; activity_date?: string; section_id?: string }) =>
  apiFetch<FinaAlbum>('/fina/albums', { method: 'POST', body: JSON.stringify(input) })

export const getAlbumDetail = (albumId: string) =>
  apiFetch<{ album: FinaAlbum; media: { id: string; kind: string; isMyChild: boolean }[] }>(`/fina/albums/${albumId}`)
