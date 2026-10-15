// Attendance calendars (school days per calendar, Gregorian or Hijri), the schedule view and
// iCalendar links (school admin). Same endpoints as frontend/src/lib/api/{attendance-calendars,ical}.ts;
// routers: attendance-calendars.routes.ts, ical.routes.ts.
import type { ApiClient } from '../../client'
import { qs } from '../../query'

export type CalendarType = 'gregorian' | 'hijri'

export interface AttendanceCalendar {
  id: string
  school_id: string
  campus_id?: string | null
  title: string
  is_default: boolean
  calendar_type: CalendarType
  start_date: string
  end_date: string
  /** Sunday-first school days. */
  weekdays: boolean[]
  default_minutes: number
  academic_year_id?: string | null
  created_at: string
  updated_at: string
}

export interface CalendarDay {
  id: string
  calendar_id: string
  school_date: string
  is_school_day: boolean
  minutes: number
  block?: string | null
  notes?: string | null
}

export interface CalendarInput {
  title?: string
  calendar_type?: CalendarType
  start_date?: string
  end_date?: string
  weekdays?: boolean[]
  default_minutes?: number
  is_default?: boolean
  campus_id?: string | null
  academic_year_id?: string | null
  copy_from_calendar_id?: string | null
}

export interface ScheduleViewEntry {
  id: string
  /** 0 = Monday ... 6 = Sunday */
  day_of_week: number
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

export interface ScheduleViewResponse {
  calendar_days: Record<string, { id: string; date: string; is_school_day: boolean; minutes: number; block: string | null; notes: string | null; entries: ScheduleViewEntry[] }>
  schedule_by_dow: Record<number, ScheduleViewEntry[]>
}

export type ICalType = 'events' | 'schedule'

export function adminCalendarsApi(api: ApiClient) {
  const id = (v: string) => encodeURIComponent(v)
  return {
    list: (campusId?: string | null) => api.get<AttendanceCalendar[]>(`/attendance-calendars${qs({ campus_id: campusId ?? undefined })}`),
    create: (body: CalendarInput & { title: string; start_date: string; end_date: string }) => api.post<AttendanceCalendar>('/attendance-calendars', body),
    update: (calendarId: string, body: CalendarInput) => api.put<AttendanceCalendar>(`/attendance-calendars/${id(calendarId)}`, body),
    remove: (calendarId: string) => api.del<{ deleted: boolean }>(`/attendance-calendars/${id(calendarId)}`),
    days: (calendarId: string, startDate?: string, endDate?: string) =>
      api.get<CalendarDay[]>(`/attendance-calendars/${id(calendarId)}/days${qs({ start_date: startDate, end_date: endDate })}`),
    toggleDay: (calendarId: string, dayId: string, isSchoolDay: boolean, minutes?: number) =>
      api.put<CalendarDay>(`/attendance-calendars/${id(calendarId)}/days/${id(dayId)}/toggle`, { is_school_day: isSchoolDay, minutes }),
    scheduleView: (calendarId: string, p: { academic_year_id: string; month: string; campus_id?: string | null; section_id?: string }) =>
      api.get<ScheduleViewResponse>(`/attendance-calendars/${id(calendarId)}/schedule-view${qs({ academic_year_id: p.academic_year_id, month: p.month, campus_id: p.campus_id ?? undefined, section_id: p.section_id })}`),
    icalLink: (type: ICalType, campusId?: string | null) => api.get<{ url: string; token: string }>(`/ical/link${qs({ type, campus_id: campusId ?? undefined })}`),
  }
}
