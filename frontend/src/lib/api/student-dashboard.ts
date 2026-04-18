import { getAuthToken } from './schools'
import { simpleFetch } from './abortable-fetch'
import { API_URL } from '@/config/api'
import { handleSessionExpiry } from '@/context/AuthContext'

interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

async function apiRequest<T = unknown>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const token = await getAuthToken()

    if (!token) {
      return {
        success: false,
        error: 'Authentication required'
      }
    }

    const response = await simpleFetch(`${API_URL}${endpoint}`, {
      ...options,
      timeout: 25000,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options.headers
      },
      credentials: 'include'
    })

    // Handle 401 - session expired or invalid token
    if (response.status === 401) {
      await handleSessionExpiry()
      return {
        success: false,
        error: 'Session expired'
      }
    }

    return response.json()
  } catch {
    // Silent fail - no logging
    return {
      success: false,
      error: 'Network error'
    }
  }
}

// ============================================================================
// TYPES
// ============================================================================

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
  } | null
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

// ============================================================================
// STUDENT DASHBOARD API
// ============================================================================

/**
 * Get comprehensive dashboard overview
 */
export async function getDashboardOverview() {
  return apiRequest<DashboardOverview>('/student-dashboard/overview')
}

/**
 * Get today's timetable
 */
export async function getTodayTimetable() {
  return apiRequest<TodayClass[]>('/student-dashboard/timetable/today')
}

/**
 * Get weekly timetable
 */
export async function getWeeklyTimetable() {
  return apiRequest<TodayClass[]>('/student-dashboard/timetable/week')
}

/**
 * Get assignments due in next 48 hours
 */
export async function getDueAssignments() {
  return apiRequest<DueAssignment[]>('/student-dashboard/assignments/due')
}

/**
 * Get all assignments with optional status filter
 */
export async function getStudentAssignments(status?: 'todo' | 'submitted' | 'graded') {
  const query = status ? `?status=${status}` : ''
  return apiRequest<AssignmentsByStatus>(`/student-dashboard/assignments${query}`)
}

/**
 * Get recent feedback/grades
 */
export async function getRecentFeedback(limit: number = 5) {
  return apiRequest<RecentFeedback[]>(`/student-dashboard/feedback/recent?limit=${limit}`)
}

/**
 * Get attendance summary
 */
export async function getAttendanceSummary() {
  return apiRequest<AttendanceSummary>('/student-dashboard/attendance')
}

/**
 * Get subject-wise attendance breakdown
 */
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

export async function getSubjectWiseAttendance(month?: string) {
  const params = month ? `?month=${month}` : ''
  return apiRequest<SubjectAttendance[]>(`/student-dashboard/attendance/subjects${params}`)
}

/**
 * Get detailed attendance records
 */
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

export async function getDetailedAttendance(month?: number, year?: number) {
  const params = new URLSearchParams()
  if (month) params.append('month', month.toString())
  if (year) params.append('year', year.toString())
  const query = params.toString() ? `?${params.toString()}` : ''
  return apiRequest<DetailedAttendanceRecord[]>(`/student-dashboard/attendance/detailed${query}`)
}

/**
 * Get upcoming exams
 */
export async function getUpcomingExams() {
  return apiRequest<UpcomingExam[]>('/student-dashboard/exams/upcoming')
}

/**
 * Get digital ID card
 */
export async function getDigitalIdCard() {
  return apiRequest<DigitalIdCard>('/student-dashboard/profile/id-card')
}

// ============================================================================
// GRADES & REPORT CARD
// ============================================================================

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

export async function getStudentGrades() {
  return apiRequest<StudentGradeGroup[]>('/student-dashboard/grades')
}

export async function getStudentClassDiary() {
  return apiRequest<any[]>('/student-dashboard/class-diary')
}

export async function getStudentDiscipline() {
  return apiRequest<any[]>('/student-dashboard/discipline')
}

export async function getStudentActivities() {
  return apiRequest<any[]>('/student-dashboard/activities')
}

export async function getStudentReportCard(markingPeriodId?: string) {
  const q = markingPeriodId ? `?marking_period_id=${markingPeriodId}` : ''
  return apiRequest<StudentReportCard>(`/student-dashboard/report-card${q}`)
}

// ============================================================================
// BILLING (zero-trust: no student_id param, identity from JWT)
// ============================================================================

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

export async function getStudentClassPictures() {
  return apiRequest<ClassPicturesData>('/student-dashboard/scheduling/class-pictures')
}

export async function getStudentLessonPlans(coursePeriodId?: string) {
  const qs = coursePeriodId ? `?course_period_id=${encodeURIComponent(coursePeriodId)}` : ''
  return apiRequest<StudentLessonPlansData>(`/student-dashboard/scheduling/lesson-plans${qs}`)
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

export async function getStudentInfo() {
  return apiRequest<StudentInfo>('/student-dashboard/info')
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

export async function getStudentFees() {
  return apiRequest<StudentFeeRecord[]>('/student-dashboard/billing/fees')
}

export async function getStudentPaymentHistory() {
  return apiRequest<StudentPaymentRecord[]>('/student-dashboard/billing/payments')
}

// ============================================================================
// SCHEDULING
// ============================================================================

export interface StudentCourse {
  subject_id: string
  subject_name: string
  subject_code: string
  description?: string
  teacher_name: string
}

export async function getStudentCourses() {
  return apiRequest<StudentCourse[]>('/student-dashboard/scheduling/courses')
}

// ============================================================================
// GRADES DETAIL
// ============================================================================

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

export async function getStudentFinalGrades() {
  return apiRequest<SubjectFinalGrade[]>('/student-dashboard/grades/final')
}

export async function getStudentGpaRank() {
  return apiRequest<GpaRankData>('/student-dashboard/grades/gpa-rank')
}

/**
 * Submit assignment
 */
export interface SubmitAssignmentDTO {
  assignment_id: string
  student_id: string
  submission_text?: string
  attachments?: any[]
}

export async function submitAssignment(dto: SubmitAssignmentDTO) {
  return apiRequest('/assignments/submit', {
    method: 'POST',
    body: JSON.stringify(dto)
  })
}
