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
      return { success: false, error: data?.error || `Request failed (${response.status})` }
    }

    return data
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Network error'
    return { success: false, error: message }
  }
}

// ---- Types ----

export interface ResourceLinkCategory {
  id: string
  school_id: string
  campus_id?: string | null
  name: string
  sort_order?: number
  created_by?: string
  created_at: string
  updated_at: string
}

// ---- API Functions ----

export async function getResourceLinkCategories(campusId?: string): Promise<ResourceLinkCategory[]> {
  const params = campusId ? `?campus_id=${campusId}` : ''
  const result = await apiRequest<ResourceLinkCategory[]>(`/resource-link-categories${params}`)
  return result.data || []
}

export async function createResourceLinkCategory(data: {
  name: string
  campus_id?: string | null
  sort_order?: number
}): Promise<ResourceLinkCategory | null> {
  const result = await apiRequest<ResourceLinkCategory>('/resource-link-categories', {
    method: 'POST',
    body: JSON.stringify(data),
  })
  return result.data || null
}

export async function updateResourceLinkCategory(
  id: string,
  data: Partial<{ name: string; sort_order: number }>
): Promise<ResourceLinkCategory | null> {
  const result = await apiRequest<ResourceLinkCategory>(`/resource-link-categories/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
  return result.data || null
}

export async function deleteResourceLinkCategory(id: string): Promise<boolean> {
  const result = await apiRequest(`/resource-link-categories/${id}`, {
    method: 'DELETE',
  })
  return result.success
}
