// Ported from frontend/src/lib/api/student-dashboard.ts (types copied verbatim).
// Identity comes from the token: no student_id parameters (backend routes are zero-trust).
import type { ApiClient } from '../client'
import { qs } from '../query'

export interface TodayClass {
  id: string
  day_of_week: number
  start_time: string
  end_time: string
  room_number: string
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
}

export interface DueAssignment {
  id: string
  title: string
  description: string
  due_date: string
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
  submission: {
    id: string
    submitted_at: string
    marks_obtained: number | null
    feedback: string | null
    status: string
    submission_text?: string | null
    attachments?: { url: string; name: string; uploaded_at?: string }[] | null
  } | null
  /** Sent by /assignments (the full list), not by the dashboard's due-soon list. */
  assigned_date?: string | null
  assignment_type?: { title: string } | null
  file_url?: string | null
  enable_submission?: boolean
}

export interface RecentFeedback {
  id: string
  submitted_at: string
  marks_obtained: number
  feedback: string | null
  graded_at: string
  assignment: {
    id: string
    title: string
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
  }
}

export interface AttendanceSummary {
  totalDays: number
  presentDays: number
  absentDays: number
  lateDays: number
  percentage: number
}

export interface DashboardOverview {
  todayTimetable: TodayClass[]
  dueAssignments: DueAssignment[]
  recentFeedback: RecentFeedback[]
  attendanceSummary: AttendanceSummary
}

export interface AssignmentsByStatus {
  todo: DueAssignment[]
  submitted: DueAssignment[]
  graded: DueAssignment[]
}

export interface UpcomingExam {
  id: string
  title: string
  exam_date: string
  start_time: string
  end_time: string
  total_marks: number
  exam_type: string
  room_number: string
  instructions: string | null
  subject: {
    id: string
    name: string
    code: string
  }
  section: {
    id: string
    name: string
    grade_level: string
  }
}

export interface DigitalIdCard {
  id: string
  student_number: string
  admission_date: string
  grade_level: string
  status: string
  profile: {
    id: string
    first_name: string
    last_name: string
    email: string
    phone: string
    date_of_birth: string
    gender: string
    address: string
    photo_url: string | null
  }
  section: {
    id: string
    name: string
    grade_level: {
      id: string
      name: string
      level_order: number
    }
  }
  school: {
    id: string
    name: string
    logo_url: string | null
    address: string
    phone: string
  }
}

export interface SubjectAttendance {
  subject_id: string
  subject_name: string
  subject_code: string
  total: number
  present: number
  absent: number
  late: number
  excused: number
  percentage: number
}

export interface DetailedAttendanceRecord {
  id: string
  status: 'present' | 'absent' | 'late' | 'excused'
  attendance_date: string
  marked_at: string
  remarks?: string
  timetable_entry: {
    id: string
    day_of_week: number
    room_number?: string
    subject: {
      id: string
      name: string
      code: string
    }
    period: {
      id: string
      period_number: number
      period_name: string
      start_time: string
      end_time: string
    }
  }
}

export interface StudentGradeGroup {
  course_period_id: string
  subject: { id: string; name: string; code: string } | null
  total_assignments: number
  graded_count: number
  average: number | null
  letter_grade: string | null
  grades: Array<{
    id: string
    points: number | null
    letter_grade: string | null
    comment: string | null
    is_exempt: boolean
    is_late: boolean
    is_missing: boolean
    graded_at: string | null
    assignment: {
      id: string
      title: string
      points: number
      due_date: string | null
      assignment_type: { id: string; title: string; final_grade_percent: number } | null
    } | null
  }>
}

export interface StudentReportCard {
  subjects: Array<{
    subject: { id: string; name: string; code: string } | null
    course_period_id: string
    average: number | null
    letter_grade: string | null
    grade_count: number
  }>
  comments: Array<{
    id: string
    comment: { code: string; comment: string } | null
    marking_period_id: string | null
    course_period_id: string | null
  }>
}

export interface ClassPicturesData {
  course_periods: Array<{
    id: string
    title: string
    course_title: string | null
    teacher_name: string | null
    teacher_photo_url: string | null
  }>
  students: Array<{
    id: string
    student_number: string
    name: string
    photo_url: string | null
    is_self: boolean
  }>
}

export interface LessonPlanItem {
  id: string
  sort_order: number
  time_minutes?: number
  teacher_activity?: string
  learner_activity?: string
  formative_assessment?: string
  learning_materials?: string
}

export interface LessonPlanFile {
  id: string
  file_name: string
  file_url: string
  file_type?: string
}

export interface StudentLessonPlan {
  id: string
  title: string
  on_date: string
  lesson_number: number
  length_minutes?: number
  learning_objectives?: string
  evaluation?: string
  inclusiveness?: string
  course_period_id: string
  course_period: { id: string; title: string; course_title?: string; teacher_name?: string } | null
  items: LessonPlanItem[]
  files: LessonPlanFile[]
}

export interface StudentLessonPlansData {
  course_periods: Array<{ id: string; title: string; course_title?: string; teacher_name?: string | null }>
  lessons: StudentLessonPlan[]
}

export interface StudentInfo {
  id: string
  student_number: string
  grade_level: string
  admission_date: string
  first_name: string | null
  father_name: string | null
  grandfather_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  date_of_birth: string | null
  age: string | null
  gender: string | null
  address: string | null
  profile_photo_url: string | null
  section_name: string | null
  grade_level_name: string | null
  school_name: string | null
  school_address: string | null
  school_phone: string | null
}

export interface StudentFeeRecord {
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
}

export interface StudentPaymentRecord {
  id: string
  student_fee_id: string
  amount: number
  payment_method: string
  payment_reference?: string
  payment_date: string
  notes?: string
  received_by?: string
}

export interface StudentCourse {
  subject_id: string
  subject_name: string
  subject_code: string
  description?: string
  teacher_name: string
}

export interface SubjectFinalGrade {
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

export interface GpaRankData {
  gpa: number | null
  rank: number | null
  total_students: number | null
  percentage: number | null
  grade: string | null
}

export interface SubmitAssignmentDTO {
  assignment_id: string
  submission_text?: string
  attachments?: { url: string; name: string; uploaded_at: string }[]
}

export interface StudentReferral {
  id: string
  school_id: string
  incident_date: string
  /** Keyed by discipline field id. */
  field_values: Record<string, unknown> | null
  /** Field id → name for the fields this referral uses. */
  field_names?: Record<string, string>
  created_at: string
  reporter: { id: string; first_name: string | null; last_name: string | null } | null
}

export interface StudentActivityEnrollment {
  id: string
  created_at: string
  activity: { id: string; title: string; start_date: string | null; end_date: string | null; comment: string | null; is_active: boolean } | null
}

export interface StudentHostelAssignment {
  id: string
  check_in_date: string | null
  check_out_date: string | null
  notes: string | null
  room: {
    id: string
    room_number: string | null
    capacity: number | null
    floor: number | null
    room_type: string | null
    building: { id: string; name: string | null; gender: string | null } | null
  } | null
}

export interface PerformanceMetrics {
  overall: number
  attendance: number
  gradeAverage: number
  behavior: number
  assignments: number
}

export type StudentAssignmentStatus = 'todo' | 'submitted' | 'graded'


export function studentDashboardApi(api: ApiClient) {
  const base = '/student-dashboard'
  return {
    getDashboardOverview: () => api.get<DashboardOverview>(`${base}/overview`),
    getTodayTimetable: () => api.get<TodayClass[]>(`${base}/timetable/today`),
    getWeeklyTimetable: () => api.get<TodayClass[]>(`${base}/timetable/week`),
    getDueAssignments: () => api.get<DueAssignment[]>(`${base}/assignments/due`),
    getStudentAssignments: (status?: StudentAssignmentStatus) =>
      api.get<AssignmentsByStatus>(`${base}/assignments${qs({ status })}`),
    getRecentFeedback: (limit = 5) => api.get<RecentFeedback[]>(`${base}/feedback/recent${qs({ limit })}`),
    getAttendanceSummary: () => api.get<AttendanceSummary>(`${base}/attendance`),
    getSubjectWiseAttendance: (month?: string) =>
      api.get<SubjectAttendance[]>(`${base}/attendance/subjects${qs({ month })}`),
    getDetailedAttendance: (month?: number, year?: number) =>
      api.get<DetailedAttendanceRecord[]>(`${base}/attendance/detailed${qs({ month, year })}`),
    getUpcomingExams: () => api.get<UpcomingExam[]>(`${base}/exams/upcoming`),
    getDigitalIdCard: () => api.get<DigitalIdCard>(`${base}/profile/id-card`),
    getStudentGrades: () => api.get<StudentGradeGroup[]>(`${base}/grades`),
    getStudentClassDiary: () => api.get<unknown[]>(`${base}/class-diary`),
    getStudentDiscipline: () => api.get<StudentReferral[]>(`${base}/discipline`),
    getStudentActivities: () => api.get<StudentActivityEnrollment[]>(`${base}/activities`),
    /** Current hostel room assignment, or null. */
    getHostelAssignment: () => api.get<StudentHostelAssignment | null>(`${base}/hostel`),
    getStudentReportCard: (markingPeriodId?: string) =>
      api.get<StudentReportCard>(`${base}/report-card${qs({ marking_period_id: markingPeriodId })}`),
    getStudentClassPictures: () => api.get<ClassPicturesData>(`${base}/scheduling/class-pictures`),
    getStudentLessonPlans: (coursePeriodId?: string) =>
      api.get<StudentLessonPlansData>(`${base}/scheduling/lesson-plans${qs({ course_period_id: coursePeriodId })}`),
    getStudentInfo: () => api.get<StudentInfo>(`${base}/info`),
    getStudentFees: () => api.get<StudentFeeRecord[]>(`${base}/billing/fees`),
    getStudentPaymentHistory: () => api.get<StudentPaymentRecord[]>(`${base}/billing/payments`),
    getStudentCourses: () => api.get<StudentCourse[]>(`${base}/scheduling/courses`),
    getStudentFinalGrades: () => api.get<SubjectFinalGrade[]>(`${base}/grades/final`),
    getStudentGpaRank: () => api.get<GpaRankData>(`${base}/grades/gpa-rank`),
    submitAssignment: (dto: SubmitAssignmentDTO) => api.post(`${base}/assignments/submit`, dto),
    getPerformanceMetrics: () => api.get<PerformanceMetrics>(`${base}/performance`),
  }
}

export type StudentDashboardApi = ReturnType<typeof studentDashboardApi>
