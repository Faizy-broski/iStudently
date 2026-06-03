import { getAuthToken } from './schools'
import { API_URL } from '@/config/api'

// ============================================================================
// SCHEDULE REQUESTS & TEMPLATES API CLIENT
// ============================================================================

interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

// ── Types ───────────────────────────────────────────────────────────────

export interface ScheduleRequest {
  id: string
  student_id: string
  course_id: string
  subject_id?: string | null
  academic_year_id: string
  marking_period_id?: string | null
  with_teacher_id?: string | null
  not_teacher_id?: string | null
  with_period_id?: string | null
  not_period_id?: string | null
  priority: number
  status: 'pending' | 'fulfilled' | 'unfilled' | 'cancelled'
  fulfilled_course_period_id?: string | null
  student?: any
  course?: any
  with_teacher?: any
  not_teacher?: any
  with_period?: any
  not_period?: any
  fulfilled_course_period?: any
}

export interface CreateScheduleRequestDTO {
  student_id: string
  course_id: string
  academic_year_id: string
  subject_id?: string
  marking_period_id?: string
  with_teacher_id?: string
  not_teacher_id?: string
  with_period_id?: string
  not_period_id?: string
  priority?: number
  campus_id?: string
}

export interface SchedulerResult {
  total_requests: number
  fulfilled: number
  unfilled: number
  errors: string[]
  details: {
    student_id: string
    course_id: string
    status: 'fulfilled' | 'unfilled'
    course_period_id?: string
    reason?: string
  }[]
}

export interface TimetableTemplate {
  id: string
  name: string
  description?: string | null
  grade_level_id?: string | null
  grade_level?: any
  entries?: any[]
  created_at: string
}

export interface Room {
  id: string
  name: string
  capacity?: number | null
  building?: string | null
  floor?: string | null
  room_type: string
  is_active: boolean
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

// ── Schedule Requests ───────────────────────────────────────────────────

export async function getScheduleRequests(
  academicYearId: string,
  filters?: { student_id?: string; course_id?: string; status?: string; campus_id?: string }
): Promise<ScheduleRequest[]> {
  const params = new URLSearchParams({ academic_year_id: academicYearId })
  if (filters?.student_id) params.set('student_id', filters.student_id)
  if (filters?.course_id) params.set('course_id', filters.course_id)
  if (filters?.status) params.set('status', filters.status)
  if (filters?.campus_id) params.set('campus_id', filters.campus_id)
  return authFetch<ScheduleRequest[]>(`${API_URL}/schedule-requests?${params}`)
}

export async function createScheduleRequest(dto: CreateScheduleRequestDTO): Promise<ScheduleRequest> {
  return authFetch<ScheduleRequest>(`${API_URL}/schedule-requests`, {
    method: 'POST',
    body: JSON.stringify(dto),
  })
}

export async function updateScheduleRequest(
  id: string,
  dto: Partial<Pick<ScheduleRequest, 'with_teacher_id' | 'not_teacher_id' | 'with_period_id' | 'not_period_id' | 'priority' | 'status'>>
): Promise<ScheduleRequest> {
  return authFetch<ScheduleRequest>(`${API_URL}/schedule-requests/${id}`, {
    method: 'PUT',
    body: JSON.stringify(dto),
  })
}

export async function deleteScheduleRequest(id: string): Promise<void> {
  return authFetch<void>(`${API_URL}/schedule-requests/${id}`, { method: 'DELETE' })
}

export async function massCreateRequests(
  studentIds: string[],
  courseId: string,
  academicYearId: string,
  options?: { marking_period_id?: string; campus_id?: string; priority?: number }
): Promise<{ created: number; errors: string[] }> {
  return authFetch(`${API_URL}/schedule-requests/mass`, {
    method: 'POST',
    body: JSON.stringify({
      student_ids: studentIds,
      course_id: courseId,
      academic_year_id: academicYearId,
      ...options,
    }),
  })
}

// ── Auto-Scheduler ──────────────────────────────────────────────────────

export async function runScheduler(options: {
  academic_year_id: string
  campus_id?: string
  marking_period_id?: string
  course_id?: string
  respect_teacher_availability?: boolean
  respect_room_capacity?: boolean
  respect_gender_restrictions?: boolean
  use_priority_ordering?: boolean
}): Promise<SchedulerResult> {
  return authFetch<SchedulerResult>(`${API_URL}/schedule-requests/run-scheduler`, {
    method: 'POST',
    body: JSON.stringify(options),
  })
}

// ── Templates ───────────────────────────────────────────────────────────

export async function getTemplates(campusId?: string): Promise<TimetableTemplate[]> {
  const params = campusId ? new URLSearchParams({ campus_id: campusId }) : ''
  return authFetch<TimetableTemplate[]>(`${API_URL}/schedule-requests/templates?${params}`)
}

export async function createTemplate(dto: {
  name: string
  description?: string
  grade_level_id?: string
  campus_id?: string
  entries?: { subject_id?: string; period_id?: string; day_of_week: number; room_id?: string; teacher_id?: string }[]
}): Promise<TimetableTemplate> {
  return authFetch<TimetableTemplate>(`${API_URL}/schedule-requests/templates`, {
    method: 'POST',
    body: JSON.stringify(dto),
  })
}

export async function saveTemplateFromSection(dto: {
  name: string
  description?: string
  section_id: string
  academic_year_id: string
  campus_id?: string
}): Promise<TimetableTemplate> {
  return authFetch<TimetableTemplate>(`${API_URL}/schedule-requests/templates/from-section`, {
    method: 'POST',
    body: JSON.stringify(dto),
  })
}

export async function applyTemplate(dto: {
  template_id: string
  section_id: string
  academic_year_id: string
  clear_existing?: boolean
}): Promise<{ entries_created: number }> {
  return authFetch(`${API_URL}/schedule-requests/templates/apply`, {
    method: 'POST',
    body: JSON.stringify(dto),
  })
}

export async function deleteTemplate(id: string): Promise<void> {
  return authFetch<void>(`${API_URL}/schedule-requests/templates/${id}`, { method: 'DELETE' })
}

// ── Rooms ───────────────────────────────────────────────────────────────

export async function getRooms(campusId?: string, activeOnly = true): Promise<Room[]> {
  const params = new URLSearchParams()
  if (campusId) params.set('campus_id', campusId)
  if (!activeOnly) params.set('active_only', 'false')
  return authFetch<Room[]>(`${API_URL}/rooms?${params}`)
}

export async function createRoom(dto: {
  name: string
  campus_id?: string
  capacity?: number
  building?: string
  floor?: string
  room_type?: string
}): Promise<Room> {
  return authFetch<Room>(`${API_URL}/rooms`, {
    method: 'POST',
    body: JSON.stringify(dto),
  })
}

export async function updateRoom(id: string, dto: Partial<Room>): Promise<Room> {
  return authFetch<Room>(`${API_URL}/rooms/${id}`, {
    method: 'PUT',
    body: JSON.stringify(dto),
  })
}

export async function deleteRoom(id: string): Promise<void> {
  return authFetch<void>(`${API_URL}/rooms/${id}`, { method: 'DELETE' })
}

export async function checkRoomAvailability(
  roomId: string,
  dayOfWeek: number,
  periodId: string,
  academicYearId: string,
  excludeEntryId?: string
): Promise<{ available: boolean; conflicting_entry?: any }> {
  const params = new URLSearchParams({
    room_id: roomId,
    day_of_week: dayOfWeek.toString(),
    period_id: periodId,
    academic_year_id: academicYearId,
  })
  if (excludeEntryId) params.set('exclude_entry_id', excludeEntryId)
  return authFetch(`${API_URL}/rooms/check-availability?${params}`)
}
