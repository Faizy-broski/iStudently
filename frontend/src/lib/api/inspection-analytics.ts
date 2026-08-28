import { getAuthToken } from './schools'
import { handleSessionExpiry } from '@/context/AuthContext'
import { API_URL } from '@/config/api'
import { getImpersonationHeaders } from './abortable-fetch'

interface ApiResponse<T = unknown> {
  data: T | null
  error: string | null
}

export interface CategoryScore {
  category: string
  avgScore: number
}

export interface HeatmapRow {
  label: string
  scoresByCategory: Record<string, number>
}

export interface DashboardStats {
  visitsScheduled: number
  visitsCompleted: number
  avgOverallScore: number | null
  avgScoreByCategory: CategoryScore[]
  openAppealsCount: number
  heatmap: HeatmapRow[]
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  try {
    const token = await getAuthToken()
    const res = await fetch(`${API_URL}${path}`, {
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

export const getInspectorDashboardStats = () =>
  apiFetch<DashboardStats>('/inspection-analytics/inspector')

export const getSchoolDashboardStats = (schoolId: string) =>
  apiFetch<DashboardStats>(`/inspection-analytics/school/${schoolId}`)
