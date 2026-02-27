import { getAuthToken } from './schools'
import { handleSessionExpiry } from '@/context/AuthContext'
import { API_URL } from '@/config/api'

interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

async function apiRequest<T = unknown>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = await getAuthToken()
  if (!token) return { success: false, error: 'Authentication required.' }

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
    if (!response.ok) return { success: false, error: data?.error || `Request failed (${response.status})` }
    return data
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : 'Network error' }
  }
}

// ---- Types ----

export interface Calculation {
  id: string
  school_id: string
  campus_id?: string
  title: string
  formula: string
  breakdown?: string
  created_by?: string
  created_at: string
  updated_at: string
}

export interface ReportCell {
  text?: string
  calculation_id?: string
  breakdown?: string
  show_graph?: boolean
}

export interface CalculationReport {
  id: string
  school_id: string
  campus_id?: string
  title: string
  cells: ReportCell[][]
  created_by?: string
  created_at: string
  updated_at: string
}

export interface BreakdownRow {
  label: string
  value: number | string
}

export type RunResult =
  | { type: 'single'; value: number | string }
  | { type: 'breakdown'; rows: BreakdownRow[] }

export interface RunFilters {
  campus_id?: string
  start_date?: string
  end_date?: string
  grade_level_id?: string
  section_id?: string
}

export interface ReportRunResponse {
  cells: ReportCell[][]
  results: (RunResult | null)[][]
}

// ---- Calculations API ----

export async function getCalculations(campusId?: string): Promise<Calculation[]> {
  const qs = campusId ? `?campus_id=${campusId}` : ''
  const result = await apiRequest<Calculation[]>(`/calculations${qs}`)
  return result.data || []
}

export async function getCalculationById(id: string): Promise<Calculation | null> {
  const result = await apiRequest<Calculation>(`/calculations/${id}`)
  return result.data || null
}

export async function createCalculation(data: {
  title: string
  formula: string
  breakdown?: string
  campus_id?: string
}): Promise<Calculation | null> {
  const result = await apiRequest<Calculation>('/calculations', {
    method: 'POST',
    body: JSON.stringify(data),
  })
  return result.data || null
}

export async function updateCalculation(
  id: string,
  data: { title?: string; formula?: string; breakdown?: string }
): Promise<Calculation | null> {
  const result = await apiRequest<Calculation>(`/calculations/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
  return result.data || null
}

export async function deleteCalculation(id: string): Promise<boolean> {
  const result = await apiRequest(`/calculations/${id}`, { method: 'DELETE' })
  return result.success
}

export async function runCalculation(
  id: string,
  filters: RunFilters
): Promise<RunResult | null> {
  const result = await apiRequest<RunResult>(`/calculations/${id}/run`, {
    method: 'POST',
    body: JSON.stringify(filters),
  })
  return result.data || null
}

export async function runFormula(
  formula: string,
  filters: RunFilters,
  breakdown?: string
): Promise<RunResult | null> {
  const payload: any = { formula, ...filters }
  if (breakdown) payload.breakdown = breakdown
  const result = await apiRequest<RunResult>(`/calculations/run`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return result.data || null
}

// ---- Calculation Reports API ----

export async function getCalculationReports(campusId?: string): Promise<CalculationReport[]> {
  const qs = campusId ? `?campus_id=${campusId}` : ''
  const result = await apiRequest<CalculationReport[]>(`/calculation-reports${qs}`)
  return result.data || []
}

export async function getCalculationReportById(id: string): Promise<CalculationReport | null> {
  const result = await apiRequest<CalculationReport>(`/calculation-reports/${id}`)
  return result.data || null
}

export async function createCalculationReport(data: {
  title: string
  cells: ReportCell[][]
  campus_id?: string
}): Promise<CalculationReport | null> {
  const result = await apiRequest<CalculationReport>('/calculation-reports', {
    method: 'POST',
    body: JSON.stringify(data),
  })
  return result.data || null
}

export async function updateCalculationReport(
  id: string,
  data: { title?: string; cells?: ReportCell[][] }
): Promise<CalculationReport | null> {
  const result = await apiRequest<CalculationReport>(`/calculation-reports/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
  return result.data || null
}

export async function deleteCalculationReport(id: string): Promise<boolean> {
  const result = await apiRequest(`/calculation-reports/${id}`, { method: 'DELETE' })
  return result.success
}

export async function runCalculationReport(
  id: string,
  filters: RunFilters
): Promise<ReportRunResponse | null> {
  const result = await apiRequest<ReportRunResponse>(`/calculation-reports/${id}/run`, {
    method: 'POST',
    body: JSON.stringify(filters),
  })
  return result.data || null
}
