import { getAuthToken } from './schools'
import { handleSessionExpiry } from '@/context/AuthContext'
import { API_URL } from '@/config/api'

interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

async function apiRequest<T = unknown>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = await getAuthToken()

  if (!token) {
    return { success: false, error: 'Authentication required. Please sign in.' }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  }

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: { ...headers, ...options.headers },
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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Network error occurred'
    console.error('API request error:', error)
    return { success: false, error: message }
  }
}

// ==================
// Types
// ==================

export interface HostelSettings {
  auto_remove_inactive?: boolean
}

export type PaymentMethodOption = 'cash' | 'online' | 'bank_deposit' | 'cheque'

export const PAYMENT_METHOD_OPTIONS: { value: PaymentMethodOption; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'online', label: 'Online' },
  { value: 'bank_deposit', label: 'Bank Deposit' },
  { value: 'cheque', label: 'Cheque' },
]

/** Config for "Append Custom Field to Grade Level" feature (mirrors RosarioSIS plugin) */
export interface StudentListAppendConfig {
  enabled: boolean
  /** "category.field_key" (e.g. "system.username", "personal.gender")
   *  or "profile.email" / "profile.phone" for core profile fields */
  field: string
  /** Optional second field to append */
  field2?: string | null
  /** Separator between grade and appended value — default " / " */
  separator: string
}

export interface SchoolSettings {
  id: string
  school_id: string
  campus_id?: string | null
  diary_reminder_enabled: boolean
  diary_reminder_time: string
  diary_reminder_days: number[]
  hostel?: HostelSettings
  default_payment_method?: PaymentMethodOption
  // Automatic Attendance
  auto_attendance_enabled: boolean
  auto_attendance_hour: string      // HH:MM (24h) — run after this time
  auto_attendance_days: number[]    // 0=Mon … 6=Sun
  auto_attendance_last_run?: string | null
  // Absent for the Day on First Absence (mirrors RosarioSIS plugin)
  absent_on_first_absence: boolean
  // Append Custom Field to Grade Level (mirrors RosarioSIS plugin)
  student_list_append_config?: StudentListAppendConfig | null
  // Assignment Max Points (mirrors RosarioSIS plugin) — null = disabled
  assignment_max_points?: number | null
  active_plugins: Record<string, boolean>
  created_at: string
  updated_at: string
}

export interface UpdateSchoolSettings {
  diary_reminder_enabled?: boolean
  diary_reminder_time?: string
  diary_reminder_days?: number[]
  hostel?: HostelSettings
  default_payment_method?: PaymentMethodOption
  // Automatic Attendance
  auto_attendance_enabled?: boolean
  auto_attendance_hour?: string
  auto_attendance_days?: number[]
  // Absent for the Day on First Absence (mirrors RosarioSIS plugin)
  absent_on_first_absence?: boolean
  // Append Custom Field to Grade Level (mirrors RosarioSIS plugin)
  student_list_append_config?: StudentListAppendConfig | null
  // Assignment Max Points (mirrors RosarioSIS plugin) — null = disabled
  assignment_max_points?: number | null
  // Plugin activation
  active_plugins?: Record<string, boolean>
}

// ─── SMTP Settings ────────────────────────────────────────────────────────────

export interface SmtpSettings {
  smtp_host: string
  smtp_port: number
  smtp_secure: boolean
  smtp_user: string
  /** Always masked as '••••••••' when loaded from server */
  smtp_pass: string
  smtp_from_email: string
  smtp_from_name: string
  has_password: boolean
}

// ==================
// API Functions
// ==================

export async function getSchoolSettings(campusId?: string | null) {
  const qs = campusId ? `?campus_id=${encodeURIComponent(campusId)}` : ''
  return apiRequest<SchoolSettings>(`/school-settings${qs}`)
}

export async function updateSchoolSettings(settings: UpdateSchoolSettings, campusId?: string | null) {
  const qs = campusId ? `?campus_id=${encodeURIComponent(campusId)}` : ''
  return apiRequest<SchoolSettings>(`/school-settings${qs}`, {
    method: 'PUT',
    body: JSON.stringify({ ...settings, campus_id: campusId || undefined }),
  })
}

export async function sendTestDiaryReminder(email?: string) {
  return apiRequest<{ message: string }>('/school-settings/test-diary-reminder', {
    method: 'POST',
    body: JSON.stringify(email ? { email } : {}),
  })
}

/**
 * Convert first_name, last_name, father_name, grandfather_name in profiles
 * to titlecase for the current campus.
 * Mirrors RosarioSIS "Convert Names To Titlecase" plugin.
 */
export async function convertNamesTitlecase() {
  return apiRequest<{ converted: number }>('/school-settings/convert-names-titlecase', {
    method: 'POST',
  })
}

export async function triggerDiaryReminders() {
  return apiRequest<{ message: string; results: unknown }>('/school-settings/trigger-diary-reminders', {
    method: 'POST',
  })
}

// ─── SMTP API ─────────────────────────────────────────────────────────────────

export async function getSmtpSettings(campusId?: string | null) {
  const qs = campusId ? `?campus_id=${encodeURIComponent(campusId)}` : ''
  return apiRequest<SmtpSettings>(`/school-settings/smtp${qs}`)
}

export async function updateSmtpSettings(settings: Partial<SmtpSettings>, campusId?: string | null) {
  const qs = campusId ? `?campus_id=${encodeURIComponent(campusId)}` : ''
  return apiRequest<{ message: string }>(`/school-settings/smtp${qs}`, {
    method: 'PUT',
    body: JSON.stringify({ ...settings, campus_id: campusId || undefined }),
  })
}

export async function testSmtpSettings(params: Partial<SmtpSettings> & { test_email: string }, campusId?: string | null) {
  const qs = campusId ? `?campus_id=${encodeURIComponent(campusId)}` : ''
  return apiRequest<{ message: string }>(`/school-settings/smtp/test${qs}`, {
    method: 'POST',
    body: JSON.stringify({ ...params, campus_id: campusId || undefined }),
  })
}

// ─── PDF Header / Footer ──────────────────────────────────────────────────────

export interface PdfHeaderFooterSettings {
  pdf_header_html: string
  pdf_footer_html: string
  pdf_margin_top: number
  pdf_margin_bottom: number
  pdf_exclude_print: boolean
}

export async function getPdfHeaderFooter(campusId?: string | null) {
  const qs = campusId ? `?campus_id=${encodeURIComponent(campusId)}` : ''
  return apiRequest<PdfHeaderFooterSettings>(`/school-settings/pdf-header-footer${qs}`)
}

export async function updatePdfHeaderFooter(settings: Partial<PdfHeaderFooterSettings>, campusId?: string | null) {
  const qs = campusId ? `?campus_id=${encodeURIComponent(campusId)}` : ''
  return apiRequest<{ message: string }>(`/school-settings/pdf-header-footer${qs}`, {
    method: 'PUT',
    body: JSON.stringify({ ...settings, campus_id: campusId || undefined }),
  })
}
