// School admin: teachers (/teachers) and other staff (/staff). Both are `staff` rows with a profile.
// The list endpoints return { data, total, page, totalPages }; this module converts that to the
// usual `pagination` envelope so paged lists work the same everywhere.
import type { ApiResponse } from '../../types'
import type { ApiClient } from '../../client'
import { qs } from '../../query'

export type EmploymentType = 'full_time' | 'part_time' | 'contract'
export type PaymentType = 'fixed_salary' | 'hourly'
/** Which list: teachers, or a staff role filter of GET /staff. */
export type EmployeeKind = 'teacher' | 'staff' | 'librarian' | 'counselor' | 'media_officer' | 'fina_supervisor' | 'admin' | 'all' | 'employees'

export interface Employee {
  id: string
  profile_id: string
  school_id: string
  employee_number: string
  title: string | null
  department: string | null
  qualifications: string | null
  specialization: string | null
  date_of_joining: string | null
  employment_type: EmploymentType
  payment_type?: PaymentType
  is_active: boolean
  created_at: string
  updated_at: string
  role?: string
  profile?: {
    id: string
    first_name: string | null
    last_name: string | null
    email: string | null
    phone: string | null
    username?: string | null
    profile_photo_url?: string | null
    avatar_url?: string | null
    role?: string
    gender?: string | null
    date_of_birth?: string | null
  }
  custom_fields?: Record<string, any>
  base_salary?: number
  user_profile?: { id: string; name: string; base_role: string } | null
}

export interface EmployeeInput {
  employee_number?: string
  title?: string
  department?: string
  qualifications?: string
  specialization?: string
  date_of_joining?: string
  employment_type?: EmploymentType
  payment_type?: PaymentType
  is_active?: boolean
  first_name?: string
  last_name?: string
  email?: string
  phone?: string
  username?: string
  password?: string
  base_salary?: number
  gender?: 'male' | 'female' | 'other' | ''
  date_of_birth?: string
  profile_photo_url?: string
  /** Staff: a title of "Librarian" makes the account a librarian (server rule); otherwise staff. */
  campus_id?: string
  school_id?: string
  custom_fields?: Record<string, any>
}

export interface TeacherAssignment {
  id: string
  teacher_id: string
  subject_id: string
  section_id: string
  academic_year_id: string
  is_primary: boolean
  teacher_name?: string
  subject_name?: string
  section_name?: string
  grade_name?: string
  teacher?: { id: string; profile?: { first_name: string | null; last_name: string | null } }
  subject?: { id: string; name: string; code?: string }
  section?: { id: string; name: string; grade_level?: { id?: string; name: string } }
}

export interface EmployeeImportRow {
  employee_number?: string
  first_name: string
  last_name: string
  email: string
  phone?: string
  password?: string
  title?: string
  /** Staff only: explicit role (otherwise derived from the title). */
  role?: 'teacher' | 'librarian' | 'staff' | 'admin' | 'counselor'
  department?: string
  qualifications?: string
  specialization?: string
  date_of_joining?: string
  employment_type?: EmploymentType
  payment_type?: PaymentType
  base_salary?: number
  custom_fields?: Record<string, unknown>
}

export interface EmployeeImportResult {
  success_count: number
  error_count: number
  errors: { row: number; email?: string; error: string }[]
  /** Generated logins, when the server returns them (passwords are shown once). */
  created?: { row: number; id: string; email?: string; username?: string; password?: string }[]
}

type Paged = { data: Employee[]; total: number; page: number; totalPages: number }

function toPaged(res: ApiResponse<Paged>, limit: number): ApiResponse<Employee[]> {
  if (!res.success || !res.data) return { ...res, data: undefined } as ApiResponse<Employee[]>
  const { data, total, page, totalPages } = res.data
  return { success: true, status: res.status, data, pagination: { total, page, limit, totalPages } }
}

export function adminEmployeesApi(api: ApiClient) {
  const id = (v: string) => encodeURIComponent(v)
  const base = (kind: EmployeeKind) => (kind === 'teacher' ? '/teachers' : '/staff')
  return {
    list: async (kind: EmployeeKind, campusId: string | undefined, p: { page?: number; limit?: number; search?: string } = {}) => {
      const limit = p.limit ?? 30
      const role = kind === 'teacher' ? undefined : kind
      return toPaged(await api.get<Paged>(`${base(kind)}${qs({ page: p.page ?? 1, limit, search: p.search, role, campus_id: campusId })}`), limit)
    },
    /** Teachers and staff together (web: getAllStaff 'employees', used for staff payments). */
    allEmployees: async (campusId: string | undefined, limit = 1000) =>
      toPaged(await api.get<Paged>(`/staff${qs({ page: 1, limit, role: 'employees', campus_id: campusId })}`), limit),
    get: (kind: EmployeeKind, employeeId: string) => api.get<Employee>(`${base(kind)}/${id(employeeId)}`),
    create: (kind: EmployeeKind, input: EmployeeInput) => api.post<Employee>(base(kind), input),
    update: (kind: EmployeeKind, employeeId: string, input: Partial<EmployeeInput>) => api.put<Employee>(`${base(kind)}/${id(employeeId)}`, input),
    remove: (kind: EmployeeKind, employeeId: string) => api.del<void>(`${base(kind)}/${id(employeeId)}`),
    /** Create many teachers (kind 'teacher') or staff in one go. */
    bulkImport: (kind: 'teacher' | 'staff', campusId: string | undefined, rows: EmployeeImportRow[]) =>
      api.post<EmployeeImportResult>(kind === 'teacher' ? '/teachers/bulk-import' : '/staff/bulk-import', kind === 'teacher' ? { teachers: rows, campus_id: campusId } : { staff: rows, campus_id: campusId }, {
        timeout: Math.max(30_000, rows.length * 2_000),
      }),
    /** Teacher workload: which teacher teaches which subject to which section (per academic year). */
    assignments: (campusId: string | undefined, p: { teacher_id?: string; academic_year_id?: string } = {}) =>
      api.get<TeacherAssignment[]>(`/teachers/assignments${qs({ campus_id: campusId, teacher_id: p.teacher_id, academic_year_id: p.academic_year_id })}`),
    addAssignment: (campusId: string | undefined, input: { teacher_id: string; subject_id: string; section_id: string; academic_year_id: string; is_primary?: boolean }) =>
      api.post<TeacherAssignment>('/teachers/assignments', { ...input, campus_id: campusId }),
    removeAssignment: (assignmentId: string) => api.del<void>(`/teachers/assignments/${id(assignmentId)}`),
  }
}
