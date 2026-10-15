// Year-end and semester rollover (school admin). Same endpoints as frontend/src/lib/api/rollover.ts;
// router: rollover.routes.ts (mounted at "/" with /rollover in its paths). These endpoints answer
// with the bare object instead of { data }, so the client moves the body into `data`.
import type { ApiClient } from '../../client'
import type { ApiResponse } from '../../types'

export interface RolloverPreview {
  current_year: string
  next_year: string
  students: { total_active: number; by_status: Record<string, number>; graduating: number }
  marking_periods: { current_year_total: number; next_year_existing: number }
  teachers: { current_assignments: number }
}

export interface RolloverCheck {
  is_valid: boolean
  error_message?: string
  warnings?: string[]
}

export interface RolloverResult {
  success: boolean
  error?: string
  duration_ms?: number
  students?: { promoted: number; retained: number; graduated: number; transferred: number; dropped: number; total: number }
  marking_periods?: { full_year: number; semesters: number; quarters: number; progress: number; total: number }
  teachers?: { assignments: number }
}

export interface SemesterRolloverPreview {
  students: { pending: number; promoted: number; retained: number; dropped: number; graduated: number; transferred: number; total_active: number }
}

export interface SemesterRolloverResult {
  success: boolean
  promoted: number
  retained: number
  dropped: number
  graduated: number
  transferred: number
  total: number
}

/** The whole body is the payload; strip the client's own fields back off. */
function bare<T>(r: ApiResponse<unknown>): ApiResponse<T> {
  if (!r.success) return r as ApiResponse<T>
  const { success: _s, status: _st, data: _d, ...body } = r as ApiResponse<unknown> & Record<string, unknown>
  return { success: true, status: r.status, data: body as T }
}

export function adminRolloverApi(api: ApiClient) {
  type YearPair = { current_year_id: string; next_year_id: string; school_id: string; campus_id?: string | null }
  return {
    check: async (body: YearPair) => bare<RolloverCheck>(await api.post('/rollover/check', body)),
    preview: async (body: YearPair) => bare<RolloverPreview>(await api.post('/rollover/preview', body)),
    /** `success` stays inside data: the RPC can answer 200 with success false. */
    execute: async (body: YearPair & { options: { students: boolean; marking_periods: boolean; teachers: boolean } }) => {
      const r = await api.post('/rollover/execute', body)
      if (!r.success) return r as ApiResponse<RolloverResult>
      const { status: _st, data: _d, ...rest } = r as ApiResponse<unknown> & Record<string, unknown>
      return { success: true, status: r.status, data: rest as unknown as RolloverResult }
    },
    semesterPreview: async (body: { academic_year_id: string; school_id: string; campus_id?: string }) => bare<SemesterRolloverPreview>(await api.post('/rollover/semester/preview', body)),
    semesterExecute: async (body: { academic_year_id: string; semester_end_date: string; school_id: string; campus_id?: string }) => {
      const r = await api.post('/rollover/semester/execute', body)
      if (!r.success) return r as ApiResponse<SemesterRolloverResult>
      const { status: _st, data: _d, ...rest } = r as ApiResponse<unknown> & Record<string, unknown>
      return { success: true, status: r.status, data: rest as unknown as SemesterRolloverResult }
    },
  }
}
