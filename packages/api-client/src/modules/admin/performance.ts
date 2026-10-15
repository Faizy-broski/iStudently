// Performance & efficiency (school admin): action catalog, staff incident logs and scores.
// Same endpoints as frontend/src/lib/api/performance.ts; router: performance.routes.ts.
import type { ApiClient } from '../../client'
import { qs } from '../../query'

export type PerformanceActionType = 'violation_demerit' | 'reward_redemption'
export type EscalationStage = 'none' | 'verbal_alert' | 'written_warning' | 'final_warning'

export interface PerformanceAction {
  id: string
  school_id: string
  action_name_ar: string
  action_name_en: string
  action_type: PerformanceActionType
  escalation_stage: EscalationStage
  default_points: number
  default_fine: number
  is_active: boolean
  sort_order: number
  created_at?: string
  updated_at?: string
}

export interface StaffPerformanceLog {
  id: string
  school_id: string
  campus_id?: string | null
  staff_id: string
  action_id: string
  academic_year_id?: string | null
  custom_points?: number | null
  custom_fine?: number | null
  notes?: string | null
  status: 'active' | 'redeemed' | 'archived'
  letter_generated: boolean
  salary_adjusted: boolean
  created_by: string
  created_at: string
  action?: PerformanceAction
  staff?: {
    id: string
    employee_number: string
    role?: string | null
    employment_type?: string | null
    department?: string | null
    profiles?: { first_name: string; last_name: string; profile_photo_url?: string | null }
  }
  reporter?: { first_name: string; last_name: string } | null
}

export interface PerformanceScore {
  score: number
  total_demerit: number
  total_redemption: number
  log_count: number
  breakdown: { log_id: string; date: string; name_ar: string; name_en: string; type: PerformanceActionType; escalation_stage: string; effective_points: number; effective_fine: number }[]
}

export interface PerformanceLogInput {
  staff_id: string
  action_id: string
  academic_year_id?: string
  campus_id?: string
  custom_points?: number | null
  custom_fine?: number | null
  notes?: string
}

export function adminPerformanceApi(api: ApiClient) {
  return {
    catalog: (activeOnly = false) => api.get<PerformanceAction[]>(`/performance/catalog${qs({ active_only: activeOnly || undefined })}`),
    createAction: (body: Partial<PerformanceAction>) => api.post<PerformanceAction>('/performance/catalog', body),
    updateAction: (id: string, body: Partial<PerformanceAction>) => api.put<PerformanceAction>(`/performance/catalog/${id}`, body),
    deleteAction: (id: string) => api.del(`/performance/catalog/${id}`),

    /** Every log matching the filters, unpaginated (web: getAllLogs). */
    allLogs: (p: { campusId?: string; startDate?: string; endDate?: string } = {}) =>
      api.get<StaffPerformanceLog[]>(`/performance/logs${qs({ campus_id: p.campusId, start_date: p.startDate, end_date: p.endDate, unpaginated: 'true' })}`),
    /** One staff member's latest logs (web: getLogs({ staffId, limit: 50 })). */
    staffLogs: (staffId: string, limit = 50) => api.get<StaffPerformanceLog[]>(`/performance/logs${qs({ staff_id: staffId, limit: String(limit) })}`),
    createLog: (body: PerformanceLogInput) => api.post<StaffPerformanceLog>('/performance/logs', body),
    deleteLog: (id: string) => api.del(`/performance/logs/${id}`),

    /** The signed-in teacher/staff member's own score (web: teacher dashboard + /teacher/performance). */
    myScore: () => api.get<PerformanceScore>('/performance/my-score'),
    staffScore: (staffId: string, academicYearId?: string) => api.get<PerformanceScore>(`/performance/score/${staffId}${qs({ academic_year_id: academicYearId })}`),
  }
}
