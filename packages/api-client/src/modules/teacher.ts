// Teacher role: own course periods and their students (backend/src/routes/teacher.routes.ts, /teachers).
import type { ApiClient } from '../client'
import { qs } from '../query'
import type { CoursePeriod } from './admin/courses'
import type { Payslip } from './admin/salary'

const id = (v: string) => encodeURIComponent(v)

/** One of the teacher's course periods, with course, section, period and marking period. */
export type TeacherCoursePeriod = CoursePeriod & {
  course?: { id: string; title: string; short_name?: string | null; credit_hours?: number | null; subject?: { id: string; name: string; code?: string | null } | null } | null
  section?: { id: string; name: string; grade_level?: { id: string; name: string } | null } | null
  period?: { id: string; period_name: string; period_number?: number | null; start_time?: string | null; end_time?: string | null } | null
  marking_period?: { id: string; title: string; short_name?: string | null; mp_type?: string | null } | null
  grading_scale?: { id: string; title: string; type?: string | null } | null
}

/** A student of the course period's section (active only). */
export interface TeacherCpStudent {
  id: string
  student_number: string
  section_id: string | null
  is_active: boolean
  /** Sent to staff allowed to see it (counselor rules on the server). */
  confidential_family_status?: string | null
  profile: { first_name: string | null; last_name: string | null; email?: string | null; phone?: string | null } | null
}

/** A comment code; teachers write only their own scales (staff_id = them), school-wide ones are read-only. */
export interface TeacherCommentCode {
  id: string
  scale_id: string
  school_id: string
  staff_id: string | null
  title: string
  short_name: string | null
  comment: string | null
  sort_order: number
  is_active: boolean
}

export interface TeacherCommentCodeScale {
  id: string
  school_id: string
  /** null = school-wide (read-only for the teacher). */
  staff_id: string | null
  title: string
  comment: string | null
  sort_order: number
  is_active: boolean
  codes?: TeacherCommentCode[]
}

/** A course period's assignment type (web: TeacherAssignments). */
export interface CpAssignmentType {
  id: string
  course_period_id?: string | null
  course_id: string
  title: string
  sort_order?: number | null
  color?: string | null
  school_id: string
}

/** A gradebook assignment of a course period + marking period. */
export interface GradebookAssignment {
  id: string
  assignment_type_id: string
  course_period_id: string
  marking_period_id: string
  title: string
  points: number
  default_points?: number | null
  weight?: number | null
  description?: string | null
  file_url?: string | null
  assigned_date: string | null
  due_date: string | null
  enable_submission: boolean
}

export type GradebookAssignmentInput = Omit<GradebookAssignment, 'id'>

/** One of the signed-in staff member's assigned salaries (web: /teacher/accounting/salaries). */
export interface OwnSalary {
  id: string
  title: string
  amount: number
  assigned_date: string
  due_date?: string | null
  comments?: string | null
  file_attached?: string | null
  academic_year?: string | null
}

/** A staff payment made to the signed-in staff member (web: /teacher/accounting/staff-payments). */
export interface OwnPayment {
  id: string
  title?: string | null
  amount: number
  payment_date?: string | null
  date?: string | null
  comments?: string | null
  file_attached?: string | null
}

/** A subject the teacher teaches in a section (web: /teacher/subjects). */
export interface TeacherSubjectAssignment {
  id: string
  subject_id: string
  section_id: string
  academic_year_id: string
  is_primary: boolean
  subject?: { id: string; name: string; code?: string | null } | null
  section?: { id: string; name: string; grade_level?: { id?: string; name: string } | null } | null
}

export function teacherApi(api: ApiClient) {
  return {
    /** The signed-in teacher's subject × section assignments. */
    mySubjects: (academicYearId?: string) => api.get<TeacherSubjectAssignment[]>(`/teachers/assignments${qs({ academic_year_id: academicYearId })}`),
    /** Web sidebar course period picker (AppSidebar): by academic year, never by quarter. */
    myCoursePeriods: (academicYearId?: string, markingPeriodId?: string) =>
      api.get<TeacherCoursePeriod[]>(`/teachers/my-course-periods${qs({ academic_year_id: academicYearId, marking_period_id: markingPeriodId })}`),
    myCoursePeriodStudents: (coursePeriodId: string) => api.get<TeacherCpStudent[]>(`/teachers/my-course-periods/${id(coursePeriodId)}/students`),

    /** Per-course-period gradebook overrides as key → string value (web: /teacher/grades/configuration). */
    gradebookConfig: (coursePeriodId?: string) => api.get<Record<string, string>>(`/gradebook/config${qs({ course_period_id: coursePeriodId })}`),
    saveGradebookConfig: (coursePeriodId: string, key: string, value: string) => api.put<void>('/gradebook/config', { course_period_id: coursePeriodId, key, value }),

    /** School-wide (read-only) and the teacher's own comment code scales (web: /teacher/grades/comment-codes). */
    commentCodes: () => api.get<TeacherCommentCodeScale[]>('/teachers/setup/comment-codes'),
    createCommentScale: (body: { title: string; comment?: string }) => api.post<TeacherCommentCodeScale>('/teachers/setup/comment-codes/scales', body),
    updateCommentScale: (scaleId: string, body: { title?: string; comment?: string | null }) => api.put<TeacherCommentCodeScale>(`/teachers/setup/comment-codes/scales/${id(scaleId)}`, body),
    deleteCommentScale: (scaleId: string) => api.del<void>(`/teachers/setup/comment-codes/scales/${id(scaleId)}`),
    createCommentCode: (scaleId: string, body: { title: string; short_name?: string; comment?: string; sort_order?: number }) =>
      api.post<TeacherCommentCode>(`/teachers/setup/comment-codes/scales/${id(scaleId)}/codes`, body),
    updateCommentCode: (codeId: string, body: { title?: string; short_name?: string | null; comment?: string | null; sort_order?: number }) =>
      api.put<TeacherCommentCode>(`/teachers/setup/comment-codes/${id(codeId)}`, body),
    deleteCommentCode: (codeId: string) => api.del<void>(`/teachers/setup/comment-codes/${id(codeId)}`),

    /** Gradebook assignment types and assignments of a course period (web: /teacher/grades/assignments). */
    cpAssignmentTypes: (coursePeriodId: string) => api.get<CpAssignmentType[]>(`/gradebook/assignment-types${qs({ course_period_id: coursePeriodId })}`),
    createCpAssignmentType: (body: { title: string; sort_order?: number; color?: string; course_period_id: string; course_id: string }) => api.post<CpAssignmentType>('/gradebook/assignment-types', body),
    updateCpAssignmentType: (typeId: string, body: { title?: string; sort_order?: number; color?: string }) => api.put<CpAssignmentType>(`/gradebook/assignment-types/${id(typeId)}`, body),
    staffAssignments: (coursePeriodId: string, markingPeriodId: string, assignmentTypeId?: string) =>
      api.get<GradebookAssignment[]>(`/gradebook/assignments/staff${qs({ course_period_id: coursePeriodId, marking_period_id: markingPeriodId, assignment_type_id: assignmentTypeId })}`),
    createAssignment: (body: Partial<GradebookAssignmentInput>) => api.post<GradebookAssignment>('/gradebook/assignments', body),
    updateAssignment: (assignmentId: string, body: Partial<GradebookAssignmentInput>) => api.put<GradebookAssignment>(`/gradebook/assignments/${id(assignmentId)}`, body),
    deleteAssignment: (assignmentId: string) => api.del<void>(`/gradebook/assignments/${id(assignmentId)}`),

    /** The signed-in staff member's own salaries, payments, pay stub and advance requests (zero-trust /accounting/staff routes). */
    ownSalaries: (campusId?: string, academicYear?: string) => api.get<OwnSalary[]>(`/accounting/staff/salaries${qs({ campus_id: campusId, academic_year: academicYear })}`),
    ownPayments: (campusId?: string, academicYear?: string) => api.get<OwnPayment[]>(`/accounting/staff/payments${qs({ campus_id: campusId, academic_year: academicYear })}`),
    myPayslip: (month: number, year: number) => api.get<Payslip>(`/accounting/staff/payslip${qs({ month, year })}`),
    requestAdvance: (body: { amount: number; reason?: string }) => api.post<unknown>('/accounting/staff/advances', body),
  }
}
