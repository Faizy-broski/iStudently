import { apiRequest } from './index'

export interface SignupLink {
  id: string
  school_id: string
  campus_id: string | null
  token: string
  role: string
  label: string | null
  max_uses: number | null
  use_count: number
  expires_at: string | null
  is_active: boolean
  created_by: string
  created_at: string
  updated_at: string
  campus_name?: string | null
  creator_name?: string | null
}

export interface GenerateSignupLinkDTO {
  role: string
  label?: string | null
  max_uses?: number | null
  expires_at?: string | null
  campus_id?: string | null
}

export async function generateSignupLink(data: GenerateSignupLinkDTO) {
  return apiRequest<SignupLink>('/signup-links', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function getSignupLinks(campusId?: string) {
  const qs = campusId ? `?campus_id=${campusId}` : ''
  return apiRequest<SignupLink[]>(`/signup-links${qs}`)
}

export async function deactivateSignupLink(id: string) {
  return apiRequest<void>(`/signup-links/${id}/deactivate`, { method: 'PUT' })
}

export async function activateSignupLink(id: string) {
  return apiRequest<void>(`/signup-links/${id}/activate`, { method: 'PUT' })
}

export async function deleteSignupLink(id: string) {
  return apiRequest<void>(`/signup-links/${id}`, { method: 'DELETE' })
}

/** Build the full public URL for a signup token */
export function buildSignupUrl(token: string): string {
  const base =
    typeof window !== 'undefined'
      ? window.location.origin
      : (process.env.NEXT_PUBLIC_FRONTEND_URL ?? '')
  return `${base}/signup/${token}`
}
