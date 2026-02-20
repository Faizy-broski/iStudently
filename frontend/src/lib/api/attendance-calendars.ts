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
