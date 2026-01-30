import { getAuthToken } from './schools'
import { API_URL } from '@/config/api'

interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

async function apiRequest<T = unknown>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = await getAuthToken()

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers
    },
    credentials: 'include'
  })

  return response.json()
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

export async function getSubjectWiseAttendance() {
  return apiRequest<SubjectAttendance[]>('/student-dashboard/attendance/subjects')
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
