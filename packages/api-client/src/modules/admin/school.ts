// School admin: campus-scoped school settings and the user's own module permissions.
// (backend/src/routes/school-settings.routes.ts, user-profiles.routes.ts)
import type { ProfilePermission } from '@studently/shared-types'

import type { ApiClient } from '../../client'
import type { SidebarConfig, SidebarConfigInput } from '../platform'
import { qs } from '../../query'

/** The fields the app uses; the server returns more. */
export interface SchoolSettings {
  school_id: string
  campus_id: string | null
  active_plugins?: Record<string, boolean> | null
  /** Root school's deny-list (super admin); null = unrestricted. */
  denied_modules: string[] | null
  custom_menu_order?: Record<string, string[]> | null
  preferred_date_format?: string
  [key: string]: unknown
}

export interface PdfHeaderFooter {
  pdf_header_html: string
  pdf_footer_html: string
  pdf_margin_top: number
  pdf_margin_bottom: number
  /** Header/footer shown on screen only, not when printed. */
  pdf_exclude_print: boolean
}

/** Outgoing mail server of the school (campusId null) or a campus. The stored password comes back masked. */
export interface SmtpSettings {
  smtp_host: string
  smtp_port: number
  smtp_secure: boolean
  smtp_user: string
  /** '••••••••' when one is saved; sending that (or '') keeps it. */
  smtp_pass: string
  smtp_from_email: string
  smtp_from_name: string
  has_password: boolean
}

/** Google / Microsoft sign-in for the school or a campus. Saved secrets come back masked. */
export interface SocialLoginSettings {
  google_enabled: boolean
  google_client_id: string
  /** '••••••••' when one is saved; sending that (or '') keeps it. */
  google_client_secret: string
  google_hosted_domain: string
  has_google_secret: boolean
  microsoft_enabled: boolean
  microsoft_client_id: string
  microsoft_client_secret: string
  microsoft_tenant: string
  has_microsoft_secret: boolean
}

export function adminSchoolApi(api: ApiClient) {
  return {
    /** Settings for a campus (its own row, else the school-wide one). */
    getSettings: (campusId?: string) => api.get<SchoolSettings>(`/school-settings${qs({ campus_id: campusId })}`),
    /** Partial update of the campus row (web: updateSchoolSettings sends campus_id in query and body). */
    updateSettings: (settings: Record<string, unknown>, campusId?: string | null) =>
      api.put<SchoolSettings>(`/school-settings${qs({ campus_id: campusId ?? undefined })}`, { ...settings, campus_id: campusId || undefined }),
    /** Title-cases first, father, grandfather and last names of the school's profiles (only those that differ). */
    convertNamesTitlecase: () => api.post<{ converted: number }>('/school-settings/convert-names-titlecase'),
    socialLogin: (campusId?: string | null) => api.get<SocialLoginSettings>(`/school-settings/social-login${qs({ campus_id: campusId ?? undefined })}`),
    saveSocialLogin: (settings: Partial<SocialLoginSettings>, campusId?: string | null) =>
      api.put<{ message: string }>(`/school-settings/social-login${qs({ campus_id: campusId ?? undefined })}`, { ...settings, campus_id: campusId || undefined }),
    /** Saved web sidebar section order per role (web: Custom Menu). */
    customMenuOrder: (campusId?: string | null) => api.get<Record<string, string[]>>(`/school-settings/custom-menu-order${qs({ campus_id: campusId ?? undefined })}`),
    saveCustomMenuOrder: (role: string, order: string[], campusId?: string | null) =>
      api.put<Record<string, string[]>>(`/school-settings/custom-menu-order${qs({ campus_id: campusId ?? undefined })}`, { role, order, campus_id: campusId || undefined }),
    /** Which user types see the dashboard Setup Assistant. */
    setupAssistantConfig: (campusId?: string | null) => api.get<Record<string, boolean>>(`/setup-assistant/config${qs({ campus_id: campusId ?? undefined })}`),
    saveSetupAssistantConfig: (config: Record<string, boolean>, campusId?: string | null) =>
      api.put<void>(`/setup-assistant/config${qs({ campus_id: campusId ?? undefined })}`, { config, campus_id: campusId || undefined }),
    /** Users who still must change their password; force sets the flag for everyone (except super admins), reset clears it. */
    forcePasswordStatus: (campusId?: string) => api.get<{ count: number }>(`/auth/force-password-change/status${qs({ campus_id: campusId })}`),
    forcePasswordChange: (campusId?: string) => api.post<{ count: number }>('/auth/force-password-change', { campus_id: campusId }),
    resetForcePasswordChange: (campusId?: string) => api.post<{ count: number }>('/auth/force-password-change/reset', { campus_id: campusId }),
    /** null = no User Profile assigned (full access for admins; nothing for staff). */
    getMyPermissions: () => api.get<ProfilePermission[] | null>('/user-profiles/my-permissions'),
    smtp: (campusId?: string) => api.get<SmtpSettings>(`/school-settings/smtp${qs({ campus_id: campusId })}`),
    saveSmtp: (settings: SmtpSettings, campusId?: string) =>
      api.put<{ message: string }>(`/school-settings/smtp${qs({ campus_id: campusId })}`, { ...settings, campus_id: campusId || undefined }),
    /** Sends a test email with these (unsaved) settings. */
    testSmtp: (settings: SmtpSettings & { test_email: string }, campusId?: string) =>
      api.post<{ message: string }>(`/school-settings/smtp/test${qs({ campus_id: campusId })}`, { ...settings, campus_id: campusId || undefined }),
    /** Sends the diary reminder email now to `email` (default: the admin's own address). */
    testDiaryReminder: (email?: string) => api.post<{ message: string }>('/school-settings/test-diary-reminder', email ? { email } : {}),
    /** Web sidebar look for the school (`campusId` null) or one campus (web: Settings > Sidebar theme). */
    sidebarConfig: (schoolId: string, campusId?: string | null) =>
      api.get<SidebarConfig | null>(campusId ? `/sidebar-config/campus/${encodeURIComponent(campusId)}` : `/sidebar-config/school/${encodeURIComponent(schoolId)}`),
    updateSidebarConfig: (schoolId: string, campusId: string | null | undefined, input: SidebarConfigInput) =>
      api.put<SidebarConfig>(campusId ? `/sidebar-config/campus/${encodeURIComponent(campusId)}` : `/sidebar-config/school/${encodeURIComponent(schoolId)}`, input),
    resetSidebarConfig: (schoolId: string, campusId?: string | null) =>
      api.post<SidebarConfig>(campusId ? `/sidebar-config/campus/${encodeURIComponent(campusId)}/reset` : `/sidebar-config/school/${encodeURIComponent(schoolId)}/reset`),
    getPdfHeaderFooter: (campusId?: string) => api.get<PdfHeaderFooter>(`/school-settings/pdf-header-footer${qs({ campus_id: campusId })}`),
    savePdfHeaderFooter: (settings: PdfHeaderFooter, campusId?: string) =>
      api.put<{ message: string }>(`/school-settings/pdf-header-footer${qs({ campus_id: campusId })}`, { ...settings, campus_id: campusId || undefined }),
  }
}
