import { getAuthToken } from './schools'
import { handleSessionExpiry } from '@/context/AuthContext'
import { API_URL } from '@/config/api'
import { getImpersonationHeaders } from './abortable-fetch'
import { withCampusParam } from './fina-campus'

interface ApiResponse<T = unknown> {
  data: T | null
  error: string | null
}

export interface FinaAuditLogRow {
  id: string
  seq: number
  school_id: string
  actor_id: string | null
  actor_role: string | null
  action: string
  subject_type: string | null
  subject_id: string | null
  meta: Record<string, unknown> | null
  occurred_at: string
}

export interface AuditSearchFilters {
  schoolId?: string
  from?: string
  to?: string
  action?: string
  limit?: number
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  try {
    const token = await getAuthToken()
    const res = await fetch(`${API_URL}${withCampusParam(path)}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...getImpersonationHeaders(),
        ...options.headers,
      },
    })
    if (res.status === 401) {
      await handleSessionExpiry()
      return { data: null, error: 'Session expired' }
    }
    const json = await res.json()
    if (!res.ok) return { data: null, error: json.error || 'Request failed' }
    return json
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Network error' }
  }
}

export function searchAuditLog(filters: AuditSearchFilters) {
  const params = new URLSearchParams()
  if (filters.schoolId) params.set('school_id', filters.schoolId)
  if (filters.from) params.set('from', filters.from)
  if (filters.to) params.set('to', filters.to)
  if (filters.action) params.set('action', filters.action)
  if (filters.limit) params.set('limit', String(filters.limit))
  const qs = params.toString()
  return apiFetch<FinaAuditLogRow[]>(`/fina/audit${qs ? `?${qs}` : ''}`)
}
