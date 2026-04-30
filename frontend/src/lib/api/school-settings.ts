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

export type CurrencyOption = string

export const CURRENCY_OPTIONS: { value: string; label: string; symbol: string }[] = [
  { value: "AED", label: "UAE Dirham", symbol: "د.إ" },
  { value: "AFN", label: "Afghani", symbol: "؋" },
  { value: "ALL", label: "Lek", symbol: "L" },
  { value: "AMD", label: "Armenian Dram", symbol: "֏" },
  { value: "AOA", label: "Kwanza", symbol: "Kz" },
  { value: "ARS", label: "Argentine Peso", symbol: "$" },
  { value: "AUD", label: "Australian Dollar", symbol: "A$" },
  { value: "AWG", label: "Aruban Florin", symbol: "ƒ" },
  { value: "AZN", label: "Azerbaijanian Manat", symbol: "₼" },
  { value: "BAM", label: "Convertible Mark", symbol: "KM" },
  { value: "BBD", label: "Barbados Dollar", symbol: "$" },
  { value: "BDT", label: "Taka", symbol: "৳" },
  { value: "BHD", label: "Bahraini Dinar", symbol: "BD" },
  { value: "BIF", label: "Burundi Franc", symbol: "FBu" },
  { value: "BMD", label: "Bermudian Dollar", symbol: "$" },
  { value: "BND", label: "Brunei Dollar", symbol: "$" },
  { value: "BOB", label: "Boliviano", symbol: "$b" },
  { value: "BOV", label: "Mvdol", symbol: "BOV" },
  { value: "BRL", label: "Brazilian Real", symbol: "R$" },
  { value: "BSD", label: "Bahamian Dollar", symbol: "$" },
  { value: "BTN", label: "Ngultrum", symbol: "Nu." },
  { value: "BWP", label: "Pula", symbol: "P" },
  { value: "BYN", label: "Belarussian Ruble", symbol: "Br" },
  { value: "BZD", label: "Belize Dollar", symbol: "BZ$" },
  { value: "CAD", label: "Canadian Dollar", symbol: "CA$" },
  { value: "CDF", label: "Congolese Franc", symbol: "FC" },
  { value: "CHE", label: "WIR Euro", symbol: "CHE" },
  { value: "CHF", label: "Swiss Franc", symbol: "CHF" },
  { value: "CHW", label: "WIR Franc", symbol: "CHW" },
  { value: "CLF", label: "Unidad de Fomento", symbol: "CLF" },
  { value: "CLP", label: "Chilean Peso", symbol: "$" },
  { value: "CNY", label: "Yuan Renminbi", symbol: "¥" },
  { value: "COP", label: "Colombian Peso", symbol: "$" },
  { value: "COU", label: "Unidad de Valor Real", symbol: "COU" },
  { value: "CRC", label: "Costa Rican Colon", symbol: "₡" },
  { value: "CUC", label: "Peso Convertible", symbol: "$" },
  { value: "CUP", label: "Cuban Peso", symbol: "₱" },
  { value: "CVE", label: "Cabo Verde Escudo", symbol: "$" },
  { value: "CZK", label: "Czech Koruna", symbol: "Kč" },
  { value: "DJF", label: "Djibouti Franc", symbol: "Fdj" },
  { value: "DKK", label: "Danish Krone", symbol: "kr" },
  { value: "DOP", label: "Dominican Peso", symbol: "RD$" },
  { value: "DZD", label: "Algerian Dinar", symbol: "د.ج" },
  { value: "EGP", label: "Egyptian Pound", symbol: "E£" },
  { value: "ERN", label: "Nakfa", symbol: "Nfk" },
  { value: "ETB", label: "Ethiopian Birr", symbol: "Br" },
  { value: "EUR", label: "Euro", symbol: "€" },
  { value: "FJD", label: "Fiji Dollar", symbol: "$" },
  { value: "FKP", label: "Falkland Islands Pound", symbol: "£" },
  { value: "GBP", label: "Pound Sterling", symbol: "£" },
  { value: "GEL", label: "Lari", symbol: "₾" },
  { value: "GHS", label: "Ghana Cedi", symbol: "GH₵" },
  { value: "GIP", label: "Gibraltar Pound", symbol: "£" },
  { value: "GMD", label: "Dalasi", symbol: "D" },
  { value: "GNF", label: "Guinea Franc", symbol: "FG" },
  { value: "GTQ", label: "Quetzal", symbol: "Q" },
  { value: "GYD", label: "Guyana Dollar", symbol: "$" },
  { value: "HKD", label: "Hong Kong Dollar", symbol: "HK$" },
  { value: "HNL", label: "Lempira", symbol: "L" },
  { value: "HTG", label: "Gourde", symbol: "G" },
  { value: "HUF", label: "Forint", symbol: "Ft" },
  { value: "IDR", label: "Rupiah", symbol: "Rp" },
  { value: "ILS", label: "New Israeli Sheqel", symbol: "₪" },
  { value: "INR", label: "Indian Rupee", symbol: "₹" },
  { value: "IQD", label: "Iraqi Dinar", symbol: "د.ع" },
  { value: "IRR", label: "Iranian Rial", symbol: "IRR" },
  { value: "ISK", label: "Iceland Krona", symbol: "kr" },
  { value: "JMD", label: "Jamaican Dollar", symbol: "J$" },
  { value: "JOD", label: "Jordanian Dinar", symbol: "JD" },
  { value: "JPY", label: "Yen", symbol: "¥" },
  { value: "KES", label: "Kenyan Shilling", symbol: "KSh" },
  { value: "KGS", label: "Som", symbol: "лв" },
  { value: "KHR", label: "Riel", symbol: "៛" },
  { value: "KMF", label: "Comoro Franc", symbol: "CF" },
  { value: "KPW", label: "North Korean Won", symbol: "₩" },
  { value: "KRW", label: "Won", symbol: "₩" },
  { value: "KWD", label: "Kuwaiti Dinar", symbol: "KD" },
  { value: "KYD", label: "Cayman Islands Dollar", symbol: "$" },
  { value: "KZT", label: "Tenge", symbol: "₸" },
  { value: "LAK", label: "Kip", symbol: "₭" },
  { value: "LBP", label: "Lebanese Pound", symbol: "ل.ل" },
  { value: "LKR", label: "Sri Lanka Rupee", symbol: "₨" },
  { value: "LRD", label: "Liberian Dollar", symbol: "$" },
  { value: "LSL", label: "Loti", symbol: "L" },
  { value: "LYD", label: "Libyan Dinar", symbol: "ل.د" },
  { value: "MAD", label: "Moroccan Dirham", symbol: "د.م." },
  { value: "MDL", label: "Moldovan Leu", symbol: "L" },
  { value: "MGA", label: "Malagasy Ariary", symbol: "Ar" },
  { value: "MKD", label: "Denar", symbol: "ден" },
  { value: "MMK", label: "Kyat", symbol: "K" },
  { value: "MNT", label: "Tugrik", symbol: "₮" },
  { value: "MOP", label: "Pataca", symbol: "MOP$" },
  { value: "MRU", label: "Ouguiya", symbol: "UM" },
  { value: "MUR", label: "Mauritius Rupee", symbol: "₨" },
  { value: "MVR", label: "Rufiyaa", symbol: ".ރ" },
  { value: "MWK", label: "Kwacha", symbol: "MK" },
  { value: "MXN", label: "Mexican Peso", symbol: "$" },
  { value: "MXV", label: "Mexican Unidad de Inversion (UDI)", symbol: "MXV" },
  { value: "MYR", label: "Malaysian Ringgit", symbol: "RM" },
  { value: "MZN", label: "Mozambique Metical", symbol: "MT" },
  { value: "NAD", label: "Namibia Dollar", symbol: "$" },
  { value: "NGN", label: "Naira", symbol: "₦" },
  { value: "NIO", label: "Cordoba Oro", symbol: "C$" },
  { value: "NOK", label: "Norwegian Krone", symbol: "kr" },
  { value: "NPR", label: "Nepalese Rupee", symbol: "₨" },
  { value: "NZD", label: "New Zealand Dollar", symbol: "NZ$" },
  { value: "OMR", label: "Rial Omani", symbol: "OMR" },
  { value: "PAB", label: "Balboa", symbol: "B/." },
  { value: "PEN", label: "Nuevo Sol", symbol: "S/." },
  { value: "PGK", label: "Kina", symbol: "K" },
  { value: "PHP", label: "Philippine Peso", symbol: "₱" },
  { value: "PKR", label: "Pakistan Rupee", symbol: "₨" },
  { value: "PLN", label: "Zloty", symbol: "zł" },
  { value: "PYG", label: "Guarani", symbol: "Gs" },
  { value: "QAR", label: "Qatari Rial", symbol: "QR" },
  { value: "RON", label: "Romanian Leu", symbol: "lei" },
  { value: "RSD", label: "Serbian Dinar", symbol: "дин." },
  { value: "RUB", label: "Russian Ruble", symbol: "₽" },
  { value: "RWF", label: "Rwanda Franc", symbol: "FRw" },
  { value: "SAR", label: "Saudi Riyal", symbol: "﷼" },
  { value: "SBD", label: "Solomon Islands Dollar", symbol: "$" },
  { value: "SCR", label: "Seychelles Rupee", symbol: "₨" },
  { value: "SDG", label: "Sudanese Pound", symbol: "ج.س." },
  { value: "SEK", label: "Swedish Krona", symbol: "kr" },
  { value: "SGD", label: "Singapore Dollar", symbol: "S$" },
  { value: "SHP", label: "Saint Helena Pound", symbol: "£" },
  { value: "SLE", label: "Leone", symbol: "Le" },
  { value: "SOS", label: "Somali Shilling", symbol: "S" },
  { value: "SRD", label: "Surinam Dollar", symbol: "$" },
  { value: "SSP", label: "South Sudanese Pound", symbol: "£" },
  { value: "STN", label: "Dobra", symbol: "Db" },
  { value: "SVC", label: "El Salvador Colon", symbol: "$" },
  { value: "SYP", label: "Syrian Pound", symbol: "ل.س" },
  { value: "SZL", label: "Lilangeni", symbol: "E" },
  { value: "THB", label: "Baht", symbol: "฿" },
  { value: "TJS", label: "Somoni", symbol: "SM" },
  { value: "TMT", label: "Turkmenistan New Manat", symbol: "T" },
  { value: "TND", label: "Tunisian Dinar", symbol: "د.ت" },
  { value: "TOP", label: "Pa’anga", symbol: "T$" },
  { value: "TRY", label: "Turkish Lira", symbol: "₺" },
  { value: "TTD", label: "Trinidad and Tobago Dollar", symbol: "TT$" },
  { value: "TWD", label: "New Taiwan Dollar", symbol: "NT$" },
  { value: "TZS", label: "Tanzanian Shilling", symbol: "TSh" },
  { value: "UAH", label: "Hryvnia", symbol: "₴" },
  { value: "UGX", label: "Uganda Shilling", symbol: "USh" },
  { value: "USD", label: "US Dollar", symbol: "$" },
  { value: "USN", label: "US Dollar (Next day)", symbol: "USN" },
  { value: "UYI", label: "Uruguay Peso en Unidades Indexadas (URUIURUI)", symbol: "UYI" },
  { value: "UYU", label: "Peso Uruguayo", symbol: "$U" },
  { value: "UZS", label: "Uzbekistan Sum", symbol: "лв" },
  { value: "VED", label: "Bolivar", symbol: "VED" },
  { value: "VEF", label: "Bolivar", symbol: "Bs" },
  { value: "VND", label: "Dong", symbol: "₫" },
  { value: "VUV", label: "Vatu", symbol: "VT" },
  { value: "WST", label: "Tala", symbol: "WS$" },
  { value: "XAF", label: "CFA Franc BEAC", symbol: "FCFA" },
  { value: "XCD", label: "East Caribbean Dollar", symbol: "$" },
  { value: "XCG", label: "Caribbean Guilder", symbol: "XCG" },
  { value: "XDR", label: "SDR (Special Drawing Right)", symbol: "XDR" },
  { value: "XOF", label: "CFA Franc BCEAO", symbol: "CFA" },
  { value: "XPF", label: "CFP Franc", symbol: "₣" },
  { value: "XSU", label: "Sucre", symbol: "XSU" },
  { value: "XUA", label: "ADB Unit of Account", symbol: "XUA" },
  { value: "YER", label: "Yemeni Rial", symbol: "﷼" },
  { value: "ZAR", label: "Rand", symbol: "R" },
  { value: "ZMW", label: "Zambian Kwacha", symbol: "ZK" },
  { value: "ZWL", label: "Zimbabwe Dollar", symbol: "ZWL" },
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

export interface SocialLoginConfig {
  /** Restrict Google login to this Google Workspace domain (e.g. school.edu) */
  google_hosted_domain?: string | null
  /** Restrict Microsoft login to this Azure AD tenant ID or 'organizations'/'common' */
  microsoft_tenant?: string | null
  /** Google OAuth Client ID */
  google_client_id?: string | null
  /** Google OAuth Client Secret (masked when read) */
  google_client_secret?: string | null
  /** Microsoft OAuth Client ID */
  microsoft_client_id?: string | null
  /** Microsoft OAuth Client Secret (masked when read) */
  microsoft_client_secret?: string | null
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
  default_currency?: string
  hijri_offset?: number
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
  // Social Login
  social_login_config?: SocialLoginConfig | null
  // Custom Menu Order
  custom_menu_order?: Record<string, string[]> | null
  // Setup Assistant
  setup_assistant_config?: Record<string, boolean> | null
  created_at: string
  updated_at: string
}

export interface UpdateSchoolSettings {
  diary_reminder_enabled?: boolean
  diary_reminder_time?: string
  diary_reminder_days?: number[]
  hostel?: HostelSettings
  default_payment_method?: PaymentMethodOption
  default_currency?: string
  hijri_offset?: number
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
  // Social Login
  social_login_config?: SocialLoginConfig | null
  // Custom Menu Order
  custom_menu_order?: Record<string, string[]> | null
  // Setup Assistant
  setup_assistant_config?: Record<string, boolean> | null
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

// ─── Social Login Credentials ─────────────────────────────────────────────────

export interface SocialLoginSettings {
  google_enabled: boolean
  google_client_id: string
  google_client_secret: string
  google_hosted_domain: string
  has_google_secret: boolean
  microsoft_enabled: boolean
  microsoft_client_id: string
  microsoft_client_secret: string
  microsoft_tenant: string
  has_microsoft_secret: boolean
}

export async function getSocialLoginSettings(campusId?: string | null) {
  const qs = campusId ? `?campus_id=${encodeURIComponent(campusId)}` : ''
  return apiRequest<SocialLoginSettings>(`/school-settings/social-login${qs}`)
}

export async function updateSocialLoginSettings(
  settings: Partial<SocialLoginSettings>,
  campusId?: string | null
) {
  const qs = campusId ? `?campus_id=${encodeURIComponent(campusId)}` : ''
  return apiRequest<{ message: string }>(`/school-settings/social-login${qs}`, {
    method: 'PUT',
    body: JSON.stringify({ ...settings, campus_id: campusId || undefined }),
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
