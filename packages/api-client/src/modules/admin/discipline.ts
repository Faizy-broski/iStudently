// Discipline (school admin): referral fields per target type, referrals (students, teachers,
// staff), report loads and student scores. Same endpoints as frontend/src/lib/api/discipline.ts;
// router: discipline.routes.ts (registered at "/" with /discipline/* paths).
import type { ApiClient } from '../../client'
import { qs } from '../../query'
import type { ApiResponse } from '../../types'

export type DisciplineFieldType = 'select' | 'multiple_radio' | 'multiple_checkbox' | 'text' | 'textarea' | 'checkbox' | 'numeric' | 'date'
export type DisciplineTargetType = 'student' | 'teacher' | 'staff'

export interface DisciplineField {
  id: string
  school_id: string
  name: string
  target_type: DisciplineTargetType
  field_type: DisciplineFieldType
  options: string[] | null
  sort_order: number
  is_active: boolean
  penalty_points: number | null
  created_at?: string
  updated_at?: string
}

export interface DisciplineFieldInput {
  school_id: string
  name: string
  target_type: DisciplineTargetType
  field_type: DisciplineFieldType
  options?: string[] | null
  sort_order?: number
  penalty_points?: number | null
}

export type DisciplineFieldUpdate = Partial<{ name: string; field_type: DisciplineFieldType; options: string[] | null; sort_order: number; is_active: boolean; penalty_points: number | null }>

export interface DisciplineReferral {
  id: string
  school_id: string
  campus_id: string | null
  target_type: DisciplineTargetType
  student_id: string | null
  staff_id: string | null
  academic_year_id: string | null
  reporter_id: string | null
  incident_date: string
  field_values: Record<string, any>
  /** A library incident (e.g. damaged or lost book); the only kind librarians see. */
  library_related?: boolean
  created_at: string
  updated_at: string
  students?: { id: string; first_name: string; last_name: string; student_number: string; grade_level?: string | null; section_id?: string | null } | null
  staff?: { id: string; employee_number: string; profile?: { first_name: string; last_name: string } | null } | null
  reporter?: { id: string; full_name: string } | null
  school?: { id: string; name: string } | null
}

export interface DisciplineReferralParams {
  school_id: string
  campus_id?: string
  target_type?: DisciplineTargetType
  student_id?: string
  staff_id?: string
  start_date?: string
  end_date?: string
  academic_year_id?: string
  grade_level?: string
  section_id?: string
  /** Only library-related referrals (librarians always get only these). */
  library_related?: boolean
  page?: number
  limit?: number
}

export interface DisciplineReferralInput {
  school_id: string
  campus_id?: string | null
  target_type?: DisciplineTargetType
  student_id?: string
  student_ids?: string[]
  staff_id?: string
  staff_ids?: string[]
  reporter_id?: string | null
  incident_date?: string
  field_values?: Record<string, any>
  academic_year_id?: string | null
  /** Mark as a library incident (librarians' reports are always library-related). */
  library_related?: boolean
}

export type DisciplineReferralUpdate = Partial<{ campus_id: string | null; reporter_id: string | null; incident_date: string; field_values: Record<string, any>; academic_year_id: string | null; library_related: boolean }>

export interface DisciplineScoreResult {
  score: number
  total_delta: number
  referral_count: number
  breakdown: { referral_id: string; incident_date: string; field_name: string; delta: number; detail: string }[]
}

/** Paged referral list: the server returns { data, total, page, limit }. */
export type DisciplineReferralPage = ApiResponse<DisciplineReferral[]> & { total?: number; page?: number; limit?: number }

export function adminDisciplineApi(api: ApiClient) {
  const fields = (schoolId: string, targetType: DisciplineTargetType, includeInactive = false) =>
    api.get<DisciplineField[]>(`/discipline/fields${qs({ school_id: schoolId, target_type: targetType, include_inactive: includeInactive || undefined })}`)
  return {
    getFields: fields,
    /** Fields of every target type (web: getAllDisciplineFields). */
    getAllFields: async (schoolId: string, includeInactive = false): Promise<ApiResponse<DisciplineField[]>> => {
      const res = await Promise.all((['student', 'teacher', 'staff'] as const).map((tt) => fields(schoolId, tt, includeInactive)))
      const failed = res.find((r) => !r.success)
      return failed ?? { success: true, data: res.flatMap((r) => r.data ?? []) }
    },
    createField: (body: DisciplineFieldInput) => api.post<DisciplineField>('/discipline/fields', body),
    updateField: (id: string, body: DisciplineFieldUpdate) => api.patch<DisciplineField>(`/discipline/fields/${id}`, body),
    deleteField: (id: string) => api.del<{ success: boolean }>(`/discipline/fields/${id}`),

    getReferrals: (p: DisciplineReferralParams) => api.get<DisciplineReferral[]>(`/discipline/referrals${qs(p as any)}`) as Promise<DisciplineReferralPage>,
    /** Every referral matching the filters, unpaged (web: getAllDisciplineReferrals, report=true). */
    getReportReferrals: (p: Omit<DisciplineReferralParams, 'page' | 'limit'>) => api.get<DisciplineReferral[]>(`/discipline/referrals${qs({ ...(p as any), report: 'true' })}`),
    getReferral: (id: string) => api.get<DisciplineReferral>(`/discipline/referrals/${id}`),
    createReferral: (body: DisciplineReferralInput) => api.post<DisciplineReferral | DisciplineReferral[]>('/discipline/referrals', body),
    updateReferral: (id: string, body: DisciplineReferralUpdate) => api.patch<DisciplineReferral>(`/discipline/referrals/${id}`, body),
    deleteReferral: (id: string) => api.del<{ success: boolean }>(`/discipline/referrals/${id}`),

    /** Teacher: referrals the signed-in staff member filed (web: /teacher/discipline/referrals). */
    staffReferrals: () => api.get<DisciplineReferral[]>('/discipline/staff/referrals'),
    /** Teacher: file a referral about one of their students (web: /teacher/discipline/add-referral). */
    createStaffReferral: (body: { student_id: string; incident_date?: string; field_values?: Record<string, unknown>; library_related?: boolean }) =>
      api.post<DisciplineReferral>('/discipline/staff/referrals', body),

    getStudentScore: (studentId: string, campusId?: string | null, academicYearId?: string | null) =>
      api.get<DisciplineScoreResult>(`/discipline/score/${studentId}${qs({ campus_id: campusId ?? undefined, academic_year_id: academicYearId ?? undefined })}`),
  }
}
