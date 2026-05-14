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

export interface ResourceLink {
  id: string
  school_id: string
  campus_id?: string
  title: string
  url: string
  visible_to: string[]
  sort_order?: number
  created_by?: string
  created_at: string
  updated_at: string
}

// ---- API Functions ----

/**
 * Get all resource links (admin sees all, others see role-filtered)
 */
export async function getResourceLinks(campusId?: string): Promise<ResourceLink[]> {
  const params = campusId ? `?campus_id=${campusId}` : ''
  const result = await apiRequest<ResourceLink[]>(`/resource-links${params}`)
  return result.data || []
}

/**
 * Get a single resource link by ID
 */
export async function getResourceLinkById(id: string): Promise<ResourceLink | null> {
  const result = await apiRequest<ResourceLink>(`/resource-links/${id}`)
  return result.data || null
}

/**
 * Create a new resource link
 */
export async function createResourceLink(data: {
  title: string
  url: string
  visible_to?: string[]
  campus_id?: string
}): Promise<ResourceLink | null> {
  const result = await apiRequest<ResourceLink>('/resource-links', {
    method: 'POST',
    body: JSON.stringify(data),
  })
  return result.data || null
}

/**
 * Update a resource link
 */
export async function updateResourceLink(
  id: string,
  data: Partial<{ title: string; url: string; visible_to: string[]; sort_order: number }>
): Promise<ResourceLink | null> {
  const result = await apiRequest<ResourceLink>(`/resource-links/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
  return result.data || null
}

/**
 * Delete a resource link
 */
export async function deleteResourceLink(id: string): Promise<boolean> {
  const result = await apiRequest(`/resource-links/${id}`, {
    method: 'DELETE',
  })
  return result.success
}

/**
 * Bulk save all resource links (matches RosarioSIS "Save" button)
 */
export async function bulkSaveResourceLinks(
  links: Array<{
    id?: string
    title: string
    url: string
    visible_to: string[]
    sort_order?: number
  }>,
  existingIds: string[]
): Promise<ResourceLink[]> {
  const result = await apiRequest<ResourceLink[]>('/resource-links/bulk-save', {
    method: 'PUT',
    body: JSON.stringify({ links, existing_ids: existingIds }),
  })
  return result.data || []
}
