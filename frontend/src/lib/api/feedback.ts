import { getAuthToken } from './schools'
import { handleSessionExpiry } from '@/context/AuthContext'
import { API_URL } from '@/config/api'

interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface FeedbackReport {
  id: string
  school_id: string | null
  campus_id: string | null
  submitted_by: string | null
  submitter_role: string | null
  submitter_name: string | null
  submitter_email: string | null
  title: string
  description: string
  status: 'open' | 'in_progress' | 'resolved'
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

// Any authenticated user
export async function submitFeedback(data: { title: string; description: string }): Promise<ApiResponse<FeedbackReport>> {
  return apiRequest<FeedbackReport>('/feedback', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

// Super admin only
export async function getFeedbackReports(status?: string): Promise<ApiResponse<FeedbackReport[]>> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : ''
  return apiRequest<FeedbackReport[]>(`/feedback${qs}`)
}

export async function updateFeedbackStatus(
  id: string,
  status: 'open' | 'in_progress' | 'resolved'
): Promise<ApiResponse<FeedbackReport>> {
  return apiRequest<FeedbackReport>(`/feedback/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
}

export async function getFeedbackCount(): Promise<ApiResponse<{ count: number }>> {
  return apiRequest<{ count: number }>('/feedback/count')
}
