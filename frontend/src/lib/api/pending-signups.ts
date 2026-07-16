import { apiRequest } from './index'

export interface SignupLinkCustomFieldDef {
  id: string
  label: string
  type: 'text' | 'select' | 'textarea' | 'date'
  required: boolean
  options?: string[]
  source?: 'custom' | 'profile_field'
  mapping?: { table: string; column: string }
}

export interface PendingSignup {
  id: string
  school_id: string
  campus_id: string | null
  signup_link_id: string | null
  role: string
  first_name: string
  last_name: string
  email: string
  phone: string | null
  extra_data: Record<string, unknown>
  status: 'pending' | 'approved' | 'rejected'
  reviewed_by: string | null
  reviewed_at: string | null
  rejection_reason: string | null
  created_at: string
  updated_at: string
  link_label?: string | null
  /** The signup link's meta JSONB — includes custom_fields definitions for labelling extra_data */
  link_meta?: { custom_fields?: SignupLinkCustomFieldDef[]; standard_fields?: Record<string, unknown> } | null
  reviewer_name?: string | null
  campus_name?: string | null
}

export interface PendingSignupsFilters {
  status?: 'pending' | 'approved' | 'rejected' | 'all'
  role?: string
  campus_id?: string
  search?: string
  page?: number
  limit?: number
}

export async function getPendingSignups(filters?: PendingSignupsFilters) {
  const params = new URLSearchParams()
  if (filters?.status && filters.status !== 'all') params.set('status', filters.status)
  if (filters?.role) params.set('role', filters.role)
  if (filters?.campus_id) params.set('campus_id', filters.campus_id)
  if (filters?.search) params.set('search', filters.search)
  if (filters?.page) params.set('page', String(filters.page))
  if (filters?.limit) params.set('limit', String(filters.limit))
  const qs = params.toString() ? `?${params.toString()}` : ''
  return apiRequest<PendingSignup[]>(`/pending-signups${qs}`)
}

export async function getPendingSignupById(id: string) {
  return apiRequest<PendingSignup>(`/pending-signups/${id}`)
}

export async function approvePendingSignup(id: string) {
  return apiRequest<{ pendingSignup: PendingSignup; profile: Record<string, unknown> }>(
    `/pending-signups/${id}/approve`,
    { method: 'POST' }
  )
}

export async function rejectPendingSignup(id: string, reason?: string) {
  return apiRequest<PendingSignup>(`/pending-signups/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason: reason ?? null }),
  })
}

export async function getPendingCount() {
  return apiRequest<{ count: number }>('/pending-signups/count')
}
