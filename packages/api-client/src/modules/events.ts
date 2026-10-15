// Ported from frontend/src/lib/api/events.ts (types copied; the web's local `UserRole` is renamed
// EventAudienceRole to avoid clashing with @studently/shared-types). Bulk import takes CSV rows parsed on the device.
import type { ApiClient } from '../client'
import { qs } from '../query'

export type EventCategory = 'academic' | 'holiday' | 'exam' | 'meeting' | 'activity' | 'reminder'
export type EventAudienceRole = 'super_admin' | 'admin' | 'teacher' | 'student' | 'parent'

export interface SchoolEvent {
  id: string
  school_id: string
  campus_id?: string | null
  title: string
  description: string | null
  category: EventCategory
  start_at: string
  end_at: string
  is_all_day: boolean
  visible_to_roles: EventAudienceRole[]
  target_grades: string[] | null
  color_code: string
  send_reminder: boolean
  reminder_sent: boolean
  hijri_offset: number
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface CreateEventDTO {
  campus_id?: string | null
  title: string
  description?: string
  category: EventCategory
  start_at: string
  end_at: string
  is_all_day?: boolean
  visible_to_roles?: EventAudienceRole[]
  target_grades?: string[]
  color_code?: string
  send_reminder?: boolean
  hijri_offset?: number
}

export type UpdateEventDTO = Partial<CreateEventDTO>

export interface BulkEventRow {
  /** 1-based spreadsheet row number, echoed back in per-row errors */
  row: number
  title: string
  category: string
  start_date: string
  end_date?: string
  description?: string
  target_grades?: string[]
  color_code?: string
}

export interface EventFilters {
  category?: EventCategory
  start_date?: string
  end_date?: string
  user_role?: EventAudienceRole
  grade_level?: string
  campus_id?: string
  page?: number
  limit?: number
}

export function eventsApi(api: ApiClient) {
  const base = '/events'
  const id = (v: string) => encodeURIComponent(v)
  return {
    getEvents: (filters: EventFilters = {}) => api.get<SchoolEvent[]>(`${base}${qs({ ...filters })}`),
    getEventsForRange: (
      startDate: string,
      endDate: string,
      opts: { category?: EventCategory; user_role?: EventAudienceRole; campus_id?: string } = {},
    ) => api.get<SchoolEvent[]>(`${base}/range${qs({ start_date: startDate, end_date: endDate, ...opts })}`),
    getUpcomingEvents: (limit?: number, userRole?: EventAudienceRole) =>
      api.get<SchoolEvent[]>(`${base}/upcoming${qs({ limit, user_role: userRole })}`),
    getCategoryCounts: (startDate?: string, endDate?: string, campusId?: string) =>
      api.get<Record<EventCategory, number>>(
        `${base}/categories/counts${qs({ start_date: startDate, end_date: endDate, campus_id: campusId })}`,
      ),
    getEventById: (eventId: string) => api.get<SchoolEvent>(`${base}/${id(eventId)}`),
    createEvent: (data: CreateEventDTO) => api.post<SchoolEvent>(base, data),
    bulkCreateEvents: (body: { marking_period_id: string; campus_id?: string | null; events: BulkEventRow[] }) =>
      api.post<{ created: number; errors: { row: number; error: string }[] }>(`${base}/bulk`, body),
    updateEvent: (eventId: string, data: UpdateEventDTO) => api.put<SchoolEvent>(`${base}/${id(eventId)}`, data),
    deleteEvent: (eventId: string) => api.del<void>(`${base}/${id(eventId)}`),
    updateHijriOffset: (category: EventCategory, offset: number) =>
      api.patch<void>(`${base}/hijri-offset`, { category, offset }),
  }
}

export type EventsApi = ReturnType<typeof eventsApi>
