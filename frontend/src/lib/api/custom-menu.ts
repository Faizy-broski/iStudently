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
  if (!token) return { success: false, error: 'Authentication required' }

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
    if (!response.ok) return { success: false, error: data.error || 'Request failed' }
    return data
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Network error'
    return { success: false, error: message }
  }
}

/** Per-role sidebar section ordering. Keys = role names, values = ordered title arrays. */
export type CustomMenuOrder = Record<string, string[]>

export async function getCustomMenuOrder(campusId?: string | null) {
  const qs = campusId ? `?campus_id=${encodeURIComponent(campusId)}` : ''
  return apiRequest<CustomMenuOrder>(`/school-settings/custom-menu-order${qs}`)
}

export async function updateCustomMenuOrder(
  role: string,
  order: string[],
  campusId?: string | null,
) {
  const qs = campusId ? `?campus_id=${encodeURIComponent(campusId)}` : ''
  return apiRequest<CustomMenuOrder>(`/school-settings/custom-menu-order${qs}`, {
    method: 'PUT',
    body: JSON.stringify({ role, order, campus_id: campusId || undefined }),
  })
}
