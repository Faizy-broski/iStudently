import { getAuthToken } from './schools'
import { abortableFetch } from './abortable-fetch'
import { handleSessionExpiry } from '@/context/AuthContext'
import { API_URL } from '@/config/api'

/**
 * API request wrapper with proper timeout, abort handling, and session management
 * Matches the pattern used in students.ts, teachers.ts, schools.ts, and fees.ts
 */
async function apiRequest<T = unknown>(endpoint: string): Promise<T> {
  const token = await getAuthToken()

  if (!token) {
    throw new Error('Authentication required')
  }

  try {
    const response = await abortableFetch(`${API_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      timeout: 30000 // 30 second timeout
    })

    // Handle 401 Unauthorized - session expired
    if (response.status === 401) {
      console.error('🔒 Session expired in parent-dashboard API')
      await handleSessionExpiry()
      throw new Error('Session expired. Please login again.')
    }

    // Handle 403 Forbidden - permission error
    if (response.status === 403) {
      throw new Error('Permission denied')
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.error || `Request failed: ${response.status}`)
    }

    const result = await response.json()
    if (!result.success) {
      throw new Error(result.error || 'Request failed')
    }

    return result.data
  } catch (error: any) {
    // Handle aborted requests gracefully
    if (error instanceof Error && error.message === 'Request was cancelled') {
      console.log('ℹ️ Parent dashboard request cancelled:', endpoint)
      throw new Error('Request cancelled')
    }
    throw error
  }
}

// Types
export interface ParentStudent {
  id: string
  student_number: string
  first_name: string
  last_name: string
  grade_level: string
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

export interface UpcomingExam {
  id: string
  exam_name: string
  subject: string
  date: string
  time?: string
  total_marks: number
  days_until: number
}

export interface RecentGrade {
  subject: string
  marks_obtained: number
  total_marks: number
  percentage: number
  grade: string
  exam_type: string
  date: string
}

export interface DashboardData {
  student: ParentStudent
  attendance_today: AttendanceToday
  fee_status: FeeStatus
  upcoming_exam: UpcomingExam | null
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
  status: 'pending' | 'submitted' | 'overdue'
  submission_date?: string
  teacher_name: string
}

// API Functions
export async function getStudents(): Promise<ParentStudent[]> {
  return apiRequest<ParentStudent[]>('/api/parent-dashboard/students')
}

export async function getDashboardData(studentId: string): Promise<DashboardData> {
  return apiRequest<DashboardData>(`/api/parent-dashboard/dashboard/${studentId}`)
}

export async function getAttendanceToday(studentId: string): Promise<AttendanceToday> {
  return apiRequest<AttendanceToday>(`/api/parent-dashboard/attendance/${studentId}/today`)
}

export async function getAttendanceHistory(studentId: string, days = 30): Promise<AttendanceRecord[]> {
  return apiRequest<AttendanceRecord[]>(`/api/parent-dashboard/attendance/${studentId}/history?days=${days}`)
}

export async function getFeeStatus(studentId: string): Promise<FeeStatus> {
  return apiRequest<FeeStatus>(`/api/parent-dashboard/fees/${studentId}/status`)
}

export async function getUpcomingExams(studentId: string, limit = 5): Promise<UpcomingExam[]> {
  return apiRequest<UpcomingExam[]>(`/api/parent-dashboard/exams/${studentId}/upcoming?limit=${limit}`)
}

export async function getRecentGrades(studentId: string, limit = 5): Promise<RecentGrade[]> {
  return apiRequest<RecentGrade[]>(`/api/parent-dashboard/grades/${studentId}/recent?limit=${limit}`)
}

export async function getGradebook(studentId: string): Promise<GradebookEntry[]> {
  return apiRequest<GradebookEntry[]>(`/api/parent-dashboard/gradebook/${studentId}`)
}

export async function getHomework(studentId: string, days = 7): Promise<HomeworkAssignment[]> {
  return apiRequest<HomeworkAssignment[]>(`/api/parent-dashboard/homework/${studentId}?days=${days}`)
}

export async function getHomeworkDiary(studentId: string, days = 7): Promise<HomeworkAssignment[]> {
  return apiRequest<HomeworkAssignment[]>(`/api/parent-dashboard/homework/${studentId}?days=${days}`)
}
