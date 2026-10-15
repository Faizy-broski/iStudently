// Staff absences (school admin): absence fields, absences (with cancelled classes and custom
// fields), reports and helpers. Same endpoints as frontend/src/lib/api/staff-absences.ts;
// router: staff-absences.routes.ts. Responses are { data, error } without `success`.
import type { ApiClient } from '../../client'
import { qs } from '../../query'

export type AbsenceFieldType = 'text' | 'numeric' | 'date' | 'textarea' | 'radio' | 'select' | 'autos' | 'exports' | 'multiple' | 'files'

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
  created_at?: string
  updated_at?: string
}

export type StaffAbsenceFieldInput = Omit<StaffAbsenceField, 'id' | 'created_at' | 'updated_at'>

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

export interface StaffAbsenceInput {
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
}

export type StaffAbsenceUpdate = Partial<{
  start_date: string
  end_date: string
  reason: string
  notes: string
  status: AbsenceStatus
  custom_fields: Record<string, unknown>
  cancelled_course_period_ids: string[]
}>

export interface StaffAbsenceListParams {
  school_id: string
  campus_id?: string
  staff_id?: string
  start_date?: string
  end_date?: string
  status?: string
  academic_year_id?: string
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

export interface AbsenceBreakdownRow {
  staff_id: string
  staff_name: string
  month: string
  days_absent: number
}

export interface AbsenceStaffMember {
  id: string
  name: string
  role: string
}

export interface AbsenceCoursePeriod {
  id: string
  title: string
  short_name: string
}

export function adminStaffAbsencesApi(api: ApiClient) {
  return {
    getFields: (schoolId: string, campusId?: string) => api.get<StaffAbsenceField[]>(`/staff-absences/fields${qs({ school_id: schoolId, campus_id: campusId })}`),
    createField: (body: StaffAbsenceFieldInput) => api.post<StaffAbsenceField>('/staff-absences/fields', body),
    updateField: (id: string, body: Partial<StaffAbsenceField>) => api.put<StaffAbsenceField>(`/staff-absences/fields/${id}`, body),
    deleteField: (id: string) => api.del<null>(`/staff-absences/fields/${id}`),

    list: (p: StaffAbsenceListParams) => api.get<StaffAbsence[]>(`/staff-absences${qs(p as any)}`),
    get: (id: string) => api.get<StaffAbsence>(`/staff-absences/${id}`),
    create: (body: StaffAbsenceInput) => api.post<StaffAbsence>('/staff-absences', body),
    update: (id: string, body: StaffAbsenceUpdate) => api.put<StaffAbsence>(`/staff-absences/${id}`, body),
    remove: (id: string) => api.del<null>(`/staff-absences/${id}`),

    cancelledClasses: (p: { school_id: string; campus_id?: string; staff_id?: string; start_date?: string; end_date?: string }) =>
      api.get<CancelledClassRow[]>(`/staff-absences/reports/cancelled-classes${qs(p as any)}`),
    breakdown: (p: { school_id: string; campus_id?: string; start_date?: string; end_date?: string }) =>
      api.get<AbsenceBreakdownRow[]>(`/staff-absences/reports/breakdown${qs(p as any)}`),

    staffMembers: (schoolId: string, campusId?: string) =>
      api.get<AbsenceStaffMember[]>(`/staff-absences/helpers/staff${qs({ school_id: schoolId, campus_id: campusId })}`),
    staffCoursePeriods: (staffId: string, schoolId: string, campusId?: string) =>
      api.get<AbsenceCoursePeriod[]>(`/staff-absences/helpers/staff/${staffId}/course-periods${qs({ school_id: schoolId, campus_id: campusId })}`),
  }
}
