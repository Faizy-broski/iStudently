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

export type VisitType = 'announced' | 'unannounced' | 'follow_up'
export type VisitStatus = 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'rescheduled'

export interface InspectionVisit {
  id: string
  school_id: string
  inspector_profile_id: string
  visit_type: VisitType
  scheduled_date: string
  scheduled_start_time: string | null
  scheduled_end_time: string | null
  status: VisitStatus
  purpose: string | null
  principal_profile_id: string | null
  cancellation_reason: string | null
  rescheduled_from_visit_id: string | null
  confirmed_at: string | null
  checked_in_at: string | null
  completed_at: string | null
  cancelled_at: string | null
  created_at: string
  updated_at: string
  school?: { id: string; name: string }
  inspector?: { id: string; first_name: string; last_name: string }
}

export interface VisitTeacher {
  id: string
  visit_id: string
  teacher_profile_id: string
  subject_id: string | null
  notes: string | null
  teacher?: { id: string; first_name: string; last_name: string }
  subject?: { id: string; name: string } | null
}

export interface VisitDetail extends InspectionVisit {
  teachers: VisitTeacher[]
}

export interface CreateVisitInput {
  school_id: string
  visit_type: VisitType
  scheduled_date: string
  scheduled_start_time?: string
  scheduled_end_time?: string
  purpose?: string
}

export interface RescheduleInput {
  scheduled_date: string
  scheduled_start_time?: string
  scheduled_end_time?: string
}

export interface VisitFilters {
  status?: VisitStatus
  from_date?: string
  to_date?: string
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

function toQuery(filters?: VisitFilters) {
  if (!filters) return ''
  const params = new URLSearchParams()
  if (filters.status) params.set('status', filters.status)
  if (filters.from_date) params.set('from_date', filters.from_date)
  if (filters.to_date) params.set('to_date', filters.to_date)
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

// ============================================================================
// INSPECTOR
// ============================================================================

export const createVisit = (input: CreateVisitInput) =>
  apiFetch<InspectionVisit>('/inspection-visits', { method: 'POST', body: JSON.stringify(input) })

export const listMyVisits = (filters?: VisitFilters) =>
  apiFetch<InspectionVisit[]>(`/inspection-visits/mine${toQuery(filters)}`)

export const checkInVisit = (id: string) =>
  apiFetch<InspectionVisit>(`/inspection-visits/${id}/check-in`, { method: 'POST' })

export const completeVisit = (id: string) =>
  apiFetch<InspectionVisit>(`/inspection-visits/${id}/complete`, { method: 'POST' })

export const rescheduleVisit = (id: string, input: RescheduleInput) =>
  apiFetch<InspectionVisit>(`/inspection-visits/${id}/reschedule`, { method: 'POST', body: JSON.stringify(input) })

export const setVisitTeachers = (id: string, teachers: Array<{ teacher_profile_id: string; subject_id?: string | null }>) =>
  apiFetch<VisitTeacher[]>(`/inspection-visits/${id}/teachers`, { method: 'PUT', body: JSON.stringify({ teachers }) })

// ============================================================================
// SHARED (inspector + admin)
// ============================================================================

export const getVisit = (id: string) =>
  apiFetch<VisitDetail>(`/inspection-visits/${id}`)

export const cancelVisit = (id: string, reason?: string) =>
  apiFetch<InspectionVisit>(`/inspection-visits/${id}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) })

// ============================================================================
// ADMIN
// ============================================================================

export const confirmVisit = (id: string) =>
  apiFetch<InspectionVisit>(`/inspection-visits/${id}/confirm`, { method: 'POST' })

export const listVisitsForSchool = (schoolId: string, filters?: VisitFilters) =>
  apiFetch<InspectionVisit[]>(`/inspection-visits/school/${schoolId}${toQuery(filters)}`)

// ============================================================================
// TEACHER
// ============================================================================

export const listVisitsForTeacher = () =>
  apiFetch<InspectionVisit[]>('/inspection-visits/teacher/mine')
