import { apiRequest } from './index'

// ── Types ────────────────────────────────────────────────────────────────────

export interface WithdrawalDataPoint {
  date: string
  label: string
  count: number
  cumulative: number
}

export interface WithdrawalComparisonData {
  [yearName: string]: WithdrawalDataPoint[]
}

export interface WithdrawalSummary {
  total: number
  vsLastYear: number | null
  peakMonth: string | null
  trend: 'up' | 'down' | 'stable'
}

// ── API Functions ─────────────────────────────────────────────────────────────

export async function getWithdrawalCumulative(params: {
  academicYearId: string
  granularity?: 'annual' | 'semester'
  semester?: '1' | '2'
  campusId?: string
}) {
  const q = new URLSearchParams({ academicYearId: params.academicYearId })
  if (params.granularity) q.set('granularity', params.granularity)
  if (params.semester) q.set('semester', params.semester)
  if (params.campusId) q.set('campusId', params.campusId)
  return apiRequest<WithdrawalDataPoint[]>(`/analytics/withdrawal/cumulative?${q}`)
}

export async function getWithdrawalComparison(params: {
  academicYearIds: string[]
  granularity?: 'annual' | 'semester'
  campusId?: string
}) {
  const q = new URLSearchParams({ academicYearIds: params.academicYearIds.join(',') })
  if (params.granularity) q.set('granularity', params.granularity)
  if (params.campusId) q.set('campusId', params.campusId)
  return apiRequest<WithdrawalComparisonData>(`/analytics/withdrawal/comparison?${q}`)
}

export async function getWithdrawalSummary(params: {
  academicYearId: string
  campusId?: string
}) {
  const q = new URLSearchParams({ academicYearId: params.academicYearId })
  if (params.campusId) q.set('campusId', params.campusId)
  return apiRequest<WithdrawalSummary>(`/analytics/withdrawal/summary?${q}`)
}
