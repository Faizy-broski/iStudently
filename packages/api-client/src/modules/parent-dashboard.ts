// Ported from frontend/src/lib/api/parent-dashboard.ts (types copied; names that clash with the
// student module are prefixed with "Parent"). Every call takes the child's id; the backend must
// check the child belongs to the signed-in parent (audit: docs/mobile/06-BACKEND-BACKLOG.md #8).
// Unlike the web module (which throws and returns bare data), this returns the shared envelope.
import type { ApiClient } from '../client'
import { qs } from '../query'
import type { StudentActivityEnrollment, StudentLessonPlansData, StudentReferral } from './student-dashboard'

export interface ParentStudent {
  id: string
  student_number: string
  first_name: string
  last_name: string
  grade_level: string
  grade_level_id?: string | null
  section: string
  campus_id: string
  campus_name: string
  profile_photo_url?: string
}

export interface AttendanceToday {
  status: 'present' | 'absent' | 'late' | 'excused' | 'not_marked'
  date: string
  marked_at?: string
}

export interface FeeStatus {
  total_due: number
  overdue_amount: number
  next_due_date?: string
  next_due_amount?: number
  unpaid_invoices: number
}

export interface ParentUpcomingExam {
  id: string
  exam_name: string
  subject: string
  date: string
  time?: string
  total_marks: number
  days_until: number
  exam_type?: string
}

export interface RecentGrade {
  subject: string
  marks_obtained: number
  total_marks: number
  percentage: number
  grade: string
  exam_type: string
  date: string
  exam_name?: string
}

export interface DashboardData {
  student: ParentStudent
  attendance_today: AttendanceToday
  fee_status: FeeStatus
  upcoming_exam: ParentUpcomingExam | null
  recent_grade: RecentGrade | null
}

export interface AttendanceRecord {
  date: string
  status: 'present' | 'absent' | 'late' | 'excused'
  marked_by?: string
}

export interface GradebookEntry {
  subject: string
  current_marks: number
  total_marks: number
  percentage: number
  grade: string
  assignments_submitted: number
  assignments_total: number
}

export interface HomeworkAssignment {
  id: string
  subject: string
  title: string
  description: string
  due_date: string
  assigned_date: string
  status: 'pending' | 'submitted' | 'graded' | 'overdue'
  submission_date?: string
  teacher_name: string
  marks_obtained?: number | null
  total_marks?: number | null
}

export interface TimetableEntry {
  id: string
  day_of_week: string
  subject_name: string
  subject_code?: string
  teacher_name: string
  period_number: number
  period_name?: string
  start_time: string
  end_time: string
  is_break: boolean
  room_number: string
}

export interface ParentSubjectAttendance {
  subject: string
  present: number
  absent: number
  late: number
  excused: number
  total: number
  attendance_rate: number
}

export interface SubjectWiseAttendanceData {
  month: string
  subjects: ParentSubjectAttendance[]
  overall: {
    present: number
    absent: number
    late: number
    excused: number
    total: number
    attendance_rate: number
  }
}

export interface FeePayment {
  id: string
  amount: number
  payment_method: string
  payment_reference?: string
  payment_date: string
  notes?: string
  received_by?: string
}

export interface FeeWithPayments {
  id: string
  fee_name: string
  category: string
  academic_year: string
  base_amount: number
  final_amount: number
  amount_paid: number
  balance: number
  status: string
  due_date: string
  payments: FeePayment[]
}

/** A class diary entry of the child's section (web: /parent/class-diary). */
export interface ClassDiaryEntry {
  id: string
  diary_date: string
  content: string
  is_published?: boolean
  enable_comments?: boolean
  teacher?: { profile?: { first_name: string; last_name: string } | null } | null
}

export interface ChildFeeRecord {
  id: string
  student_id: string
  balance: number
  final_amount: number
  amount_paid: number
  status: string
  due_date: string
  academic_year?: string
  student?: { id: string; student_number: string; grade_level: string | null; profile?: { first_name: string | null; last_name: string | null } }
  fee_structure?: { name?: string; category?: { name: string; code: string } }
}

export interface ChildFeesSummary {
  id: string
  name: string
  grade_level: string | null
  fees: ChildFeeRecord[]
}

/** GET /parents/my/children/fees: every linked child's invoices in one call. */
export interface ChildrenFeesResult {
  fees: ChildFeeRecord[]
  children: ChildFeesSummary[]
  totalDue: number
  totalOverdue: number
}

export interface StudentIdCardData {
  id?: string
  name?: string
  description?: string
  template_config?: {
    fields: any[]
    layout: { width: number; height: number; orientation: string }
    design: { backgroundColor: string; borderColor: string; borderWidth: number; borderRadius: number; backgroundImage?: string }
    qrCode?: { enabled: boolean; position: { x: number; y: number }; size: number; data: string }
  }
  student_data: Record<string, string>
}

export interface ExamResult {
  exam_name: string
  exam_type: string
  marks_obtained: number
  total_marks: number
  date: string
}

export interface SubjectReport {
  subject: string
  exams: ExamResult[]
  total_obtained: number
  total_possible: number
  percentage: number
  grade: string
}

export interface ReportCardData {
  student: {
    name: string
    student_number: string
    grade_level: string
    section: string
    school_name: string
  }
  subjects: SubjectReport[]
  overall: {
    total_obtained: number
    total_possible: number
    percentage: number
    grade: string
  }
  generated_at: string
}

export interface ChildBillingElement {
  id: string
  school_id: string
  student_id: string
  billing_element_id: string | null
  element_title: string
  amount: number
  due_date: string | null
  assigned_date: string
  comment: string | null
  amount_paid: number
  balance: number
  status: 'pending' | 'partial' | 'paid' | 'overdue' | 'waived'
  student_fee_id: string | null
  created_at: string
  updated_at: string
  category_title?: string
}

export interface ParentSubjectFinalGrade {
  subject_id: string
  subject_name: string
  subject_code: string
  total_obtained: number
  total_possible: number
  percentage: number
  grade: string
  exams: Array<{
    exam_name: string
    exam_type: string
    exam_date: string
    marks_obtained: number
    max_marks: number
  }>
}

export interface ParentGpaRankData {
  gpa: number | null
  rank: number | null
  total_students: number | null
  percentage: number | null
  grade: string | null
}

export interface StudentEnrollment {
  id: string
  start_date: string | null
  end_date: string | null
  academic_year: string | null
  school_name: string | null
}

export interface StudentInfoData {
  id: string
  student_number: string
  first_name: string
  last_name: string
  father_name: string | null
  grandfather_name: string | null
  email: string | null
  phone: string | null
  date_of_birth: string | null
  gender: string | null
  address: string | null
  profile_photo_url: string | null
  grade_level: string | null
  section_name: string | null
  admission_date: string | null
  blood_group: string | null
  campus_name: string | null
  age: { years: number; months: number; days: number } | null
  enrollments: StudentEnrollment[]
  custom_fields: Record<string, any> | null // eslint-disable-line @typescript-eslint/no-explicit-any
}

export interface AssignmentSubmission {
  id: string
  submitted_at: string
  marks_obtained: number | null
  feedback: string | null
  status: string
  submission_text?: string | null
  attachments?: { url: string; name: string; uploaded_at?: string }[] | null
}

export interface ParentAssignment {
  id: string
  title: string
  description: string
  due_date: string
  assigned_date?: string
  max_score: number
  subject: {
    id: string
    name: string
    code: string
  }
  teacher: {
    id: string
    profile: {
      first_name: string
      last_name: string
    }
  }
  submission: AssignmentSubmission | null
  assignment_type?: { title: string } | null
  file_url?: string | null
}

export interface ParentAssignmentsByStatus {
  todo: ParentAssignment[]
  submitted: ParentAssignment[]
  graded: ParentAssignment[]
}

export interface ParentStudentCourse {
  subject_id: string
  subject_name: string
  subject_code: string
  description: string
  teacher_name: string
}


export function parentDashboardApi(api: ApiClient) {
  const base = '/parent-dashboard'
  const id = (studentId: string) => encodeURIComponent(studentId)
  return {
    getStudents: () => api.get<ParentStudent[]>(`${base}/students`),
    getDashboardData: (studentId: string) => api.get<DashboardData>(`${base}/dashboard/${id(studentId)}`),
    getAttendanceToday: (studentId: string) => api.get<AttendanceToday>(`${base}/attendance/${id(studentId)}/today`),
    getAttendanceHistory: (studentId: string, days = 30) =>
      api.get<AttendanceRecord[]>(`${base}/attendance/${id(studentId)}/history${qs({ days })}`),
    getSubjectWiseAttendance: (studentId: string, month?: string) =>
      api.get<SubjectWiseAttendanceData>(`${base}/attendance/${id(studentId)}/subject-wise${qs({ month })}`),
    getDetailedAttendance: (studentId: string, month?: number, year?: number, subjectName?: string) =>
      api.get<unknown[]>(`${base}/attendance/${id(studentId)}/detailed${qs({ month, year, subject_name: subjectName })}`),
    getFeeStatus: (studentId: string) => api.get<FeeStatus>(`${base}/fees/${id(studentId)}/status`),
    getPaymentHistory: (studentId: string) => api.get<FeeWithPayments[]>(`${base}/fees/${id(studentId)}/payment-history`),
    getChildBillingElements: (studentId: string) =>
      api.get<ChildBillingElement[]>(`${base}/billing-elements/${id(studentId)}`),
    getUpcomingExams: (studentId: string, limit = 5) =>
      api.get<ParentUpcomingExam[]>(`${base}/exams/${id(studentId)}/upcoming${qs({ limit })}`),
    getRecentGrades: (studentId: string, limit = 5) =>
      api.get<RecentGrade[]>(`${base}/grades/${id(studentId)}/recent${qs({ limit })}`),
    getFinalGrades: (studentId: string) => api.get<ParentSubjectFinalGrade[]>(`${base}/grades/${id(studentId)}/final`),
    getGpaRank: (studentId: string) => api.get<ParentGpaRankData>(`${base}/grades/${id(studentId)}/gpa-rank`),
    getGradebook: (studentId: string) => api.get<GradebookEntry[]>(`${base}/gradebook/${id(studentId)}`),
    getHomework: (studentId: string, days = 7) =>
      api.get<HomeworkAssignment[]>(`${base}/homework/${id(studentId)}${qs({ days })}`),
    getTimetable: (studentId: string) => api.get<TimetableEntry[]>(`${base}/timetable/${id(studentId)}`),
    getStudentIdCard: (studentId: string) => api.get<StudentIdCardData>(`${base}/id-card/${id(studentId)}`),
    getReportCard: (studentId: string, academicYear?: string) =>
      api.get<ReportCardData>(`${base}/report-card/${id(studentId)}${qs({ academic_year: academicYear })}`),
    getStudentClassDiary: (studentId: string) => api.get<ClassDiaryEntry[]>(`${base}/class-diary/${id(studentId)}`),
    getStudentDiscipline: (studentId: string) => api.get<StudentReferral[]>(`${base}/discipline/${id(studentId)}`),
    getStudentEnrolledActivities: (studentId: string) => api.get<StudentActivityEnrollment[]>(`${base}/activities/${id(studentId)}`),
    getStudentInfo: (studentId: string) => api.get<StudentInfoData>(`${base}/student-info/${id(studentId)}`),
    getStudentAssignments: (studentId: string, status?: 'todo' | 'submitted' | 'graded') =>
      api.get<ParentAssignmentsByStatus>(`${base}/assignments/${id(studentId)}${qs({ status })}`),
    getStudentLessonPlans: (studentId: string, coursePeriodId?: string) =>
      api.get<StudentLessonPlansData>(
        `${base}/lesson-plans/${id(studentId)}${qs({ course_period_id: coursePeriodId })}`,
      ),
    getStudentCourses: (studentId: string) =>
      api.get<ParentStudentCourse[]>(`${base}/student-courses/${id(studentId)}`),
  }
}

export type ParentDashboardApi = ReturnType<typeof parentDashboardApi>
