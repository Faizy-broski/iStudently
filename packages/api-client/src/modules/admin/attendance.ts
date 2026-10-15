// Attendance (school admin): codes, calendar, add absences, administration (daily/period grid,
// overrides, comments), reports (teacher completion, ADA, chart, daily summary grid, summary,
// print sheets, monthly sheet) and utilities (recalculate, generate range, duplicates).
// Same endpoints as frontend/src/lib/api/attendance.ts; router: attendance.routes.ts.
import type { ApiClient } from '../../client'
import { qs } from '../../query'

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
  created_at?: string
  updated_at?: string
}

export interface AttendanceCodeInput {
  school_id: string
  campus_id?: string | null
  title: string
  short_name: string
  state_code: AttendanceStateCode
  type?: AttendanceCodeType
  is_default?: boolean
  sort_order?: number
  color?: string
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
    periods: { id: string; period_name: string; period_number: number; start_time: string; end_time: string; length_minutes: number }
  }
}

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

export interface AddAbsencesInput {
  school_id: string
  campus_id?: string | null
  student_ids: string[]
  attendance_date: string
  period_ids: string[]
  attendance_code_id: string
  reason?: string
}

export interface ReportRangeParams {
  school_id: string
  start_date: string
  end_date: string
  campus_id?: string
  grade_id?: string
  section_id?: string
}

export interface CourseSheetsInput {
  school_id: string
  course_period_ids: string[]
  start_date: string
  end_date: string
  campus_id?: string
  include_inactive?: boolean
}

export type MonthlySheetStatus = 'P' | 'A' | 'EA' | 'L' | 'HD' | ''

export interface MonthlySheetTotals {
  totalPresent: number
  totalAbsentUnexcused: number
  totalAbsentExcused: number
  totalTardy: number
  totalHalfDay: number
  attendanceRate: number
}

export interface MonthlySheetModel {
  header: {
    logoUrl: string | null
    schoolName: string
    address: string
    title: string
    academicYear: string
    monthLabel: string
    groupLabel: string
    room: string
    supervisor: string
  }
  columns: { date: string; day: number; dow: number; dayName: string; isNonWorking: boolean; nonWorkingReason: 'weekend' | 'holiday' | null }[]
  workingDays: number
  rows: { id: string; number: string; name: string; cells: MonthlySheetStatus[]; totals: MonthlySheetTotals }[]
  legend: { code: string; en: string; ar: string }[]
  locale: 'en' | 'ar'
  mode: 'blank' | 'filled'
}

export interface MonthlySheetParams {
  scope: 'section' | 'grade' | 'staff'
  sectionId?: string
  gradeId?: string
  department?: string
  month: number
  year: number
  mode: 'blank' | 'filled'
  locale: 'en' | 'ar'
  campusId?: string
  supervisor?: string
  room?: string
}

function monthlySheetQuery(p: MonthlySheetParams) {
  return qs({
    scope: p?.scope,
    month: p?.month,
    year: p?.year,
    mode: p?.mode,
    locale: p?.locale,
    section_id: p?.sectionId,
    grade_id: p?.gradeId,
    department: p?.department,
    campus_id: p?.campusId,
    supervisor: p?.supervisor,
    room: p?.room,
  })
}

/** GET paths for binary downloads (fetched with the auth token and shared as files). */
export const attendanceDownloads = {
  summaryExport: (p: ReportRangeParams) => `/attendance/reports/summary/export${qs(p as any)}`,
  printSheets: (p: ReportRangeParams & { include_data?: boolean }) => `/attendance/reports/sheets${qs(p as any)}`,
  courseSheets: '/attendance/reports/sheets/course-periods',
  monthlySheetExcel: (p: MonthlySheetParams) => `/attendance/reports/monthly-sheet/excel${monthlySheetQuery(p)}`,
}

export function adminAttendanceApi(api: ApiClient) {
  return {
    // Codes
    getCodes: (schoolId: string, campusId?: string, includeInactive = false) =>
      api.get<AttendanceCode[]>(`/attendance/codes${qs({ school_id: schoolId, campus_id: campusId, include_inactive: includeInactive || undefined })}`),
    getCode: (id: string) => api.get<AttendanceCode>(`/attendance/codes/${id}`),
    createCode: (body: AttendanceCodeInput) => api.post<AttendanceCode>('/attendance/codes', body),
    updateCode: (id: string, body: Partial<AttendanceCode>) => api.put<AttendanceCode>(`/attendance/codes/${id}`, body),
    deleteCode: (id: string) => api.del<{ deleted: boolean }>(`/attendance/codes/${id}`),

    // Calendar
    getCalendar: (schoolId: string, startDate: string, endDate: string, campusId?: string) =>
      api.get<AttendanceCalendarDay[]>(`/attendance/calendar${qs({ school_id: schoolId, start_date: startDate, end_date: endDate, campus_id: campusId })}`),
    generateCalendar: (body: { school_id: string; academic_year_id: string; campus_id?: string | null }) =>
      api.post<{ days_created: number }>('/attendance/calendar/generate', body),
    updateCalendarDay: (id: string, body: { is_school_day?: boolean; minutes?: number; block?: string; notes?: string }) =>
      api.put<AttendanceCalendarDay>(`/attendance/calendar/${id}`, body),
    bulkUpdateCalendarDays: (dayIds: string[], body: { is_school_day?: boolean; minutes?: number; notes?: string }) =>
      api.put<{ updated: number }>('/attendance/calendar/bulk-update', { day_ids: dayIds, ...body }),
    getSchoolDayCount: (schoolId: string, startDate: string, endDate: string, campusId?: string) =>
      api.get<{ count: number; total_minutes: number }>(`/attendance/calendar/school-days${qs({ school_id: schoolId, start_date: startDate, end_date: endDate, campus_id: campusId })}`),

    // Add absences / overrides
    addAbsences: (body: AddAbsencesInput) => api.post<{ created: number; updated: number }>('/attendance/admin/add-absences', body),
    overrideRecord: (body: { attendance_record_id: string; attendance_code_id: string; override_reason: string }) =>
      api.post<{ success: boolean }>('/attendance/admin/override', body),

    // Administration
    getAdminView: (schoolId: string, date: string, sectionId?: string, gradeId?: string, campusId?: string) =>
      api.get<AttendanceDailyRecord[]>(`/attendance/admin/view${qs({ school_id: schoolId, date, section_id: sectionId, grade_id: gradeId, campus_id: campusId })}`),
    getStudentPeriods: (studentId: string, date: string) =>
      api.get<StudentPeriodRecord[]>(`/attendance/admin/student/${studentId}/periods${qs({ date })}`),
    getPeriodGrid: (schoolId: string, date: string, sectionId?: string, gradeId?: string, campusId?: string) =>
      api.get<any>(`/attendance/admin/period-grid${qs({ school_id: schoolId, date, section_id: sectionId, grade_id: gradeId, campus_id: campusId })}`),
    bulkOverride: (changes: { record_id: string; attendance_code_id: string }[]) =>
      api.post<{ updated: number }>('/attendance/admin/bulk-override', { changes }),
    updateDailyComment: (body: { school_id: string; student_id: string; date: string; comment: string }) =>
      api.post<{ success: boolean }>('/attendance/admin/daily-comment', body),

    // Reports
    getTeacherCompletion: (schoolId: string, date: string, campusId?: string, periodId?: string) =>
      api.get<TeacherCompletionStatus[]>(`/attendance/reports/teacher-completion${qs({ school_id: schoolId, date, campus_id: campusId, period_id: periodId })}`),
    getADA: (p: ReportRangeParams) => api.get<ADAReportRow[]>(`/attendance/reports/ada${qs(p as any)}`),
    getADAByGrade: (p: ReportRangeParams) => api.get<ADAGradeRow[]>(`/attendance/reports/ada-by-grade${qs(p as any)}`),
    getChart: (p: ReportRangeParams & { group_by?: 'day' | 'week' | 'month' }) =>
      api.get<AttendanceChartData>(`/attendance/reports/chart${qs({ group_by: 'day', ...(p as any) })}`),
    getDailySummaryGrid: (p: ReportRangeParams & { filter_mode?: string }) =>
      api.get<DailySummaryGridResponse>(`/attendance/reports/daily-summary-grid${qs({ filter_mode: 'daily', ...(p as any) })}`),
    getSummary: (p: ReportRangeParams) => api.get<AttendanceSummaryRow[]>(`/attendance/reports/summary${qs(p as any)}`),
    getCoursePeriods: (schoolId: string, campusId?: string) =>
      api.get<CoursePeriodItem[]>(`/attendance/reports/course-periods${qs({ school_id: schoolId, campus_id: campusId })}`),
    getMonthlySheet: (p: MonthlySheetParams) => api.get<MonthlySheetModel[]>(`/attendance/reports/monthly-sheet/data${monthlySheetQuery(p)}`),

    // Utilities
    recalculate: (body: { school_id: string; start_date: string; end_date: string; campus_id?: string }) =>
      api.post<{ recalculated: number }>('/attendance/utilities/recalculate', body),
    generateRange: (body: { from_date: string; to_date: string }) =>
      api.post<{ total_generated: number; days_processed: number }>('/attendance/utilities/generate-range', body),
    findDuplicates: (schoolId: string, startDate?: string, endDate?: string, campusId?: string) =>
      api.get<DuplicateAttendanceRecord[]>(`/attendance/utilities/duplicates${qs({ school_id: schoolId, start_date: startDate, end_date: endDate, campus_id: campusId })}`),
    deleteDuplicates: (body: { school_id: string; start_date?: string; end_date?: string; campus_id?: string }) =>
      api.post<{ deleted: number }>('/attendance/utilities/duplicates/delete', body),
  }
}
