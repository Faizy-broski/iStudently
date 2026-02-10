import { getAuthToken } from './schools'
import { simpleFetch } from './abortable-fetch'
import { handleSessionExpiry } from '@/context/AuthContext'
import { API_URL } from '@/config/api'

/**
 * API request wrapper with proper timeout
 */
async function apiRequest<T = unknown>(endpoint: string): Promise<T> {
  const token = await getAuthToken()

  if (!token) {
    throw new Error('Authentication required')
  }

  try {
    const response = await simpleFetch(`${API_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      timeout: 30000 // 30 second timeout
    })

    // Handle 401 Unauthorized - session expired
    if (response.status === 401) {
      await handleSessionExpiry()
      throw new Error('Session expired')
    }

    // Handle 403 Forbidden - permission error
    if (response.status === 403) {
      throw new Error('Permission denied')
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.error || 'Request failed')
    }

    const result = await response.json()
    if (!result.success) {
      throw new Error(result.error || 'Request failed')
    }

    return result.data
  } catch (error) {
    if (error instanceof Error && (error.message === 'Session expired' || error.message === 'Permission denied')) {
      throw error
    }
    throw new Error('Network error')
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

export interface SubjectAttendance {
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
  subjects: SubjectAttendance[]
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

export async function getTimetable(studentId: string): Promise<TimetableEntry[]> {
  return apiRequest<TimetableEntry[]>(`/api/parent-dashboard/timetable/${studentId}`)
}

export async function getSubjectWiseAttendance(studentId: string, month?: string): Promise<SubjectWiseAttendanceData> {
  const params = month ? `?month=${month}` : ''
  return apiRequest<SubjectWiseAttendanceData>(`/api/parent-dashboard/attendance/${studentId}/subject-wise${params}`)
}

export async function getDetailedAttendance(studentId: string, month?: number, year?: number, subjectName?: string): Promise<any[]> {
  const params = new URLSearchParams()
  if (month) params.append('month', month.toString())
  if (year) params.append('year', year.toString())
  if (subjectName) params.append('subject_name', subjectName)
  const queryString = params.toString() ? `?${params.toString()}` : ''
  return apiRequest<any[]>(`/api/parent-dashboard/attendance/${studentId}/detailed${queryString}`)
}

export async function getPaymentHistory(studentId: string): Promise<FeeWithPayments[]> {
  return apiRequest<FeeWithPayments[]>(`/api/parent-dashboard/fees/${studentId}/payment-history`)
}

export async function getStudentIdCard(studentId: string): Promise<StudentIdCardData> {
  return apiRequest<StudentIdCardData>(`/api/parent-dashboard/id-card/${studentId}`)
}

export async function getReportCard(studentId: string, academicYear?: string): Promise<ReportCardData> {
  const params = academicYear ? `?academic_year=${academicYear}` : ''
  return apiRequest<ReportCardData>(`/api/parent-dashboard/report-card/${studentId}${params}`)
}
