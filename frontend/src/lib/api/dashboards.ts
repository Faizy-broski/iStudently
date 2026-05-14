import { getAuthToken } from './schools'
import { handleSessionExpiry } from '@/context/AuthContext'
import { API_URL } from '@/config/api'

interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

async function apiRequest<T = unknown>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = await getAuthToken()

  if (!token) {
    return { success: false, error: 'Authentication required. Please sign in.' }
  }

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

    if (!response.ok) {
      return { success: false, error: data.error || `Request failed with status ${response.status}` }
    }

    return data
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Network error occurred'
    console.error('API request error:', error)
    return { success: false, error: message }
  }
}

// ==================
// Types
// ==================

export interface Dashboard {
  id: string
  school_id: string
  campus_id?: string
  title: string
  description?: string
  is_active: boolean
  sort_order?: number
  created_by?: string
  created_at: string
  updated_at: string
  elements?: DashboardElement[]
}

export interface DashboardElement {
  id: string
  dashboard_id: string
  type: string
  url: string
  title?: string
  width_percent: number
  height_px: number
  sort_order?: number
  refresh_minutes?: number
  custom_css?: string
  created_at: string
  updated_at: string
}

// ==================
// Dashboard CRUD
// ==================

export async function getDashboards(campusId?: string): Promise<Dashboard[]> {
  const params = campusId ? `?campus_id=${campusId}` : ''
  const res = await apiRequest<Dashboard[]>(`/resource-dashboards${params}`)
  return res.data || []
}

export async function getDashboardById(id: string): Promise<Dashboard | null> {
  const res = await apiRequest<Dashboard>(`/resource-dashboards/${id}`)
  return res.data || null
}

export async function createDashboard(data: {
  title: string
  description?: string
  campus_id?: string
}): Promise<Dashboard | null> {
  const res = await apiRequest<Dashboard>('/resource-dashboards', {
    method: 'POST',
    body: JSON.stringify(data),
  })
  return res.data || null
}

export async function updateDashboard(
  id: string,
  data: {
    title?: string
    description?: string
    is_active?: boolean
    sort_order?: number
  }
): Promise<Dashboard | null> {
  const res = await apiRequest<Dashboard>(`/resource-dashboards/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
  return res.data || null
}

export async function deleteDashboard(id: string): Promise<boolean> {
  const res = await apiRequest(`/resource-dashboards/${id}`, {
    method: 'DELETE',
  })
  return res.success
}

// ==================
// Dashboard Elements
// ==================

export async function getElements(dashboardId: string): Promise<DashboardElement[]> {
  const res = await apiRequest<DashboardElement[]>(`/resource-dashboards/${dashboardId}/elements`)
  return res.data || []
}

export async function addElement(
  dashboardId: string,
  data: {
    url: string
    title?: string
    width_percent?: number
    height_px?: number
    sort_order?: number
    refresh_minutes?: number
    custom_css?: string
  }
): Promise<DashboardElement | null> {
  const res = await apiRequest<DashboardElement>(
    `/resource-dashboards/${dashboardId}/elements`,
    {
      method: 'POST',
      body: JSON.stringify(data),
    }
  )
  return res.data || null
}

export async function updateElement(
  dashboardId: string,
  elementId: string,
  data: {
    url?: string
    title?: string
    width_percent?: number
    height_px?: number
    sort_order?: number
    refresh_minutes?: number
    custom_css?: string
  }
): Promise<DashboardElement | null> {
  const res = await apiRequest<DashboardElement>(
    `/resource-dashboards/${dashboardId}/elements/${elementId}`,
    {
      method: 'PUT',
      body: JSON.stringify(data),
    }
  )
  return res.data || null
}

export async function deleteElement(
  dashboardId: string,
  elementId: string
): Promise<boolean> {
  const res = await apiRequest(
    `/resource-dashboards/${dashboardId}/elements/${elementId}`,
    {
      method: 'DELETE',
    }
  )
  return res.success
}

export async function reorderElements(
  dashboardId: string,
  elements: { id: string; sort_order: number }[]
): Promise<boolean> {
  const res = await apiRequest(
    `/resource-dashboards/${dashboardId}/elements/reorder`,
    {
      method: 'PUT',
      body: JSON.stringify({ elements }),
    }
  )
  return res.success
}
