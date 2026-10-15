// School admin: students (backend/src/routes/student.routes.ts, /students). Campus via campus_id.
import type { ApiClient } from '../../client'
import { qs } from '../../query'

export type Gender = 'male' | 'female' | 'other'

export interface StudentProfile {
  id: string
  first_name: string | null
  father_name?: string | null
  grandfather_name?: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  gender?: string | null
  date_of_birth?: string | null
  national_id?: string | null
  avatar_url: string | null
  profile_photo_url: string | null
  is_active: boolean
  username?: string | null
}

export interface Student {
  id: string
  profile_id: string | null
  school_id: string
  campus_id?: string
  student_number: string
  grade_level: string | null
  grade_level_id?: string | null
  section_id?: string | null
  profile?: StudentProfile
  grade?: { id: string; name: string } | null
  section?: { id: string; name: string } | null
  sibling_count?: number
  /** Admin/counselor only; the server strips it for students and parents. */
  confidential_family_status?: ConfidentialFamilyStatus | null
  medical_info?: Record<string, unknown> | null
  custom_fields?: Record<string, any>
  created_at?: string
  /** Only on create, when the server generated sign-in details. */
  generated_username?: string
  generated_password?: string
}

export type ConfidentialFamilyStatus = 'NONE' | 'PARENTS_DIVORCED' | 'ORPHAN_FATHER' | 'ORPHAN_MOTHER' | 'ORPHAN_BOTH'
export const CONFIDENTIAL_FAMILY_STATUSES: ConfidentialFamilyStatus[] = ['NONE', 'PARENTS_DIVORCED', 'ORPHAN_FATHER', 'ORPHAN_MOTHER', 'ORPHAN_BOTH']

export interface StudentRelatives {
  siblings: { id: string; student_number: string | null; grade_level: string | null; first_name: string | null; last_name: string | null; father_name: string | null; profile_photo_url: string | null }[]
  parents: { id: string; relation_type: string; relationship: string | null; first_name: string | null; last_name: string | null; father_name?: string | null; phone: string | null; email: string | null; profile_photo_url: string | null }[]
}

export interface StudentListParams {
  page?: number
  limit?: number
  search?: string
  /** Grade names (the server filters by name). */
  grade_level?: string[]
  section_id?: string[]
  is_active?: boolean
  has_siblings?: boolean
  sort_key?: 'student_number' | 'name' | 'grade' | 'status' | 'contact'
  sort_dir?: 'asc' | 'desc'
}

export interface StudentInput {
  student_number: string
  grade_level?: string
  grade_level_id?: string
  section_id?: string | null
  campus_id?: string
  first_name: string
  father_name?: string
  grandfather_name?: string
  last_name: string
  email?: string
  phone?: string
  profile_photo_url?: string
  password?: string
  username?: string
  is_active?: boolean
  gender?: Gender
  date_of_birth?: string
  national_id?: string
  medical_info?: { blood_group?: string; allergies?: string[]; notes?: string; [key: string]: unknown }
  custom_fields?: Record<string, any>
}

export interface StudentPrintInfo {
  id: string
  student_number: string
  profile: { first_name: string; father_name: string; grandfather_name: string; last_name: string; email: string; phone: string; profile_photo_url: string | null; is_active: boolean }
  academic: { grade_level: string; section: string; admission_date: string }
  medical_info: Record<string, any>
  custom_fields: Record<string, any>
  parent_links: { parent: { id: string; profile: { first_name: string; last_name: string; email: string; phone: string } }; relationship: string; relation_type: string }[]
  created_at: string
}

export interface PrintInfoResponse {
  students: StudentPrintInfo[]
  categories: { id: string; name: string }[]
  campus: { id: string; name: string } | null
}

export interface StudentImportRow {
  first_name: string
  father_name?: string
  grandfather_name?: string
  last_name: string
  email: string
  phone?: string
  gender?: 'male' | 'female' | 'other'
  date_of_birth?: string
  national_id?: string
  /** custom_fields[category_id][field_key] */
  custom_fields?: Record<string, Record<string, unknown>>
  /** "Whole school" import: this row's own grade/section, matched by name on the device. */
  grade_level_id?: string
  section_id?: string
  /** Row number in the file, echoed back on errors. */
  _row?: number
}

export interface StudentImportResult {
  success_count: number
  error_count: number
  errors: { row: number; error: string }[]
  created: { student_number: string; first_name: string; last_name: string; username?: string; password?: string }[]
}

export function adminStudentsApi(api: ApiClient) {
  const id = (v: string) => encodeURIComponent(v)
  return {
    list: (campusId: string | undefined, p: StudentListParams = {}) =>
      api.get<Student[]>(
        `/students${qs({
          campus_id: campusId,
          page: p.page,
          limit: p.limit,
          search: p.search,
          grade_level: p.grade_level,
          section_id: p.section_id,
          is_active: p.is_active === undefined ? undefined : String(p.is_active),
          has_siblings: p.has_siblings === undefined ? undefined : String(p.has_siblings),
          sort_key: p.sort_key,
          sort_dir: p.sort_dir,
        })}`,
      ),
    get: (campusId: string | undefined, studentId: string) => api.get<Student>(`/students/${id(studentId)}${qs({ campus_id: campusId })}`),
    getByNumber: (campusId: string | undefined, studentNumber: string) =>
      api.get<Student>(`/students/number/${id(studentNumber)}${qs({ campus_id: campusId })}`),
    create: (input: StudentInput) => api.post<Student>('/students', input),
    update: (campusId: string | undefined, studentId: string, input: Partial<StudentInput>) =>
      api.put<Student>(`/students/${id(studentId)}${qs({ campus_id: campusId })}`, input),
    remove: (studentId: string) => api.del<void>(`/students/${id(studentId)}`),
    /** Siblings (same linked parent) and linked parents, for the Family view. */
    relatives: (studentId: string) => api.get<StudentRelatives>(`/students/${id(studentId)}/relatives`),
    /** Admin/counselor-only family status (stripped for students and parents by the server). */
    setConfidentialStatus: (campusId: string | undefined, studentId: string, status: ConfidentialFamilyStatus) =>
      api.patch<Student>(`/students/${id(studentId)}/confidential-status${qs({ campus_id: campusId })}`, { status }),
    /** Activate/deactivate the selected students, a grade (optionally one section) or the whole campus. */
    bulkStatus: (campusId: string | undefined, input: { mode: 'selected' | 'grade' | 'school'; is_active: boolean; student_ids?: string[]; grade_level_id?: string; section_id?: string }) =>
      api.post<{ updated: number }>(`/students/bulk-status${qs({ campus_id: campusId })}`, { ...input, campus_id: campusId }),
    /** Current login username of a profile (web: EditCredentialsModal prefill). */
    username: (profileId: string) => api.get<{ username: string | null }>(`/credentials/${id(profileId)}/username`),
    /**
     * Create many students, all in one grade/section or (no target) each in its own row's grade/section.
     * Each row makes an account, so the timeout grows with size.
     */
    bulkImport: (campusId: string | undefined, rows: StudentImportRow[], target?: { gradeLevelId: string; sectionId?: string }) =>
      api.post<StudentImportResult>(
        '/students/bulk-import',
        { students: rows, grade_level_id: target?.gradeLevelId, section_id: target?.sectionId, campus_id: campusId },
        { timeout: Math.max(30_000, rows.length * 2_000) },
      ),
    /** Data for the printable student information sheets (selected categories only). */
    /** Flat rows for the advanced report (web: /teacher/students/advanced-report/results; admins, teachers, librarians). */
    report: (p: { page?: number; limit?: number } = {}) => api.get<Record<string, unknown>[]>(`/students/report${qs({ page: p.page ?? 1, limit: p.limit ?? 1000 })}`),
    printInfo: (campusId: string | undefined, studentIds: string[], categoryIds: string[]) =>
      api.post<PrintInfoResponse>('/students/print-info', { studentIds, categoryIds, campusId }),
  }
}
