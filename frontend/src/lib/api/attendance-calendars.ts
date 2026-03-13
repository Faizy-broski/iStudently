import { getAuthToken } from './schools'
import { handleSessionExpiry } from '@/context/AuthContext'
import { API_URL } from '@/config/api'

interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// ---- Types ----

export interface AttendanceCalendar {
  id: string
  school_id: string
  campus_id?: string | null
  title: string
  is_default: boolean
  calendar_type: 'gregorian' | 'hijri'
  start_date: string
  end_date: string
  weekdays: boolean[]
  default_minutes: number
  academic_year_id?: string | null
  created_by?: string | null
  created_at: string
  updated_at: string
}

export interface CalendarDay {
  id: string
  school_id: string
  campus_id?: string | null
  calendar_id: string
  school_date: string
  is_school_day: boolean
  minutes: number
  block?: string | null
  notes?: string | null
  academic_year_id?: string | null
  created_at: string
}

export interface CalendarDaySummary {
  total_days: number
  school_days: number
  non_school_days: number
  total_minutes: number
}

export interface CreateCalendarInput {
  title: string
  calendar_type: 'gregorian' | 'hijri'
  start_date: string
  end_date: string
  weekdays?: boolean[]
  default_minutes?: number
  is_default?: boolean
  campus_id?: string | null
  academic_year_id?: string | null
  copy_from_calendar_id?: string | null
}

export interface UpdateCalendarInput {
  title?: string
  is_default?: boolean
  calendar_type?: 'gregorian' | 'hijri'
  start_date?: string
  end_date?: string
  weekdays?: boolean[]
  default_minutes?: number
  academic_year_id?: string | null
}

// ---- API Helper ----

async function apiRequest<T = unknown>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = await getAuthToken()

  if (!token) {
    return { success: false, error: 'Authentication required. Please sign in.' }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: { ...headers, ...options.headers },
    })

    const data = await response.json()

    if (response.status === 401) {
      await handleSessionExpiry()
      return { success: false, error: 'Session expired' }
    }

    if (!response.ok) {
      return { success: false, error: data.error || `Request failed with status ${response.status}` }
    }

    return data
  } catch {
    return { success: false, error: 'Network error. Please check your connection.' }
  }
}

// ---- Calendar CRUD ----

export async function getCalendars(campusId?: string): Promise<ApiResponse<AttendanceCalendar[]>> {
  const params = new URLSearchParams()
  if (campusId) params.append('campus_id', campusId)
  const qs = params.toString()
  return apiRequest<AttendanceCalendar[]>(`/attendance-calendars${qs ? `?${qs}` : ''}`)
}

export async function getCalendarById(id: string): Promise<ApiResponse<AttendanceCalendar>> {
  return apiRequest<AttendanceCalendar>(`/attendance-calendars/${id}`)
}

export async function createCalendar(data: CreateCalendarInput): Promise<ApiResponse<AttendanceCalendar>> {
  return apiRequest<AttendanceCalendar>('/attendance-calendars', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateCalendar(id: string, data: UpdateCalendarInput): Promise<ApiResponse<AttendanceCalendar>> {
  return apiRequest<AttendanceCalendar>(`/attendance-calendars/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function deleteCalendar(id: string): Promise<ApiResponse<{ deleted: boolean }>> {
  return apiRequest<{ deleted: boolean }>(`/attendance-calendars/${id}`, {
    method: 'DELETE',
  })
}

// ---- Calendar Days ----

export async function getCalendarDays(
  calendarId: string,
  startDate?: string,
  endDate?: string
): Promise<ApiResponse<CalendarDay[]>> {
  const params = new URLSearchParams()
  if (startDate) params.append('start_date', startDate)
  if (endDate) params.append('end_date', endDate)
  const qs = params.toString()
  return apiRequest<CalendarDay[]>(`/attendance-calendars/${calendarId}/days${qs ? `?${qs}` : ''}`)
}

export async function toggleCalendarDay(
  calendarId: string,
  dayId: string,
  isSchoolDay: boolean,
  minutes?: number
): Promise<ApiResponse<CalendarDay>> {
  return apiRequest<CalendarDay>(`/attendance-calendars/${calendarId}/days/${dayId}/toggle`, {
    method: 'PUT',
    body: JSON.stringify({ is_school_day: isSchoolDay, minutes }),
  })
}

export async function updateCalendarDay(
  calendarId: string,
  dayId: string,
  data: { is_school_day?: boolean; minutes?: number; notes?: string; block?: string }
): Promise<ApiResponse<CalendarDay>> {
  return apiRequest<CalendarDay>(`/attendance-calendars/${calendarId}/days/${dayId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function regenerateCalendar(calendarId: string): Promise<ApiResponse<{ days_created: number }>> {
  return apiRequest<{ days_created: number }>(`/attendance-calendars/${calendarId}/regenerate`, {
    method: 'POST',
  })
}

export async function getCalendarSummary(calendarId: string): Promise<ApiResponse<CalendarDaySummary>> {
  return apiRequest<CalendarDaySummary>(`/attendance-calendars/${calendarId}/summary`)
}

// ---- Schedule View (plugin: calendar_schedule_view) ----

export interface ScheduleViewEntry {
  id: string
  day_of_week: number        // 0=Mon … 6=Sun
  section_id: string
  section_name: string
  grade_name: string
  subject_name: string
  subject_code: string
  teacher_name: string
  period_number: number
  period_name: string | null
  start_time: string
  end_time: string
  room_number: string | null
  sort_order: number
}

export interface CalendarDaySchedule {
  id: string
  date: string
  is_school_day: boolean
  minutes: number
  block: string | null
  notes: string | null
  entries: ScheduleViewEntry[]
}

export interface ScheduleViewResponse {
  calendar_days: Record<string, CalendarDaySchedule>
  schedule_by_dow: Record<number, ScheduleViewEntry[]>
}

export async function getCalendarScheduleView(
  calendarId: string,
  params: {
    academic_year_id: string
    month: string        // "YYYY-MM"
    campus_id?: string | null
    section_id?: string
  }
): Promise<ApiResponse<ScheduleViewResponse>> {
  const qs = new URLSearchParams({ academic_year_id: params.academic_year_id, month: params.month })
  if (params.campus_id) qs.append('campus_id', params.campus_id)
  if (params.section_id) qs.append('section_id', params.section_id)
  return apiRequest<ScheduleViewResponse>(`/attendance-calendars/${calendarId}/schedule-view?${qs}`)
}
