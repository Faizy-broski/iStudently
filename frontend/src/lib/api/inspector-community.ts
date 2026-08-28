import { getAuthToken } from './schools'
import { handleSessionExpiry } from '@/context/AuthContext'
import { API_URL } from '@/config/api'
import { getImpersonationHeaders } from './abortable-fetch'

interface ApiResponse<T = unknown> {
  data: T | null
  error: string | null
}

export interface InspectorBroadcast {
  id: string
  inspector_profile_id: string
  subject_id: string | null
  title: string
  body: string
  target_school_ids: string[]
  created_at: string
  inspector?: { id: string; first_name: string; last_name: string }
  subject?: { id: string; name: string } | null
}

export interface ForumThread {
  id: string
  subject_id: string | null
  title: string
  created_by: string
  target_school_ids: string[]
  is_pinned: boolean
  updated_at: string
  created_at: string
  subject?: { id: string; name: string } | null
  creator?: { id: string; first_name: string; last_name: string }
}

export interface ForumPost {
  id: string
  thread_id: string
  author_profile_id: string
  body: string
  created_at: string
  author?: { id: string; first_name: string; last_name: string; role: string }
}

export interface ForumThreadDetail extends ForumThread {
  posts: ForumPost[]
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  try {
    const token = await getAuthToken()
    const res = await fetch(`${API_URL}${path}`, {
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

// ============================================================================
// BROADCASTS
// ============================================================================

export const createBroadcast = (input: { subject_id?: string | null; title: string; body: string; target_school_ids: string[] }) =>
  apiFetch<InspectorBroadcast>('/inspector-broadcasts', { method: 'POST', body: JSON.stringify(input) })

export const listMyBroadcasts = () =>
  apiFetch<InspectorBroadcast[]>('/inspector-broadcasts/mine')

export const listBroadcastsForSchool = (schoolId: string) =>
  apiFetch<InspectorBroadcast[]>(`/inspector-broadcasts/school/${schoolId}`)

export const deleteBroadcast = (id: string) =>
  apiFetch<null>(`/inspector-broadcasts/${id}`, { method: 'DELETE' })

// ============================================================================
// FORUM
// ============================================================================

export const createThread = (input: { subject_id?: string | null; title: string; body: string; target_school_ids?: string[] }) =>
  apiFetch<ForumThread>('/inspection-forum', { method: 'POST', body: JSON.stringify(input) })

export const listThreadsForSchool = (schoolId: string) =>
  apiFetch<ForumThread[]>(`/inspection-forum/school/${schoolId}`)

export const getThread = (id: string) =>
  apiFetch<ForumThreadDetail>(`/inspection-forum/${id}`)

export const addPost = (threadId: string, body: string) =>
  apiFetch<ForumPost>(`/inspection-forum/${threadId}/posts`, { method: 'POST', body: JSON.stringify({ body }) })
