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
    'Authorization': `Bearer ${token}`,
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

export interface SchoolSettings {
  id: string
  school_id: string
  diary_reminder_enabled: boolean
  diary_reminder_time: string
  diary_reminder_days: number[]
  created_at: string
  updated_at: string
}

export interface UpdateSchoolSettings {
  diary_reminder_enabled?: boolean
  diary_reminder_time?: string
  diary_reminder_days?: number[]
}

// ==================
// API Functions
// ==================

export async function getSchoolSettings() {
  return apiRequest<SchoolSettings>('/school-settings')
}

export async function updateSchoolSettings(settings: UpdateSchoolSettings) {
  return apiRequest<SchoolSettings>('/school-settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  })
}

export async function sendTestDiaryReminder(email?: string) {
  return apiRequest<{ message: string }>('/school-settings/test-diary-reminder', {
    method: 'POST',
    body: JSON.stringify(email ? { email } : {}),
  })
}

export async function triggerDiaryReminders() {
  return apiRequest<{ message: string; results: unknown }>('/school-settings/trigger-diary-reminders', {
    method: 'POST',
  })
}
