// Self sign-up: invitation links (/signup-links) and accounts waiting for approval (/pending-signups).
import type { ApiClient } from '../../client'
import { qs } from '../../query'

export type SignupRole = 'teacher' | 'student' | 'parent' | 'staff' | 'librarian'

export interface SignupCustomField {
  id: string
  label: string
  label_ar?: string
  type: 'text' | 'select' | 'textarea' | 'date' | 'checkbox' | 'multi-select'
  required: boolean
  options?: string[]
  options_ar?: string[]
  placeholder?: string
  source?: 'custom' | 'profile_field'
  mapping?: { table: 'profiles' | 'parents' | 'staff'; column: string }
}

/** A profile or school custom field that a link can ask for (GET /signup-links/profile-fields). */
export interface SignupProfileField {
  source?: 'registry' | 'custom_field'
  table?: 'profiles' | 'parents' | 'staff'
  column?: string
  field_key?: string
  label_en: string
  label_ar: string
  type: SignupCustomField['type']
  options?: { id: string; label_en: string; label_ar: string }[]
  appliesToRoles: string[]
}

export interface SignupLinkMeta {
  poster_url?: string | null
  description?: string | null
  custom_fields?: SignupCustomField[]
  standard_fields?: {
    first_name?: { required: boolean }
    last_name?: { required: boolean }
    phone?: { enabled: boolean; required: boolean }
    email?: { enabled: boolean; required: boolean }
    username?: { enabled: boolean; required: boolean }
  }
}

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
  created_at: string
  campus_name?: string | null
  creator_name?: string | null
  meta?: SignupLinkMeta
}

export interface SignupLinkInput {
  role: SignupRole
  label?: string | null
  max_uses?: number | null
  expires_at?: string | null
  campus_id?: string | null
  meta?: SignupLinkMeta
}

export type PendingStatus = 'pending' | 'approved' | 'rejected'

export interface PendingStatusCounts {
  all: number
  pending: number
  approved: number
  rejected: number
}

export interface PendingSignup {
  id: string
  campus_id: string | null
  role: string
  first_name: string
  last_name: string
  email: string
  phone: string | null
  extra_data: Record<string, unknown>
  status: PendingStatus
  reviewed_at: string | null
  rejection_reason: string | null
  created_at: string
  link_label?: string | null
  link_meta?: { custom_fields?: { id: string; label: string; label_ar?: string }[] } | null
  reviewer_name?: string | null
  campus_name?: string | null
}

/** The public page a signup link opens (same as the web's buildSignupUrl). */
export function signupUrl(webUrl: string, token: string) {
  return `${webUrl.replace(/\/$/, '')}/signup/${token}`
}

export function adminSignupsApi(api: ApiClient) {
  const id = (v: string) => encodeURIComponent(v)
  return {
    links: (campusId?: string) => api.get<SignupLink[]>(`/signup-links${qs({ campus_id: campusId })}`),
    createLink: (input: SignupLinkInput) => api.post<SignupLink>('/signup-links', input),
    link: (linkId: string) => api.get<SignupLink>(`/signup-links/${id(linkId)}`),
    /** Role and token can't change (backend updateSignupLink). */
    updateLink: (linkId: string, input: Omit<SignupLinkInput, 'role'>) => api.put<SignupLink>(`/signup-links/${id(linkId)}`, input),
    profileFields: (role: string, campusId?: string) => api.get<SignupProfileField[]>(`/signup-links/profile-fields${qs({ role, campus_id: campusId })}`),
    setLinkActive: (linkId: string, active: boolean) => api.put<void>(`/signup-links/${id(linkId)}/${active ? 'activate' : 'deactivate'}`),
    deleteLink: (linkId: string) => api.del<void>(`/signup-links/${id(linkId)}`),

    pending: (campusId: string | undefined, p: { status?: PendingStatus; role?: string; grade_level?: string; search?: string; page?: number; limit?: number } = {}) =>
      api.get<PendingSignup[]>(
        `/pending-signups${qs({ campus_id: campusId, status: p.status, role: p.role, grade_level: p.grade_level, search: p.search, page: p.page, limit: p.limit })}`,
      ),
    /** Per-status totals for the tab badges, with the same role/grade/search filters as the list. */
    statusCounts: (campusId: string | undefined, p: { role?: string; grade_level?: string; search?: string } = {}) =>
      api.get<PendingStatusCounts>(`/pending-signups/status-counts${qs({ campus_id: campusId, role: p.role, grade_level: p.grade_level, search: p.search })}`),
    pendingCount: () => api.get<{ count: number }>('/pending-signups/count'),
    approve: (signupId: string) => api.post<unknown>(`/pending-signups/${id(signupId)}/approve`),
    reject: (signupId: string, reason?: string) => api.post<PendingSignup>(`/pending-signups/${id(signupId)}/reject`, { reason: reason || null }),
  }
}
