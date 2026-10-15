// Calculations and calculation reports (school admin). Same endpoints as
// frontend/src/lib/api/calculations.ts; router: calculations.routes.ts (mounted at "/").
import type { ApiClient } from '../../client'
import { qs } from '../../query'

export interface Calculation {
  id: string
  campus_id?: string | null
  title: string
  formula: string
  breakdown?: string | null
  created_at: string
}

export interface ReportCell {
  text?: string
  calculation_id?: string
  breakdown?: string
  show_graph?: boolean
}

export interface CalculationReport {
  id: string
  campus_id?: string | null
  title: string
  cells: ReportCell[][]
  created_at: string
}

export type CalcRunResult = { type: 'single'; value: number | string } | { type: 'breakdown'; rows: { label: string; value: number | string }[] }

export interface CalcRunFilters {
  campus_id?: string
  start_date?: string
  end_date?: string
  grade_level_id?: string
  section_id?: string
}

export function adminCalculationsApi(api: ApiClient) {
  const id = (v: string) => encodeURIComponent(v)
  return {
    list: (campusId?: string) => api.get<Calculation[]>(`/calculations${qs({ campus_id: campusId })}`),
    create: (body: { title: string; formula: string; breakdown?: string; campus_id?: string }) => api.post<Calculation>('/calculations', body),
    update: (calcId: string, body: { title?: string; formula?: string; breakdown?: string }) => api.put<Calculation>(`/calculations/${id(calcId)}`, body),
    remove: (calcId: string) => api.del<void>(`/calculations/${id(calcId)}`),
    run: (calcId: string, filters: CalcRunFilters) => api.post<CalcRunResult>(`/calculations/${id(calcId)}/run`, filters),
    /** Run an unsaved formula. */
    runFormula: (formula: string, filters: CalcRunFilters, breakdown?: string) => api.post<CalcRunResult>('/calculations/run', { formula, ...filters, ...(breakdown ? { breakdown } : {}) }),

    reports: (campusId?: string) => api.get<CalculationReport[]>(`/calculation-reports${qs({ campus_id: campusId })}`),
    createReport: (body: { title: string; cells: ReportCell[][]; campus_id?: string }) => api.post<CalculationReport>('/calculation-reports', body),
    updateReport: (reportId: string, body: { title?: string; cells?: ReportCell[][] }) => api.put<CalculationReport>(`/calculation-reports/${id(reportId)}`, body),
    removeReport: (reportId: string) => api.del<void>(`/calculation-reports/${id(reportId)}`),
    runReport: (reportId: string, filters: CalcRunFilters) => api.post<{ cells: ReportCell[][]; results: (CalcRunResult | null)[][] }>(`/calculation-reports/${id(reportId)}/run`, filters),
  }
}
