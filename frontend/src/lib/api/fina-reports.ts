import { getAuthToken } from './schools'
import { handleSessionExpiry } from '@/context/AuthContext'
import { API_URL } from '@/config/api'
import { getImpersonationHeaders } from './abortable-fetch'
import { withCampusParam } from './fina-campus'

interface ApiResponse<T = unknown> {
  data: T | null
  error: string | null
}

export interface FinaReport {
  id: string
  school_id: string
  period: string
  kind: string
  file_key: string
  generated_at: string
  created_at: string
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

export const listReports = (schoolId?: string) =>
  apiFetch<FinaReport[]>(`/fina/reports${schoolId ? `?school_id=${encodeURIComponent(schoolId)}` : ''}`)

export const getReportDownloadUrl = (reportId: string) =>
  apiFetch<{ url: string }>(`/fina/reports/${reportId}/download`)

export const generateReport = (period?: string) =>
  apiFetch<FinaReport>('/fina/reports/generate', { method: 'POST', body: JSON.stringify({ period }) })
