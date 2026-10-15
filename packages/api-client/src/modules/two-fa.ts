// Two-factor sign-in (backend/src/routes/two-fa.routes.ts). Verification is tied to the current
// Supabase session, so it is done once per sign-in on each device.
import type { ApiClient } from '../client'
import { qs } from '../query'

export interface TwoFAStatus {
  enabled: boolean
  required: boolean
  setup_skippable: boolean
  skip_grace_days: number
  skip_until: string | null
  session_verified: boolean
}

export interface TwoFASetup {
  secret: string
  /** otpauth:// link: opens an authenticator app on this phone. */
  otpauthUrl: string
  qrCodeDataUrl: string
  /** Shown once; the user keeps it to get back in without the authenticator. */
  recoveryCode: string
}

/** Which roles must use 2FA, for the school (campus null) or a campus. */
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

export function twoFaApi(api: ApiClient) {
  return {
    status: () => api.get<TwoFAStatus>('/two-fa/status'),
    beginSetup: () => api.post<TwoFASetup>('/two-fa/setup/begin'),
    completeSetup: (secret: string, token: string, recoveryCode: string) =>
      api.post<void>('/two-fa/setup/complete', { secret, token, recoveryCode }),
    /** Postpone setup (only when the school allows it). */
    skip: () => api.post<void>('/two-fa/skip'),
    verify: (token: string) => api.post<void>('/two-fa/verify', { token }),
    /** Signs in with the recovery code and turns 2FA off; the user sets it up again next time. */
    recovery: (code: string) => api.post<void>('/two-fa/recovery', { code }),

    // Admin (web: /admin/settings/two-factor-auth)
    adminConfig: (campusId?: string) => api.get<TwoFAConfig>(`/two-fa/admin/config${qs({ campus_id: campusId })}`),
    saveAdminConfig: (config: TwoFAConfig, campusId?: string) => api.post<void>(`/two-fa/admin/config${qs({ campus_id: campusId })}`, config),
    adminUsers: (campusId?: string) => api.get<TwoFAUserRow[]>(`/two-fa/admin/users${qs({ campus_id: campusId })}`),
    /** Turns 2FA off for that user; they set it up again at next sign-in if their role requires it. */
    adminReset: (profileId: string) => api.post<void>(`/two-fa/admin/reset/${encodeURIComponent(profileId)}`),
  }
}
