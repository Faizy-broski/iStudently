import { API_URL } from '@/config/api'

// These endpoints are PUBLIC — no auth token is sent.

export interface SignupLinkInfo {
  role: string
  label: string | null
  school_name: string
  school_logo_url: string | null
  campus_name: string | null
}

export interface SignupSubmitDTO {
  token: string
  first_name: string
  last_name: string
  email: string
  phone?: string
  password: string
  confirm_password: string
}

interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

async function publicFetch<T>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options?.headers as Record<string, string> | undefined),
      },
    })
    const data = await response.json()
    if (!response.ok) return { success: false, error: data?.error ?? 'Request failed' }
    return data
  } catch {
    return { success: false, error: 'Network error' }
  }
}

export async function getSignupLinkInfo(token: string): Promise<ApiResponse<SignupLinkInfo>> {
  return publicFetch<SignupLinkInfo>(`/public-signup/info/${token}`)
}

export async function submitSignup(data: SignupSubmitDTO): Promise<ApiResponse<{ id: string }>> {
  return publicFetch<{ id: string }>('/public-signup/submit', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}
