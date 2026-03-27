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

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SetupAssistantConfig {
  [role: string]: boolean
}

export interface SetupAssistantProgress {
  completed_steps: string[]
  dismissed: boolean
}

// ─── Admin Config ─────────────────────────────────────────────────────────────

export async function getSetupAssistantConfig(campusId?: string | null) {
  const qs = campusId ? `?campus_id=${encodeURIComponent(campusId)}` : ''
  return apiRequest<SetupAssistantConfig>(`/setup-assistant/config${qs}`)
}

export async function updateSetupAssistantConfig(
  config: SetupAssistantConfig,
  campusId?: string | null,
) {
  const qs = campusId ? `?campus_id=${encodeURIComponent(campusId)}` : ''
  return apiRequest<void>(`/setup-assistant/config${qs}`, {
    method: 'PUT',
    body: JSON.stringify({ config, campus_id: campusId || undefined }),
  })
}

// ─── User Progress ────────────────────────────────────────────────────────────

export async function getSetupAssistantProgress() {
  return apiRequest<SetupAssistantProgress>('/setup-assistant/progress')
}

export async function completeSetupStep(stepId: string) {
  return apiRequest<void>('/setup-assistant/complete-step', {
    method: 'POST',
    body: JSON.stringify({ step_id: stepId }),
  })
}

export async function dismissSetupAssistant() {
  return apiRequest<void>('/setup-assistant/dismiss', {
    method: 'POST',
  })
}
