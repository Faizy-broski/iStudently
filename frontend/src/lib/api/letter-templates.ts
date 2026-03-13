import { API_URL } from '@/config/api'
import { getAuthToken } from './schools'
import { handleSessionExpiry } from '@/context/AuthContext'

// ─── Types ────────────────────────────────────────────────────────────────────

export type TemplateContext = 'print_letters' | 'email'

export interface LetterTemplate {
  id: string
  school_id: string
  name: string
  context: TemplateContext
  content: string
  is_global: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface CreateTemplatePayload {
  name: string
  context: TemplateContext
  content: string
  is_global?: boolean
  campus_id?: string
}

export interface UpdateTemplatePayload {
  name?: string
  content?: string
  is_global?: boolean
  campus_id?: string
}

// ─── Request helper ───────────────────────────────────────────────────────────

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ success: boolean; data?: T; error?: string; message?: string }> {
  const token = await getAuthToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: { ...headers, ...(options.headers as Record<string, string>) },
    })

    if (response.status === 401) {
      handleSessionExpiry()
      throw new Error('Session expired. Please log in again.')
    }

    const data = await response.json()

    if (!response.ok) {
      return { success: false, error: data.error || data.message || 'Request failed' }
    }

    return data
  } catch (e) {
    if (e instanceof Error) {
      return { success: false, error: e.message }
    }
    return { success: false, error: 'Network error' }
  }
}

// ─── API functions ────────────────────────────────────────────────────────────

export async function getLetterTemplates(
  context: TemplateContext,
  campusId?: string
) {
  const params = new URLSearchParams({ context })
  if (campusId) params.set('campus_id', campusId)
  return apiRequest<LetterTemplate[]>(`/letter-templates?${params}`)
}

export async function createLetterTemplate(payload: CreateTemplatePayload) {
  return apiRequest<LetterTemplate>('/letter-templates', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateLetterTemplate(id: string, payload: UpdateTemplatePayload) {
  return apiRequest<LetterTemplate>(`/letter-templates/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export async function deleteLetterTemplate(id: string, campusId?: string) {
  const params = campusId ? `?campus_id=${campusId}` : ''
  return apiRequest(`/letter-templates/${id}${params}`, { method: 'DELETE' })
}
