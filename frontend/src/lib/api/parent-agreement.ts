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
    return { success: false, error: message }
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AgreementCheckResult {
  must_accept: boolean
  blocked: boolean
  agreement?: { title: string; content: string } | null
  students_needing_acceptance?: Array<{ id: string; first_name: string; last_name: string }>
  message?: string | null
}

export interface AgreementConfig {
  title: string
  content: string
}

// ─── API Functions ────────────────────────────────────────────────────────────

/** Check if the logged-in parent/student needs to accept or is blocked */
export async function checkParentAgreement() {
  return apiRequest<AgreementCheckResult>('/parent-agreement/check')
}

/** Parent accepts the agreement for all linked students */
export async function acceptParentAgreement() {
  return apiRequest<{ message: string }>('/parent-agreement/accept', {
    method: 'POST',
  })
}

/** Admin: get agreement config for a campus */
export async function getParentAgreementConfig(campusId?: string | null) {
  const qs = campusId ? `?campus_id=${encodeURIComponent(campusId)}` : ''
  return apiRequest<AgreementConfig>(`/parent-agreement/config${qs}`)
}

/** Admin: update agreement config */
export async function updateParentAgreementConfig(
  config: AgreementConfig,
  campusId?: string | null
) {
  const qs = campusId ? `?campus_id=${encodeURIComponent(campusId)}` : ''
  return apiRequest<{ message: string }>(`/parent-agreement/config${qs}`, {
    method: 'PUT',
    body: JSON.stringify({ ...config, campus_id: campusId || undefined }),
  })
}
