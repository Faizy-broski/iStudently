import { getAuthToken } from './schools'
import { API_URL } from '@/config/api'

// ============================================================================
// SCHEDULING API CLIENT
// Student enrollment, class lists, teacher availability, conflict checks
// ============================================================================

interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

// ── Types ───────────────────────────────────────────────────────────────

export interface StudentSchedule {
  id: string
  student_id: string
  course_id: string
  course_period_id: string
  academic_year_id: string
  marking_period_id?: string | null
  start_date: string
  end_date?: string | null
  scheduler_lock: boolean
  course?: any
  course_period?: any
}

export interface ClassListEntry {
  schedule_id: string
  student_id: string
  student_name: string
  section_name?: string
  grade_level?: string
  start_date: string
  end_date?: string | null
  scheduler_lock: boolean
}

export interface ClassListResponse {
  course_period_id: string
  course_title: string
  teacher_name: string
  total_seats?: number | null
  filled_seats: number
  students: ClassListEntry[]
}

export interface ScheduleConflict {
  conflicting_schedule_id: string
  conflicting_course_period_id: string
  conflicting_course_title: string
  conflicting_period_title: string
  conflicting_day_of_week: number
}

export interface AddDropRecord {
  student_id: string
  student_name?: string
  course_title: string
  course_period_title?: string
  action: 'add' | 'drop'
  date: string
  enrolled_by?: string
}

export interface TeacherAvailabilityEntry {
  id: string
  teacher_id: string
  academic_year_id: string
  day_of_week: number
  period_id: string
  status: 'available' | 'unavailable' | 'preferred'
  reason?: string | null
  period?: any
}

export interface EnrollStudentDTO {
  student_id: string
  course_id: string
  course_period_id: string
  academic_year_id: string
  marking_period_id?: string
  start_date?: string
  campus_id?: string
}

export interface MassEnrollDTO {
  student_ids: string[]
  course_period_id: string
  course_id: string
  academic_year_id: string
  marking_period_id?: string
  start_date?: string
  campus_id?: string
}

// ── Helper ──────────────────────────────────────────────────────────────

async function authFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = await getAuthToken()
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  })

  const result: ApiResponse<T> = await response.json()
  if (!result.success) throw new Error(result.error || 'Request failed')
  return result.data as T
}

// ── Enrollment ──────────────────────────────────────────────────────────

export async function enrollStudent(dto: EnrollStudentDTO): Promise<StudentSchedule> {
  return authFetch<StudentSchedule>(`${API_URL}/scheduling/enroll`, {
    method: 'POST',
    body: JSON.stringify(dto),
  })
}

export async function dropStudent(studentId: string, coursePeriodId: string, endDate?: string): Promise<StudentSchedule> {
  return authFetch<StudentSchedule>(`${API_URL}/scheduling/drop`, {
    method: 'POST',
    body: JSON.stringify({ student_id: studentId, course_period_id: coursePeriodId, end_date: endDate }),
  })
}

export async function massEnroll(dto: MassEnrollDTO): Promise<{ enrolled: number; errors: string[] }> {
  return authFetch(`${API_URL}/scheduling/mass-enroll`, {
    method: 'POST',
    body: JSON.stringify(dto),
  })
}

export async function massDrop(studentIds: string[], coursePeriodId: string, endDate?: string): Promise<{ dropped: number; errors: string[] }> {
  return authFetch(`${API_URL}/scheduling/mass-drop`, {
    method: 'POST',
    body: JSON.stringify({ student_ids: studentIds, course_period_id: coursePeriodId, end_date: endDate }),
  })
}

// ── Student Schedule ────────────────────────────────────────────────────

export async function getStudentSchedule(studentId: string, academicYearId: string): Promise<StudentSchedule[]> {
  const params = new URLSearchParams({ academic_year_id: academicYearId })
  return authFetch<StudentSchedule[]>(`${API_URL}/scheduling/student/${studentId}?${params}`)
}

export async function getStudentScheduleHistory(studentId: string, academicYearId: string): Promise<StudentSchedule[]> {
  const params = new URLSearchParams({ academic_year_id: academicYearId })
  return authFetch<StudentSchedule[]>(`${API_URL}/scheduling/student/${studentId}/history?${params}`)
}

// ── Class List ──────────────────────────────────────────────────────────

export async function getClassList(coursePeriodId: string): Promise<ClassListResponse> {
  return authFetch<ClassListResponse>(`${API_URL}/scheduling/class-list/${coursePeriodId}`)
}

// ── Conflict Check ──────────────────────────────────────────────────────

export async function checkConflicts(
  studentId: string,
  coursePeriodId: string,
  academicYearId: string
): Promise<ScheduleConflict[]> {
  const params = new URLSearchParams({
    student_id: studentId,
    course_period_id: coursePeriodId,
    academic_year_id: academicYearId,
  })
  return authFetch<ScheduleConflict[]>(`${API_URL}/scheduling/check-conflicts?${params}`)
}

// ── Add/Drop Log ────────────────────────────────────────────────────────

export async function getAddDropLog(
  academicYearId: string,
  startDate?: string,
  endDate?: string,
  campusId?: string
): Promise<AddDropRecord[]> {
  const params = new URLSearchParams({ academic_year_id: academicYearId })
  if (startDate) params.set('start_date', startDate)
  if (endDate) params.set('end_date', endDate)
  if (campusId) params.set('campus_id', campusId)
  return authFetch<AddDropRecord[]>(`${API_URL}/scheduling/add-drop-log?${params}`)
}

// ── Course Period Scheduling Fields ─────────────────────────────────────

export async function updateCoursePeriodScheduling(
  coursePeriodId: string,
  dto: { total_seats?: number | null; room?: string | null; days?: string | null; gender_restriction?: string | null }
): Promise<any> {
  return authFetch(`${API_URL}/scheduling/course-period/${coursePeriodId}`, {
    method: 'PUT',
    body: JSON.stringify(dto),
  })
}

// ── Teacher Availability ────────────────────────────────────────────────

export async function getTeacherAvailability(teacherId: string, academicYearId: string): Promise<TeacherAvailabilityEntry[]> {
  const params = new URLSearchParams({ academic_year_id: academicYearId })
  return authFetch<TeacherAvailabilityEntry[]>(`${API_URL}/scheduling/teacher-availability/${teacherId}?${params}`)
}

export async function setTeacherAvailability(
  teacherId: string,
  academicYearId: string,
  entries: { day_of_week: number; period_id: string; status: string; reason?: string }[],
  campusId?: string
): Promise<TeacherAvailabilityEntry[]> {
  const params = campusId ? new URLSearchParams({ campus_id: campusId }) : ''
  return authFetch<TeacherAvailabilityEntry[]>(`${API_URL}/scheduling/teacher-availability?${params}`, {
    method: 'POST',
    body: JSON.stringify({ teacher_id: teacherId, academic_year_id: academicYearId, entries }),
  })
}

export async function getAvailableTeachersForSlot(
  academicYearId: string,
  dayOfWeek: number,
  periodId: string,
  campusId?: string
): Promise<{ teacher_id: string; status: string }[]> {
  const params = new URLSearchParams({
    academic_year_id: academicYearId,
    day_of_week: dayOfWeek.toString(),
    period_id: periodId,
  })
  if (campusId) params.set('campus_id', campusId)
  return authFetch(`${API_URL}/scheduling/available-teachers?${params}`)
}

// ── Dashboard Stats ──────────────────────────────────────────────────────

export interface SchedulingDashboardStats {
  total_courses: number
  total_subjects: number
  total_course_periods: number
  total_students_enrolled: number
  total_seats: number
  total_filled: number
}

export async function getSchedulingDashboardStats(
  academicYearId: string,
  markingPeriodId?: string
): Promise<SchedulingDashboardStats> {
  const params = new URLSearchParams({ academic_year_id: academicYearId })
  if (markingPeriodId) params.set('marking_period_id', markingPeriodId)
  return authFetch<SchedulingDashboardStats>(`${API_URL}/scheduling/dashboard-stats?${params}`)
}

// ── Course Period School Periods (multi-period) ──────────────────────────

export interface CoursePeriodSchoolPeriod {
  id: string
  course_period_id: string
  period_id: string
  days: string | null
  periods?: Record<string, unknown>
}

export async function getCoursePeriodSchoolPeriods(coursePeriodId: string) {
  return authFetch<CoursePeriodSchoolPeriod[]>(`${API_URL}/scheduling/course-period/${coursePeriodId}/school-periods`)
}

export async function setCoursePeriodSchoolPeriods(
  coursePeriodId: string,
  periodIds: string[],
  days?: string
) {
  return authFetch<{ updated: number }>(`${API_URL}/scheduling/course-period/${coursePeriodId}/school-periods`, {
    method: 'PUT',
    body: JSON.stringify({ period_ids: periodIds, days }),
  })
}
