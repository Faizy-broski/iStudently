import { getAuthToken } from './schools'
import { handleSessionExpiry } from '@/context/AuthContext'
import { API_URL } from '@/config/api'

interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// ============================================================================
// TYPES
// ============================================================================

export type AttendanceStateCode = 'P' | 'A' | 'H'
export type AttendanceCodeType = 'teacher' | 'official' | 'both'

export interface AttendanceCode {
  id: string
  school_id: string
  campus_id?: string | null
  title: string
  short_name: string
  state_code: AttendanceStateCode
  type: AttendanceCodeType
  is_default: boolean
  sort_order: number
  color: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface AttendanceDailyRecord {
  id: string
  school_id: string
  campus_id?: string | null
  student_id: string
  attendance_date: string
  state_value: number
  total_minutes: number
  minutes_present: number
  comment?: string | null
  student_name?: string
  student_number?: string
  section_name?: string
  grade_name?: string
}

export interface AttendanceCalendarDay {
  id: string
  school_id: string
  campus_id?: string | null
  school_date: string
  is_school_day: boolean
  minutes: number
  block?: string | null
  notes?: string | null
  academic_year_id?: string | null
}

export interface TeacherCompletionStatus {
  staff_id: string
  staff_name: string
  periods: {
    period_id: string
    period_name: string
    period_number: number
    completed: boolean
    assigned: boolean
    courses?: { subject_name: string; section_name: string }[]
  }[]
  date: string
}

export interface ADAReportRow {
  date: string
  total_enrolled: number
  total_present: number
  total_absent: number
  total_half_day: number
  total_minutes_available: number
  total_minutes_present: number
  ada_percentage: number
}

export interface ADAGradeRow {
  grade_id: string
  grade_name: string
  students: number
  days_possible: number
  days_present: number
  days_absent: number
  ada: number
  avg_attendance: number
  avg_absent: number
}

export interface AttendanceChartData {
  labels: string[]
  present: number[]
  absent: number[]
  half_day: number[]
  ada: number[]
}

export interface AttendanceSummaryRow {
  student_id: string
  student_name: string
  student_number?: string
  section_name?: string
  grade_name?: string
  total_days: number
  days_present: number
  days_absent: number
  days_half: number
  total_minutes: number
  minutes_present: number
  attendance_percentage: number
  state_code_breakdown: Record<string, number>
}

export interface DailySummaryGridStudent {
  student_id: string
  student_name: string
  student_number?: string
  grade_name?: string
  dates: Record<string, number | null>
}

export interface DailySummaryGridResponse {
  school_dates: string[]
  students: DailySummaryGridStudent[]
}

export interface DuplicateAttendanceRecord {
  student_id: string
  student_name?: string
  attendance_date: string
  period_id: string
  period_name?: string
  count: number
  record_ids: string[]
}

export interface StudentPeriodRecord {
  id: string
  status: string
  attendance_code_id?: string
  admin_override: boolean
  override_by?: string
  override_reason?: string
  remarks?: string
  marked_at: string
  marked_by?: string
  attendance_codes?: AttendanceCode
  timetable_entries?: {
    id: string
    periods: {
      id: string
      period_name: string
      period_number: number
      start_time: string
      end_time: string
      length_minutes: number
    }
  }
}

// ============================================================================
// API REQUEST HELPER
// ============================================================================

async function apiRequest<T = unknown>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const token = await getAuthToken()
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {})
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers
    })

    const data = await response.json()

    if (response.status === 401) {
      await handleSessionExpiry()
      return { success: false, error: 'Session expired' }
    }

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `Request failed with status ${response.status}`
      }
    }

    return data
  } catch {
    return { success: false, error: 'Network error. Please check your connection.' }
  }
}

// ============================================================================
// ATTENDANCE CODES (SETUP)
// ============================================================================

export async function getAttendanceCodes(
  schoolId: string,
  campusId?: string,
  includeInactive = false
): Promise<ApiResponse<AttendanceCode[]>> {
  const params = new URLSearchParams({ school_id: schoolId })
  if (campusId) params.append('campus_id', campusId)
  if (includeInactive) params.append('include_inactive', 'true')
  return apiRequest<AttendanceCode[]>(`/attendance/codes?${params}`)
}

export async function getAttendanceCodeById(id: string): Promise<ApiResponse<AttendanceCode>> {
  return apiRequest<AttendanceCode>(`/attendance/codes/${id}`)
}

export async function createAttendanceCode(data: {
  school_id: string
  campus_id?: string | null
  title: string
  short_name: string
  state_code: AttendanceStateCode
  type?: AttendanceCodeType
  is_default?: boolean
  sort_order?: number
  color?: string
}): Promise<ApiResponse<AttendanceCode>> {
  return apiRequest<AttendanceCode>('/attendance/codes', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

export async function updateAttendanceCode(
  id: string,
  data: Partial<AttendanceCode>
): Promise<ApiResponse<AttendanceCode>> {
  return apiRequest<AttendanceCode>(`/attendance/codes/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
}

export async function deleteAttendanceCode(id: string): Promise<ApiResponse<{ deleted: boolean }>> {
  return apiRequest<{ deleted: boolean }>(`/attendance/codes/${id}`, {
    method: 'DELETE'
  })
}

// ============================================================================
// ATTENDANCE CALENDAR (Administration)
// ============================================================================

export async function getCalendar(
  schoolId: string,
  startDate: string,
  endDate: string,
  campusId?: string
): Promise<ApiResponse<AttendanceCalendarDay[]>> {
  const params = new URLSearchParams({
    school_id: schoolId,
    start_date: startDate,
    end_date: endDate
  })
  if (campusId) params.append('campus_id', campusId)
  return apiRequest<AttendanceCalendarDay[]>(`/attendance/calendar?${params}`)
}

export async function generateCalendar(data: {
  school_id: string
  academic_year_id: string
  campus_id?: string | null
}): Promise<ApiResponse<{ days_created: number }>> {
  return apiRequest<{ days_created: number }>('/attendance/calendar/generate', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

export async function updateCalendarDay(
  id: string,
  data: { is_school_day?: boolean; minutes?: number; block?: string; notes?: string }
): Promise<ApiResponse<AttendanceCalendarDay>> {
  return apiRequest<AttendanceCalendarDay>(`/attendance/calendar/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
}

export async function bulkUpdateCalendarDays(
  dayIds: string[],
  data: { is_school_day?: boolean; minutes?: number; notes?: string }
): Promise<ApiResponse<{ updated: number }>> {
  return apiRequest<{ updated: number }>('/attendance/calendar/bulk-update', {
    method: 'PUT',
    body: JSON.stringify({ day_ids: dayIds, ...data })
  })
}

export async function getSchoolDayCount(
  schoolId: string,
  startDate: string,
  endDate: string,
  campusId?: string
): Promise<ApiResponse<{ count: number; total_minutes: number }>> {
  const params = new URLSearchParams({
    school_id: schoolId,
    start_date: startDate,
    end_date: endDate
  })
  if (campusId) params.append('campus_id', campusId)
  return apiRequest<{ count: number; total_minutes: number }>(`/attendance/calendar/school-days?${params}`)
}

// ============================================================================
// ADD ABSENCES
// ============================================================================

export async function addAbsences(data: {
  school_id: string
  campus_id?: string | null
  student_ids: string[]
  attendance_date: string
  period_ids: string[]
  attendance_code_id: string
  reason?: string
}): Promise<ApiResponse<{ created: number; updated: number }>> {
  return apiRequest<{ created: number; updated: number }>('/attendance/admin/add-absences', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

export async function overrideAttendanceRecord(data: {
  attendance_record_id: string
  attendance_code_id: string
  override_reason: string
}): Promise<ApiResponse<{ success: boolean }>> {
  return apiRequest<{ success: boolean }>('/attendance/admin/override', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

// ============================================================================
// ADMINISTRATION (Admin View)
// ============================================================================

export async function getAdminAttendanceView(
  schoolId: string,
  date: string,
  sectionId?: string,
  gradeId?: string,
  campusId?: string
): Promise<ApiResponse<AttendanceDailyRecord[]>> {
  const params = new URLSearchParams({ school_id: schoolId, date })
  if (sectionId) params.append('section_id', sectionId)
  if (gradeId) params.append('grade_id', gradeId)
  if (campusId) params.append('campus_id', campusId)
  return apiRequest<AttendanceDailyRecord[]>(`/attendance/admin/view?${params}`)
}

export async function getStudentPeriodAttendance(
  studentId: string,
  date: string
): Promise<ApiResponse<StudentPeriodRecord[]>> {
  const params = new URLSearchParams({ date })
  return apiRequest<StudentPeriodRecord[]>(`/attendance/admin/student/${studentId}/periods?${params}`)
}

export async function getAdminPeriodGrid(
  schoolId: string,
  date: string,
  sectionId?: string,
  gradeId?: string,
  campusId?: string
): Promise<ApiResponse<any>> {
  const params = new URLSearchParams({ school_id: schoolId, date })
  if (sectionId) params.append('section_id', sectionId)
  if (gradeId) params.append('grade_id', gradeId)
  if (campusId) params.append('campus_id', campusId)
  return apiRequest<any>(`/attendance/admin/period-grid?${params}`)
}

export async function bulkOverrideAttendanceRecords(
  changes: { record_id: string; attendance_code_id: string }[]
): Promise<ApiResponse<{ updated: number }>> {
  return apiRequest<{ updated: number }>('/attendance/admin/bulk-override', {
    method: 'POST',
    body: JSON.stringify({ changes })
  })
}

export async function updateDailyComment(data: {
  school_id: string
  student_id: string
  date: string
  comment: string
}): Promise<ApiResponse<{ success: boolean }>> {
  return apiRequest<{ success: boolean }>('/attendance/admin/daily-comment', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

// ============================================================================
// REPORTS
// ============================================================================

export async function getTeacherCompletion(
  schoolId: string,
  date: string,
  campusId?: string,
  periodId?: string
): Promise<ApiResponse<TeacherCompletionStatus[]>> {
  const params = new URLSearchParams({ school_id: schoolId, date })
  if (campusId) params.append('campus_id', campusId)
  if (periodId) params.append('period_id', periodId)
  return apiRequest<TeacherCompletionStatus[]>(`/attendance/reports/teacher-completion?${params}`)
}

export async function getAverageDailyAttendance(
  schoolId: string,
  startDate: string,
  endDate: string,
  campusId?: string,
  gradeId?: string,
  sectionId?: string
): Promise<ApiResponse<ADAReportRow[]>> {
  const params = new URLSearchParams({
    school_id: schoolId,
    start_date: startDate,
    end_date: endDate
  })
  if (campusId) params.append('campus_id', campusId)
  if (gradeId) params.append('grade_id', gradeId)
  if (sectionId) params.append('section_id', sectionId)
  return apiRequest<ADAReportRow[]>(`/attendance/reports/ada?${params}`)
}

export async function getADAByGrade(
  schoolId: string,
  startDate: string,
  endDate: string,
  campusId?: string
): Promise<ApiResponse<ADAGradeRow[]>> {
  const params = new URLSearchParams({
    school_id: schoolId,
    start_date: startDate,
    end_date: endDate
  })
  if (campusId) params.append('campus_id', campusId)
  return apiRequest<ADAGradeRow[]>(`/attendance/reports/ada-by-grade?${params}`)
}

export async function getAttendanceChart(
  schoolId: string,
  startDate: string,
  endDate: string,
  campusId?: string,
  groupBy: 'day' | 'week' | 'month' = 'day'
): Promise<ApiResponse<AttendanceChartData>> {
  const params = new URLSearchParams({
    school_id: schoolId,
    start_date: startDate,
    end_date: endDate,
    group_by: groupBy
  })
  if (campusId) params.append('campus_id', campusId)
  return apiRequest<AttendanceChartData>(`/attendance/reports/chart?${params}`)
}

export async function getDailySummaryGrid(
  schoolId: string,
  startDate: string,
  endDate: string,
  campusId?: string,
  filterMode: string = 'daily',
  gradeId?: string,
  sectionId?: string
): Promise<ApiResponse<DailySummaryGridResponse>> {
  const params = new URLSearchParams({
    school_id: schoolId,
    start_date: startDate,
    end_date: endDate,
    filter_mode: filterMode
  })
  if (campusId) params.append('campus_id', campusId)
  if (gradeId) params.append('grade_id', gradeId)
  if (sectionId) params.append('section_id', sectionId)
  return apiRequest<DailySummaryGridResponse>(`/attendance/reports/daily-summary-grid?${params}`)
}

export async function getAttendanceSummary(
  schoolId: string,
  startDate: string,
  endDate: string,
  campusId?: string,
  gradeId?: string,
  sectionId?: string
): Promise<ApiResponse<AttendanceSummaryRow[]>> {
  const params = new URLSearchParams({
    school_id: schoolId,
    start_date: startDate,
    end_date: endDate
  })
  if (campusId) params.append('campus_id', campusId)
  if (gradeId) params.append('grade_id', gradeId)
  if (sectionId) params.append('section_id', sectionId)
  return apiRequest<AttendanceSummaryRow[]>(`/attendance/reports/summary?${params}`)
}

export function getPrintSheetsUrl(
  schoolId: string,
  startDate: string,
  endDate: string,
  sectionId?: string,
  gradeId?: string,
  campusId?: string,
  includeData = true
): string {
  const params = new URLSearchParams({
    school_id: schoolId,
    start_date: startDate,
    end_date: endDate,
    include_data: includeData.toString()
  })
  if (sectionId) params.append('section_id', sectionId)
  if (gradeId) params.append('grade_id', gradeId)
  if (campusId) params.append('campus_id', campusId)
  return `${API_URL}/attendance/reports/sheets?${params}`
}

export function getExportSummaryUrl(
  schoolId: string,
  startDate: string,
  endDate: string,
  campusId?: string,
  gradeId?: string,
  sectionId?: string
): string {
  const params = new URLSearchParams({
    school_id: schoolId,
    start_date: startDate,
    end_date: endDate
  })
  if (campusId) params.append('campus_id', campusId)
  if (gradeId) params.append('grade_id', gradeId)
  if (sectionId) params.append('section_id', sectionId)
  return `${API_URL}/attendance/reports/summary/export?${params}`
}

// ============================================================================
// COURSE PERIOD SHEETS (Print Attendance Sheets)
// ============================================================================

export interface CoursePeriodItem {
  id: string
  section_id: string
  period_id: string
  teacher_id: string | null
  label: string
  section_name: string
  subject_name: string
  period_title: string
  teacher_name: string
}

export async function getCoursePeriods(
  schoolId: string,
  campusId?: string
): Promise<ApiResponse<CoursePeriodItem[]>> {
  const params = new URLSearchParams({ school_id: schoolId })
  if (campusId) params.append('campus_id', campusId)
  return apiRequest<CoursePeriodItem[]>(`/attendance/reports/course-periods?${params}`)
}

export async function downloadCoursePeriodSheets(data: {
  school_id: string
  course_period_ids: string[]
  start_date: string
  end_date: string
  campus_id?: string
  include_inactive?: boolean
}): Promise<Blob> {
  const token = await getAuthToken()

  const resp = await fetch(`${API_URL}/attendance/reports/sheets/course-periods`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(data)
  })

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: 'Download failed' }))
    throw new Error(err.error || 'Download failed')
  }

  return resp.blob()
}

// ============================================================================
// UTILITIES
// ============================================================================

export async function recalculateDailyAttendance(data: {
  school_id: string
  start_date: string
  end_date: string
  campus_id?: string
}): Promise<ApiResponse<{ recalculated: number }>> {
  return apiRequest<{ recalculated: number }>('/attendance/utilities/recalculate', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

export async function findDuplicateAttendance(
  schoolId: string,
  startDate?: string,
  endDate?: string,
  campusId?: string
): Promise<ApiResponse<DuplicateAttendanceRecord[]>> {
  const params = new URLSearchParams({ school_id: schoolId })
  if (startDate) params.append('start_date', startDate)
  if (endDate) params.append('end_date', endDate)
  if (campusId) params.append('campus_id', campusId)
  return apiRequest<DuplicateAttendanceRecord[]>(`/attendance/utilities/duplicates?${params}`)
}

export async function deleteDuplicateAttendance(data: {
  school_id: string
  start_date?: string
  end_date?: string
  campus_id?: string
}): Promise<ApiResponse<{ deleted: number }>> {
  return apiRequest<{ deleted: number }>('/attendance/utilities/duplicates', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

// ============================================================================
// COMPLETION
// ============================================================================

export async function markAttendanceCompleted(data: {
  school_id: string
  staff_id?: string
  school_date: string
  period_id: string
  table_name?: number
}): Promise<ApiResponse<unknown>> {
  return apiRequest('/attendance/completion', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}
