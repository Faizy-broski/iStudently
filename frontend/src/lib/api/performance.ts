import { getAuthToken } from './schools'
import { getImpersonationHeaders } from './abortable-fetch'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

// ─── Types (mirrors backend) ──────────────────────────────────────────────────

export interface PerformanceActionLookup {
  id: string
  school_id: string
  action_name_ar: string
  action_name_en: string
  action_type: 'violation_demerit' | 'reward_redemption'
  escalation_stage: 'none' | 'verbal_alert' | 'written_warning' | 'final_warning'
  default_points: number
  default_fine: number
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
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
  action?: PerformanceActionLookup
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
  breakdown: {
    log_id: string
    date: string
    name_ar: string
    name_en: string
    type: 'violation_demerit' | 'reward_redemption'
    escalation_stage: string
    effective_points: number
    effective_fine: number
  }[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function authHeaders(): Promise<HeadersInit> {
  const token = await getAuthToken()
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...getImpersonationHeaders(),
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<{ success: boolean; data?: T; error?: string; pagination?: { total: number } }> {
  const res  = await fetch(`${API}/api${path}`, init)
  const json = await res.json()
  return json
}

// ─── Catalog ──────────────────────────────────────────────────────────────────

export async function getCatalog(activeOnly = false): Promise<PerformanceActionLookup[]> {
  const headers = await authHeaders()
  const r = await apiFetch<PerformanceActionLookup[]>(
    `/performance/catalog${activeOnly ? '?active_only=true' : ''}`,
    { headers }
  )
  if (!r.success) throw new Error(r.error)
  return r.data ?? []
}

export async function createAction(data: Partial<PerformanceActionLookup>): Promise<PerformanceActionLookup> {
  const headers = await authHeaders()
  const r = await apiFetch<PerformanceActionLookup>('/performance/catalog', {
    method: 'POST', headers, body: JSON.stringify(data),
  })
  if (!r.success) throw new Error(r.error)
  return r.data!
}

export async function updateAction(id: string, data: Partial<PerformanceActionLookup>): Promise<PerformanceActionLookup> {
  const headers = await authHeaders()
  const r = await apiFetch<PerformanceActionLookup>(`/performance/catalog/${id}`, {
    method: 'PUT', headers, body: JSON.stringify(data),
  })
  if (!r.success) throw new Error(r.error)
  return r.data!
}

export async function deleteAction(id: string): Promise<void> {
  const headers = await authHeaders()
  const r = await apiFetch(`/performance/catalog/${id}`, { method: 'DELETE', headers })
  if (!r.success) throw new Error(r.error)
}

// ─── Logs ────────────────────────────────────────────────────────────────────

export async function getLogs(params: {
  staffId?: string
  academicYearId?: string
  campusId?: string
  startDate?: string
  endDate?: string
  page?: number
  limit?: number
}): Promise<{ data: StaffPerformanceLog[]; total: number }> {
  const headers = await authHeaders()
  const qs = new URLSearchParams()
  if (params.staffId)        qs.set('staff_id', params.staffId)
  if (params.academicYearId) qs.set('academic_year_id', params.academicYearId)
  if (params.campusId)       qs.set('campus_id', params.campusId)
  if (params.startDate)      qs.set('start_date', params.startDate)
  if (params.endDate)        qs.set('end_date', params.endDate)
  if (params.page)           qs.set('page', String(params.page))
  if (params.limit)          qs.set('limit', String(params.limit))

  const r = await apiFetch<StaffPerformanceLog[]>(`/performance/logs?${qs}`, { headers })
  if (!r.success) throw new Error(r.error)
  return { data: r.data ?? [], total: r.pagination?.total ?? 0 }
}

// Unpaginated fetch for report pages — mirrors getAllDisciplineReferrals in lib/api/discipline.ts
export async function getAllLogs(params: {
  campusId?: string
  startDate?: string
  endDate?: string
}): Promise<{ data: StaffPerformanceLog[] }> {
  const headers = await authHeaders()
  const qs = new URLSearchParams()
  if (params.campusId)  qs.set('campus_id', params.campusId)
  if (params.startDate) qs.set('start_date', params.startDate)
  if (params.endDate)   qs.set('end_date', params.endDate)
  qs.set('unpaginated', 'true')

  const r = await apiFetch<StaffPerformanceLog[]>(`/performance/logs?${qs}`, { headers })
  if (!r.success) throw new Error(r.error)
  return { data: r.data ?? [] }
}

export async function createLog(data: {
  staff_id: string
  action_id: string
  academic_year_id?: string
  campus_id?: string
  custom_points?: number | null
  custom_fine?: number | null
  notes?: string
}): Promise<StaffPerformanceLog> {
  const headers = await authHeaders()
  const r = await apiFetch<StaffPerformanceLog>('/performance/logs', {
    method: 'POST', headers, body: JSON.stringify(data),
  })
  if (!r.success) throw new Error(r.error)
  return r.data!
}

export async function deleteLog(id: string): Promise<void> {
  const headers = await authHeaders()
  const r = await apiFetch(`/performance/logs/${id}`, { method: 'DELETE', headers })
  if (!r.success) throw new Error(r.error)
}

// ─── Score ───────────────────────────────────────────────────────────────────

export async function getStaffScore(staffId: string, academicYearId?: string): Promise<PerformanceScore> {
  const headers = await authHeaders()
  const qs = academicYearId ? `?academic_year_id=${academicYearId}` : ''
  const r = await apiFetch<PerformanceScore>(`/performance/score/${staffId}${qs}`, { headers })
  if (!r.success) throw new Error(r.error)
  return r.data!
}

export async function getMyScore(): Promise<PerformanceScore> {
  const headers = await authHeaders()
  const r = await apiFetch<PerformanceScore>('/performance/my-score', { headers })
  if (!r.success) throw new Error(r.error)
  return r.data!
}
