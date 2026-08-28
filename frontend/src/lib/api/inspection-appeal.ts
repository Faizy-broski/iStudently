import { getAuthToken } from './schools'
import { handleSessionExpiry } from '@/context/AuthContext'
import { API_URL } from '@/config/api'
import { getImpersonationHeaders } from './abortable-fetch'

interface ApiResponse<T = unknown> {
  data: T | null
  error: string | null
}

export type AppealStatus = 'submitted' | 'under_review' | 'escalated' | 'upheld' | 'denied' | 'withdrawn'

export interface AppealComment {
  id: string
  appeal_id: string
  author_profile_id: string
  body: string
  is_internal_note: boolean
  created_at: string
}

export interface InspectionAppeal {
  id: string
  evaluation_id: string
  visit_id: string
  school_id: string
  teacher_profile_id: string
  reason: string
  status: AppealStatus
  assigned_to_profile_id: string | null
  resolution_note: string | null
  resolved_at: string | null
  created_at: string
  // Present on list-endpoint rows (a joined summary); absent on the plain
  // base shape. AppealDetail below redeclares it as `| null` (present but
  // possibly unset) for the single-appeal detail endpoint instead.
  teacher?: { id: string; first_name: string; last_name: string }
}

export interface AppealDetail extends Omit<InspectionAppeal, 'teacher'> {
  comments: AppealComment[]
  teacher: { id: string; first_name: string; last_name: string } | null
  assigned_to: { id: string; first_name: string; last_name: string } | null
}

export interface EscalationTarget {
  id: string
  first_name: string
  last_name: string
  role: string
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
// TEACHER
// ============================================================================

export const createAppeal = (evaluationId: string, reason: string) =>
  apiFetch<InspectionAppeal>('/inspection-appeals', { method: 'POST', body: JSON.stringify({ evaluation_id: evaluationId, reason }) })

export const listMyAppeals = () =>
  apiFetch<InspectionAppeal[]>('/inspection-appeals/mine')

export const withdrawAppeal = (id: string) =>
  apiFetch<InspectionAppeal>(`/inspection-appeals/${id}/withdraw`, { method: 'POST' })

// ============================================================================
// ADMIN
// ============================================================================

export const listAppealsForSchool = (schoolId: string) =>
  apiFetch<InspectionAppeal[]>(`/inspection-appeals/school/${schoolId}`)

/** Cross-campus: appeals escalated to the current admin, regardless of which campus filed them. */
export const listAppealsAssignedToMe = () =>
  apiFetch<Array<InspectionAppeal & { school: { id: string; name: string } }>>('/inspection-appeals/assigned-to-me')

export const listEscalationTargets = (schoolId: string) =>
  apiFetch<EscalationTarget[]>(`/inspection-appeals/school/${schoolId}/escalation-targets`)

export const updateAppealStatus = (id: string, status: 'under_review' | 'upheld' | 'denied', resolutionNote?: string) =>
  apiFetch<InspectionAppeal>(`/inspection-appeals/${id}/status`, { method: 'POST', body: JSON.stringify({ status, resolution_note: resolutionNote }) })

export const escalateAppeal = (id: string, targetProfileId: string, note?: string) =>
  apiFetch<InspectionAppeal>(`/inspection-appeals/${id}/escalate`, { method: 'POST', body: JSON.stringify({ target_profile_id: targetProfileId, note }) })

// ============================================================================
// SHARED (teacher, admin, inspector)
// ============================================================================

export const getAppeal = (id: string) =>
  apiFetch<AppealDetail>(`/inspection-appeals/${id}`)

export const addComment = (id: string, body: string, isInternalNote = false) =>
  apiFetch<AppealComment>(`/inspection-appeals/${id}/comments`, { method: 'POST', body: JSON.stringify({ body, is_internal_note: isInternalNote }) })
