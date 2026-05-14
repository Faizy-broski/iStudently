import { getAuthToken } from './schools'
import { handleSessionExpiry } from '@/context/AuthContext'
import { API_URL } from '@/config/api'

interface ApiResponse<T = unknown> {
  data: T | null
  error: string | null
}

// ============================================================================
// TYPES
// ============================================================================

export type AbsenceFieldType =
  | 'text'
  | 'numeric'
  | 'date'
  | 'textarea'
  | 'radio'
  | 'select'
  | 'autos'
  | 'exports'
  | 'multiple'
  | 'files'

export interface StaffAbsenceField {
  id: string
  school_id: string
  campus_id?: string | null
  title: string
  type: AbsenceFieldType
  select_options?: string | null
  default_selection?: string | null
  sort_order?: number | null
  required: boolean
  created_at: string
  updated_at: string
}

export type AbsenceStatus = 'pending' | 'approved' | 'rejected'

export interface StaffAbsence {
  id: string
  school_id: string
  campus_id?: string | null
  staff_id: string
  created_by: string
  academic_year_id?: string | null
  start_date: string
  end_date: string
  reason?: string | null
  notes?: string | null
  status: AbsenceStatus
  custom_fields?: Record<string, unknown>
  created_at: string
  updated_at: string
  staff_name?: string
  staff_email?: string
  staff_role?: string
  cancelled_course_periods?: string[]
}

export interface CancelledClassRow {
  absence_id: string
  staff_id: string
  staff_name: string
  start_date: string
  end_date: string
  course_period_id: string
  course_period_title: string
  short_name: string
}

export interface BreakdownRow {
  staff_id: string
  staff_name: string
  month: string
  days_absent: number
}

export interface StaffMember {
  id: string
  name: string
  role: string
}

export interface CoursePeriod {
  id: string
  title: string
  short_name: string
}

// ============================================================================
// HELPERS
// ============================================================================

async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const token = await getAuthToken()
    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    })

    if (res.status === 401) {
      handleSessionExpiry()
      return { data: null, error: 'Session expired' }
    }

    const json = await res.json()
    if (!res.ok) return { data: null, error: json.error || 'Request failed' }
    return json
  } catch (err: any) {
    return { data: null, error: err.message }
  }
}

function qs(params: Record<string, string | undefined | null>): string {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== '') p.set(k, v)
  }
  const s = p.toString()
  return s ? `?${s}` : ''
}

// ============================================================================
// ABSENCE FIELDS API
// ============================================================================

export const getAbsenceFields = (
  schoolId: string,
  campusId?: string
) =>
  apiFetch<StaffAbsenceField[]>(
    `/staff-absences/fields${qs({ school_id: schoolId, campus_id: campusId })}`
  )

export const createAbsenceField = (
  data: Omit<StaffAbsenceField, 'id' | 'created_at' | 'updated_at'>
) =>
  apiFetch<StaffAbsenceField>('/staff-absences/fields', {
    method: 'POST',
    body: JSON.stringify(data),
  })

export const updateAbsenceField = (
  id: string,
  data: Partial<StaffAbsenceField>
) =>
  apiFetch<StaffAbsenceField>(`/staff-absences/fields/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })

export const deleteAbsenceField = (id: string) =>
  apiFetch<null>(`/staff-absences/fields/${id}`, { method: 'DELETE' })

// ============================================================================
// ABSENCES API
// ============================================================================

export const getAbsences = (params: {
  school_id: string
  campus_id?: string
  staff_id?: string
  start_date?: string
  end_date?: string
  status?: string
  academic_year_id?: string
}) =>
  apiFetch<StaffAbsence[]>(`/staff-absences${qs(params)}`)

export const getAbsenceById = (id: string) =>
  apiFetch<StaffAbsence>(`/staff-absences/${id}`)

export const createAbsence = (data: {
  school_id: string
  campus_id?: string
  staff_id: string
  created_by?: string
  academic_year_id?: string
  start_date: string
  end_date: string
  reason?: string
  notes?: string
  status?: AbsenceStatus
  custom_fields?: Record<string, unknown>
  cancelled_course_period_ids?: string[]
}) =>
  apiFetch<StaffAbsence>('/staff-absences', {
    method: 'POST',
    body: JSON.stringify(data),
  })

export const updateAbsence = (
  id: string,
  data: Partial<{
    start_date: string
    end_date: string
    reason: string
    notes: string
    status: AbsenceStatus
    custom_fields: Record<string, unknown>
    cancelled_course_period_ids: string[]
  }>
) =>
  apiFetch<StaffAbsence>(`/staff-absences/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })

export const deleteAbsence = (id: string) =>
  apiFetch<null>(`/staff-absences/${id}`, { method: 'DELETE' })

// ============================================================================
// REPORTS API
// ============================================================================

export const getCancelledClasses = (params: {
  school_id: string
  campus_id?: string
  staff_id?: string
  start_date?: string
  end_date?: string
}) =>
  apiFetch<CancelledClassRow[]>(`/staff-absences/reports/cancelled-classes${qs(params)}`)

export const getAbsenceBreakdown = (params: {
  school_id: string
  campus_id?: string
  start_date?: string
  end_date?: string
}) =>
  apiFetch<BreakdownRow[]>(`/staff-absences/reports/breakdown${qs(params)}`)

// ============================================================================
// HELPERS API
// ============================================================================

export const getStaffMembers = (schoolId: string, campusId?: string) =>
  apiFetch<StaffMember[]>(
    `/staff-absences/helpers/staff${qs({ school_id: schoolId, campus_id: campusId })}`
  )

export const getStaffCoursePeriods = (
  staffId: string,
  schoolId: string,
  campusId?: string
) =>
  apiFetch<CoursePeriod[]>(
    `/staff-absences/helpers/staff/${staffId}/course-periods${qs({
      school_id: schoolId,
      campus_id: campusId,
    })}`
  )
