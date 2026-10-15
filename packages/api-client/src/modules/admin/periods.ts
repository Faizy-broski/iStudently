// Bell periods (school admin): list, bulk save, and the classes taught in one period.
// Same endpoints as frontend/src/app/admin/periods (inline fetch there); router: periods.routes.ts.
import type { ApiClient } from '../../client'
import { qs } from '../../query'

export interface BellPeriod {
  id: string
  title?: string
  period_name?: string
  short_name?: string
  sort_order?: number
  period_number?: number
  start_time?: string | null
  end_time?: string | null
  length_minutes?: number
  block?: string | null
  course_periods_count?: number
}

export interface BellPeriodInput {
  title: string
  short_name: string
  sort_order: number
  start_time: string | null
  end_time: string | null
  length_minutes: number
  block: string
}

export interface PeriodClass {
  id: string
  day_of_week: number
  day_name: string
  room_number: string | null
  section_id: string
  section_name: string
  grade_name: string
  subject_id: string
  subject_name: string
  subject_code: string
  teacher_id: string
  teacher_name: string
  period_title: string
  period_short_name: string
}

export function adminPeriodsApi(api: ApiClient) {
  return {
    list: (campusId?: string) => api.get<BellPeriod[]>(`/periods${qs({ campus_id: campusId })}`),
    saveBulk: (campusId: string | undefined, periods: BellPeriodInput[]) => api.post<BellPeriod[]>('/periods/bulk', { campus_id: campusId ?? null, periods }),
    byName: (shortName: string, campusId?: string) => api.get<BellPeriod>(`/periods/by-name/${encodeURIComponent(shortName)}${qs({ campus_id: campusId })}`),
    classesByName: (shortName: string, campusId?: string) => api.get<PeriodClass[]>(`/periods/by-name/${encodeURIComponent(shortName)}/classes${qs({ campus_id: campusId })}`),
  }
}
