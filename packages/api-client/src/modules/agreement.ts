// User agreement shown at sign-in (backend/src/routes/user-agreement.routes.ts, /user-agreements).
import type { ApiClient } from '../client'
import { qs } from '../query'

export interface AgreementItem {
  id: string
  /** Arabic (school's main language) */
  title: string
  content: string
  title_en?: string
  content_en?: string
  enabled: boolean
}

export interface AgreementCheck {
  must_accept: boolean
  blocked: boolean
  message?: string
  agreement?: { enabled: boolean; agreements: AgreementItem[] }
  /** Parents: the children this acceptance covers. */
  students_needing_acceptance?: { id: string; name?: string; first_name?: string; last_name?: string }[]
}

export type AgreementRole = 'teacher' | 'student' | 'parent' | 'staff' | 'librarian' | 'counselor'

export interface RoleAgreementConfig {
  enabled: boolean
  /** 'manual' = once accepted stays accepted; 'annual' = resets every new academic year. */
  reset_mode?: 'manual' | 'annual'
  /** Parent role only: linked students are blocked until the parent accepts. */
  block_linked_students?: boolean
  agreements: AgreementItem[]
}

export type RoleAgreementConfigs = Partial<Record<AgreementRole, RoleAgreementConfig>>

export interface AgreementReportRow {
  id: string
  name: string
  email: string
  status: 'accepted' | 'rejected' | null
  is_active: boolean
  updated_at: string | null
}

export function agreementApi(api: ApiClient) {
  return {
    /** The agreement text(s) configured for the caller's role (read-only page). */
    mine: () => api.get<{ agreements: { id: string; title?: string | null; content: string }[] } | null>('/user-agreements/my-agreement'),
    check: () => api.get<AgreementCheck>('/user-agreements/check'),
    accept: () => api.post<void>('/user-agreements/accept'),
    /** Deactivates the account (it can be reactivated on the website). */
    reject: () => api.post<void>('/user-agreements/reject'),

    // Admin (web: /admin/settings/user-agreements). campus_id null = school-wide row.
    config: (campusId?: string) => api.get<RoleAgreementConfigs>(`/user-agreements/config${qs({ campus_id: campusId })}`),
    saveConfig: (configs: RoleAgreementConfigs, campusId?: string) =>
      api.put<void>(`/user-agreements/config${qs({ campus_id: campusId })}`, { configs, campus_id: campusId }),
    /** Forces everyone with this role to accept again at next sign-in. */
    resetAcceptances: (role: AgreementRole) => api.post<void>(`/user-agreements/reset/${encodeURIComponent(role)}`),
    report: (role: AgreementRole, campusId?: string) => api.get<AgreementReportRow[]>(`/user-agreements/report/${encodeURIComponent(role)}${qs({ campus_id: campusId })}`),
  }
}
