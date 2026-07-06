import { getAuthToken } from './schools'
import { handleSessionExpiry } from '@/context/AuthContext'
import { API_URL } from '@/config/api'

interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface EmbeddedResourceCategory {
  id: string
  school_id: string
  name: string
  sort_order?: number
  created_by?: string | null
  created_at: string
  updated_at: string
}

async function apiRequest<T = unknown>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = await getAuthToken()
  if (!token) return { success: false, error: 'Authentication required. Please sign in.' }

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
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
  } catch {
    return { success: false, error: 'Network error. Please check your connection.' }
  }
}

export async function getEmbeddedResourceCategories(campusId?: string): Promise<ApiResponse<EmbeddedResourceCategory[]>> {
  const qs = campusId ? `?school_id=${encodeURIComponent(campusId)}` : ''
  return apiRequest<EmbeddedResourceCategory[]>(`/embedded-resource-categories${qs}`)
}

export async function createEmbeddedResourceCategory(
  data: { name: string; sort_order?: number },
  campusId?: string
): Promise<ApiResponse<EmbeddedResourceCategory>> {
  const qs = campusId ? `?school_id=${encodeURIComponent(campusId)}` : ''
  return apiRequest<EmbeddedResourceCategory>(`/embedded-resource-categories${qs}`, {
    method: 'POST',
    body: JSON.stringify({ ...data, campus_id: campusId, school_id: campusId }),
  })
}

export async function updateEmbeddedResourceCategory(
  id: string,
  data: Partial<{ name: string; sort_order: number }>,
  campusId?: string
): Promise<ApiResponse<EmbeddedResourceCategory>> {
  const qs = campusId ? `?school_id=${encodeURIComponent(campusId)}` : ''
  return apiRequest<EmbeddedResourceCategory>(`/embedded-resource-categories/${id}${qs}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function deleteEmbeddedResourceCategory(id: string, campusId?: string): Promise<ApiResponse<void>> {
  const qs = campusId ? `?school_id=${encodeURIComponent(campusId)}` : ''
  return apiRequest<void>(`/embedded-resource-categories/${id}${qs}`, { method: 'DELETE' })
}
