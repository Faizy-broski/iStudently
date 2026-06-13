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

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options.headers as Record<string, string>),
      },
    })

    const data = await response.json()

    if (response.status === 401) {
      await handleSessionExpiry()
      return { success: false, error: 'Session expired' }
    }

    return data
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Network error occurred'
    return { success: false, error: message }
  }
}

// ── Types ──────────────────────────────────────────────────────────────────────

export interface TwoFAStatus {
  enabled: boolean
  required: boolean
  setup_skippable: boolean
  skip_grace_days: number
  skip_until: string | null
  session_verified: boolean
}

export interface TwoFASetupData {
  secret: string
  otpauthUrl: string
  qrCodeDataUrl: string
  recoveryCode: string
}

export interface TwoFAConfig {
  roles_required: string[]
  setup_skippable: boolean
  skip_grace_days: number
}

export interface TwoFAUserRow {
  id: string
  name: string
  email: string
  role: string
  totp_enabled: boolean
  totp_enabled_at: string | null
  campus_id: string | null
}

// ── User API ───────────────────────────────────────────────────────────────────

export async function getTwoFAStatus() {
  return apiRequest<TwoFAStatus>('/two-fa/status')
}

export async function beginTwoFASetup() {
  return apiRequest<TwoFASetupData>('/two-fa/setup/begin', { method: 'POST' })
}

export async function completeTwoFASetup(secret: string, token: string, recoveryCode: string) {
  return apiRequest<{ message: string }>('/two-fa/setup/complete', {
    method: 'POST',
    body: JSON.stringify({ secret, token, recoveryCode }),
  })
}

export async function skipTwoFASetup() {
  return apiRequest<{ message: string }>('/two-fa/skip', { method: 'POST' })
}

export async function verifyTwoFA(token: string) {
  return apiRequest<{ message: string }>('/two-fa/verify', {
    method: 'POST',
    body: JSON.stringify({ token }),
  })
}

export async function submitRecoveryCode(code: string) {
  return apiRequest<{ message: string }>('/two-fa/recovery', {
    method: 'POST',
    body: JSON.stringify({ code }),
  })
}

export async function disableTwoFA(token: string) {
  return apiRequest<{ message: string }>('/two-fa/disable', {
    method: 'DELETE',
    body: JSON.stringify({ token }),
  })
}

// ── Admin API ──────────────────────────────────────────────────────────────────

export async function getAdminTwoFAConfig(campusId?: string | null) {
  const qs = campusId ? `?campus_id=${encodeURIComponent(campusId)}` : ''
  return apiRequest<TwoFAConfig>(`/two-fa/admin/config${qs}`)
}

export async function updateAdminTwoFAConfig(config: TwoFAConfig, campusId?: string | null) {
  const qs = campusId ? `?campus_id=${encodeURIComponent(campusId)}` : ''
  return apiRequest<{ message: string }>(`/two-fa/admin/config${qs}`, {
    method: 'POST',
    body: JSON.stringify(config),
  })
}

export async function getAdminTwoFAUsers(campusId?: string | null) {
  const qs = campusId ? `?campus_id=${encodeURIComponent(campusId)}` : ''
  return apiRequest<TwoFAUserRow[]>(`/two-fa/admin/users${qs}`)
}

export async function adminResetUserTwoFA(profileId: string) {
  return apiRequest<{ message: string }>(`/two-fa/admin/reset/${profileId}`, { method: 'POST' })
}
