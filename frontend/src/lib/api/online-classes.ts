import { getAuthToken } from './schools'
import { handleSessionExpiry } from '@/context/AuthContext'
import { API_URL } from '@/config/api'
import { getImpersonationHeaders } from './abortable-fetch'

interface ApiResponse<T = unknown> {
  data: T | null
  error: string | null
}

// ============================================================================
// TYPES
// ============================================================================

export type OnlineClassType = 'existing_course' | 'external_open'
export type OnlineClassStatus = 'pending_review' | 'approved' | 'active' | 'rejected' | 'completed' | 'cancelled'

export interface OnlineClass {
  id: string
  school_id: string
  campus_id: string
  teacher_profile_id: string
  class_type: OnlineClassType
  course_period_id: string | null
  title: string
  description: string | null
  student_capacity: number | null
  enrolled_count: number
  scheduled_days: string | null
  session_start_time: string | null
  session_end_time: string | null
  start_date: string | null
  end_date: string | null
  status: OnlineClassStatus
  reviewer_profile_id: string | null
  review_note: string | null
  reviewed_at: string | null
  jitsi_room_id: string | null
  started_at: string | null
  ended_at: string | null
  created_at: string
  updated_at: string
}

export interface OpenOnlineClass extends OnlineClass {
  seats_remaining: number
}

export interface CreateOnlineClassInput {
  class_type: OnlineClassType
  course_period_id?: string
  title: string
  description?: string
  student_capacity?: number
  scheduled_days?: string
  session_start_time?: string
  session_end_time?: string
  start_date?: string
  end_date?: string
  campus_id?: string | null
}

// ============================================================================
// HELPERS
// ============================================================================

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
// TEACHER
// ============================================================================

export const submitOnlineClassRequest = (input: CreateOnlineClassInput) =>
  apiFetch<OnlineClass>('/online-classes', { method: 'POST', body: JSON.stringify(input) })

export const listMyOnlineClassRequests = () =>
  apiFetch<OnlineClass[]>('/online-classes/mine')

export const cancelOnlineClassRequest = (id: string) =>
  apiFetch<null>(`/online-classes/${id}/cancel`, { method: 'POST' })

export const startOnlineClassSession = (id: string) =>
  apiFetch<{ id: string; room_name: string; jitsi_domain?: string | null }>(`/online-classes/${id}/start-session`, { method: 'POST' })

/**
 * Course-period-direct start — no admin approval. Idempotent: calling this
 * again for a period that already has a live session just rejoins it.
 */
export const startCourseSession = (coursePeriodId: string) =>
  apiFetch<{ id: string; room_name: string; jitsi_domain?: string | null }>(
    `/online-classes/course-periods/${coursePeriodId}/start`,
    { method: 'POST' }
  )

/** Owning teacher or a same-school admin. Idempotent — ending twice is a no-op. */
export const endOnlineClassSession = (id: string) =>
  apiFetch<OnlineClass>(`/online-classes/${id}/end-session`, { method: 'POST' })

// ============================================================================
// ADMIN
// ============================================================================

export const listPendingOnlineClasses = (campusId?: string) =>
  apiFetch<OnlineClass[]>(`/online-classes/review-queue${campusId ? `?campus_id=${campusId}` : ''}`)

export const approveOnlineClass = (id: string, note?: string) =>
  apiFetch<OnlineClass>(`/online-classes/${id}/approve`, { method: 'POST', body: JSON.stringify({ note }) })

export const rejectOnlineClass = (id: string, note?: string) =>
  apiFetch<OnlineClass>(`/online-classes/${id}/reject`, { method: 'POST', body: JSON.stringify({ note }) })

/** Admin visibility into currently-live sessions (previously only the pending_review queue existed). */
export const listActiveOnlineClasses = (campusId?: string) =>
  apiFetch<OnlineClass[]>(`/online-classes/active-sessions${campusId ? `?campus_id=${campusId}` : ''}`)

// ============================================================================
// STUDENT
// ============================================================================

export const listOpenOnlineClasses = () =>
  apiFetch<OpenOnlineClass[]>('/online-classes/open')

export const enrollInOnlineClass = (id: string) =>
  apiFetch<{ id: string }>(`/online-classes/${id}/enroll`, { method: 'POST' })

export const withdrawFromOnlineClass = (id: string) =>
  apiFetch<null>(`/online-classes/${id}/withdraw`, { method: 'POST' })

export const listMyOnlineClassEnrollments = () =>
  apiFetch<OnlineClass[]>('/online-classes/enrolled')
