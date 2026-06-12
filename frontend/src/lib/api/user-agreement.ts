import { getAuthToken } from './schools'
import { handleSessionExpiry } from '@/context/AuthContext'
import { API_URL } from '@/config/api'

interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
  code?: string
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
      return {
        success: false,
        error: data.error || `Request failed with status ${response.status}`,
        code: data.code,
      }
    }

    return data
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Network error occurred'
    return { success: false, error: message }
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type AgreementRole = 'teacher' | 'student' | 'parent' | 'staff' | 'librarian' | 'counselor'

export interface AgreementItem {
  id: string
  title: string
  content: string
  enabled: boolean
}

export interface RoleAgreementConfig {
  enabled: boolean
  /** 'manual' = once accepted stays accepted. 'annual' = resets every new academic year. */
  reset_mode?: 'manual' | 'annual'
  /** Parent role only: if true, linked students are blocked until parent accepts. */
  block_linked_students?: boolean
  agreements: AgreementItem[]
}

export type RoleAgreementConfigs = Partial<Record<AgreementRole, RoleAgreementConfig>>

export interface LinkedStudent {
  id: string
  first_name: string
  last_name: string
}

export interface AgreementCheckResult {
  must_accept: boolean
  /** Student blocked because their parent has not accepted the parent agreement */
  blocked: boolean
  /** Message shown to blocked student */
  message?: string | null
  /** Agreement to show if must_accept is true */
  agreement?: RoleAgreementConfig | null
  /** Parent role only: children this acceptance will cover */
  students_needing_acceptance?: LinkedStudent[]
}

// ─── Admin API ────────────────────────────────────────────────────────────────

export async function getUserAgreementConfig(campusId?: string | null) {
  const qs = campusId ? `?campus_id=${encodeURIComponent(campusId)}` : ''
  return apiRequest<RoleAgreementConfigs>(`/user-agreements/config${qs}`)
}

export async function updateUserAgreementConfig(
  configs: RoleAgreementConfigs,
  campusId?: string | null
) {
  const qs = campusId ? `?campus_id=${encodeURIComponent(campusId)}` : ''
  return apiRequest<{ message: string }>(`/user-agreements/config${qs}`, {
    method: 'PUT',
    body: JSON.stringify({ configs, campus_id: campusId || undefined }),
  })
}

export async function resetAgreementAcceptances(role: AgreementRole) {
  return apiRequest<{ message: string }>(`/user-agreements/reset/${role}`, { method: 'POST' })
}

// ─── User API ─────────────────────────────────────────────────────────────────

export async function getMyAgreement() {
  return apiRequest<{ agreements: AgreementItem[] } | null>('/user-agreements/my-agreement')
}

export async function checkUserAgreement() {
  return apiRequest<AgreementCheckResult>('/user-agreements/check')
}

export async function acceptUserAgreement() {
  return apiRequest<{ message: string }>('/user-agreements/accept', { method: 'POST' })
}

export async function rejectUserAgreement() {
  return apiRequest<{ message: string }>('/user-agreements/reject', { method: 'POST' })
}

// ─── Public API (no auth) ─────────────────────────────────────────────────────

export async function requestReaccept(email: string): Promise<ApiResponse<{ message: string }>> {
  try {
    const response = await fetch(`${API_URL}/user-agreements/request-reaccept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    return response.json()
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Network error occurred'
    return { success: false, error: message }
  }
}
