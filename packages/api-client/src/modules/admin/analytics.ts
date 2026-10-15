// Withdrawal analytics (backend/src/routes/withdrawal-analytics.routes.ts). These take camelCase
// campusId, which the server's campus check also covers.
import type { ApiClient } from '../../client'
import { qs } from '../../query'

export interface WithdrawalPoint {
  date: string
  label: string
  count: number
  cumulative: number
}

export interface WithdrawalSummary {
  total: number
  vsLastYear: number | null
  peakMonth: string | null
  trend: 'up' | 'down' | 'stable'
}

export type ReportRole = 'student' | 'teacher' | 'staff' | 'librarian' | 'parent'

/** One person per row; standard fields at the top level, custom field values in custom_fields[key]. */
export type ReportRow = Record<string, unknown> & { id: string; custom_fields?: Record<string, unknown> }

export interface ReportFilters {
  grade_level_id?: string
  section_id?: string
  department?: string
  has_siblings?: boolean
  /** One person only (id from advancedReportSearch); the other filters are ignored then. */
  user_id?: string
}

/** A person found by name/number for the "specific person" filter. */
export interface ReportPersonOption {
  id: string
  label: string
  confidential_family_status?: string | null
}

export function adminAnalyticsApi(api: ApiClient) {
  return {
    withdrawalCumulative: (campusId: string | undefined, academicYearId: string, granularity?: 'annual' | 'semester', semester?: '1' | '2') =>
      api.get<WithdrawalPoint[]>(`/analytics/withdrawal/cumulative${qs({ academicYearId, granularity, semester: granularity === 'semester' ? semester : undefined, campusId })}`),
    /** Two (or more) years side by side, keyed by year name (web: getWithdrawalComparison). */
    withdrawalComparison: (campusId: string | undefined, academicYearIds: string[], granularity?: 'annual' | 'semester') =>
      api.get<Record<string, WithdrawalPoint[]>>(`/analytics/withdrawal/comparison${qs({ academicYearIds: ([] as string[]).concat(academicYearIds).join(','), granularity, campusId })}`),
    /** Advanced report (backend/src/routes/advanced-report.routes.ts). */
    advancedReport: (role: ReportRole, campusId: string | undefined, f: ReportFilters = {}) =>
      api.get<ReportRow[]>(
        `/advanced-report/${encodeURIComponent(role)}${qs({
          campus_id: campusId,
          grade_level_id: f.grade_level_id,
          section_id: f.section_id,
          department: f.department,
          has_siblings: f.has_siblings === undefined ? undefined : String(f.has_siblings),
          user_id: f.user_id,
          limit: 2000,
        })}`,
        { timeout: 60_000 },
      ),
    /** Up to 50 people of one role matching a name or number, within the grade/section/department filter. */
    advancedReportSearch: (role: ReportRole, campusId: string | undefined, f: { q?: string; grade_level_id?: string; section_id?: string; department?: string } = {}) =>
      api.get<ReportPersonOption[]>(
        `/advanced-report/${encodeURIComponent(role)}/search${qs({ q: f.q ?? '', campus_id: campusId, grade_level_id: f.grade_level_id, section_id: f.section_id, department: f.department })}`,
      ),
    withdrawalSummary: (campusId: string | undefined, academicYearId: string) =>
      api.get<WithdrawalSummary>(`/analytics/withdrawal/summary${qs({ academicYearId, campusId })}`),
  }
}
