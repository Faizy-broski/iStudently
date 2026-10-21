import type { UserRole } from '@studently/shared-types'

import type { ApiClient } from '../client'

export interface SchoolBranding {
  id: string
  name: string
  short_name?: string | null
  parent_school_id: string | null
  logo_url: string | null
  logo_shape?: 'circle' | 'square' | 'rounded' | 'rectangle'
  logo_border_width?: number
  logo_border_color?: string
}

export interface MyContext {
  campus_id: string | null
  school_id: string | null
  staff_id: string | null
  user_profile_id: string | null
  school: SchoolBranding | null
}

export type TwoFAState = 'ok' | 'setup_required' | 'verify_required'

/** GET /auth/me (backend/src/controllers/auth.controller.ts getMe). */
export interface Me {
  profile: {
    id: string
    role: UserRole
    email: string | null
    username: string | null
    first_name: string | null
    last_name: string | null
    /** Older servers omit it. */
    phone?: string | null
    avatar_url: string | null
    profile_photo_url: string | null
    language: 'en' | 'ar' | null
    school_id: string | null
    campus_id: string | null
    student_id: string | null
    parent_id: string | null
    staff_id: string | null
    section_id: string | null
    /** Older servers omit these. */
    gender?: string | null
    created_at?: string | null
  }
  gates: {
    force_password_change: boolean
    two_fa: { state: TwoFAState; required: boolean; enabled: boolean; skip_until: string | null }
    agreement: { must_accept: boolean; blocked: boolean; message: string | null } | null
  }
  plugins: string[]
  school: SchoolBranding | null
}

export type ResolveUsernameResult = { ok: true; email: string } | { ok: false; reason: 'not_found' | 'rate_limited' | 'network' }

export function authApi(api: ApiClient) {
  return {
    /** POST /public/resolve-username. Returns `{ success, email }` (not wrapped in `data`). */
    /** Username -> sign-in email. Says why when it fails, so the UI can tell "wait" from "wrong name". */
    async resolveUsername(username: string): Promise<ResolveUsernameResult> {
      const res = await api.post<never>('/public/resolve-username', { username }, { public: true })
      const email = (res as { email?: string }).email
      if (res.success && email) return { ok: true, email }
      if (res.status === 429) return { ok: false, reason: 'rate_limited' }
      if (res.status === 404 || res.status === 400) return { ok: false, reason: 'not_found' }
      return { ok: false, reason: 'network' }
    },

    getMe: () => api.get<Me>('/auth/me'),

    /** GET /auth/me/context: school/campus ids and branding. Prefer getMe(). */
    getMyContext: () => api.get<MyContext>('/auth/me/context'),

    /** Admin: when someone last signed in (own school only). */
    lastLogin: (profileId: string) => api.get<{ last_sign_in: string | null }>(`/auth/last-login/${encodeURIComponent(profileId)}`),

    /** Saves the language on the account (same as the web's switcher), so it follows the user across devices. */
    updateLanguage: (language: 'en' | 'ar') => api.patch<void>('/auth/language', { language }),

    /** Own profile fields (web: PUT /auth/profile). */
    updateProfile: (data: { first_name?: string; last_name?: string; phone?: string; avatar_url?: string; profile_photo_url?: string }) => api.put<unknown>('/auth/profile', data),
    changePassword: (newPassword: string) => api.post('/auth/change-password', { new_password: newPassword }),
    /** The signed-in user deletes their own account (sign-in stops at once; the school erases the data). */
    deleteAccount: (reason?: string) => api.post('/auth/delete-account', { reason }),
    /** This phone's Expo push token for the signed-in user (router: push-notifications.routes.ts). */
    registerPushDevice: (body: { token: string; platform: 'ios' | 'android'; device_name?: string | null; app_version?: string | null }) => api.post('/push/devices', body),
    unregisterPushDevice: (token: string) => api.del('/push/devices', { body: { token } }),
  }
}
