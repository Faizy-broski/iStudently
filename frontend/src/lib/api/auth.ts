import { getAuthToken } from './schools'
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
  if (!token) return { success: false, error: 'Authentication required. Please sign in.' }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: { ...headers, ...(options.headers as Record<string, string>) },
  })

  const data = await response.json()
  return data
}

// ── User: update own profile ──────────────────────────────────────────────────

export async function updateProfile(data: {
  first_name?: string
  last_name?: string
  phone?: string
}): Promise<ApiResponse> {
  return apiRequest('/auth/profile', {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

// ── User: change own password ─────────────────────────────────────────────────

export async function changePassword(newPassword: string): Promise<ApiResponse> {
  return apiRequest('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ new_password: newPassword }),
  })
}

// ── Admin: force-password-change operations ────────────────────────────────────

export async function getForcePasswordChangeStatus(campusId?: string): Promise<ApiResponse<{ count: number }>> {
  const params = campusId ? `?campus_id=${campusId}` : ''
  return apiRequest(`/auth/force-password-change/status${params}`)
}

export async function forcePasswordChange(campusId?: string): Promise<ApiResponse<{ count: number }>> {
  return apiRequest('/auth/force-password-change', {
    method: 'POST',
    body: JSON.stringify({ campus_id: campusId }),
  })
}

export async function resetForcePasswordChange(campusId?: string): Promise<ApiResponse<{ count: number }>> {
  return apiRequest('/auth/force-password-change/reset', {
    method: 'POST',
    body: JSON.stringify({ campus_id: campusId }),
  })
}
