// Super admin ("platform") API: dashboard summary, school directory, platform billing.
// All endpoints are super_admin-only on the server. No school impersonation (no X-School-Id):
// per-school actions use the school id in the URL.
import type { CampusScope, CustomFieldType } from '@studently/shared-types'

import type { ApiClient } from '../client'
import { qs } from '../query'

// ── Dashboard (GET /dashboard/summary, backend/src/services/platform-summary.ts) ──

export interface CurrencyRevenue {
  currency: string
  paid_this_month: number
  paid_last_month: number
  change_pct: number | null
  paid_total: number
  outstanding: number
}

export interface PlatformSummary {
  schools: {
    total: number
    active: number
    suspended: number
    on_trial: number
    trials_ending_7d: number
    new_this_month: number
    new_last_month: number
  }
  invoices: { total: number; paid: number; unpaid: number; pending: number; overdue: number; due_next_30d: number }
  revenue: CurrencyRevenue[]
  trials_ending: { id: string; name: string; trial_ends_at?: string | null; logo_url?: string | null }[]
  recent_schools: {
    id: string
    name: string
    status: string | null
    is_trial?: boolean | null
    trial_ends_at?: string | null
    created_at: string
    logo_url?: string | null
  }[]
  generated_at: string
}

// ── Schools (backend/src/routes/school.routes.ts) ──

export type SchoolStatus = 'active' | 'suspended'
export type LogoShape = 'circle' | 'rounded' | 'square' | 'rectangle'

/** GET /dashboard/stats (web "Platform Statistics"; root schools only). */
export interface PlatformStats {
  totalSchools: number
  activeSchools: number
  suspendedSchools: number
  totalRevenue: number
  totalBillings: number
  paidBillings: number
  pendingBillings: number
  overdueBillings: number
}

/** GET /dashboard/school-growth: cumulative root schools per month (Jan..Dec). */
export interface MonthlySchoolGrowth {
  month: string
  schools: number
}

/** GET /dashboard/revenue: paid amount and invoice count per month (all currencies summed, as on the web). */
export interface MonthlyRevenue {
  month: string
  revenue: number
  subscriptions: number
}

export interface SchoolLogoAppearance {
  logo_shape: LogoShape
  logo_border_width: number
  logo_border_color: string
}

/** PATCH /schools/:id/admin (web EditSchoolModal). Password only when changing it (min 8). */
export interface UpdateSchoolAdminInput {
  admin_name?: string
  admin_email?: string
  username?: string
  password?: string
}

export interface PlatformSchool {
  id: string
  name: string
  slug: string
  status: SchoolStatus
  logo_url: string | null
  logo_shape?: LogoShape
  logo_border_width?: number
  logo_border_color?: string
  website: string | null
  contact_email: string
  address: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  phone: string | null
  principal_name: string | null
  short_name: string | null
  school_number: string | null
  parent_school_id: string | null
  is_trial: boolean
  trial_ends_at: string | null
  created_at: string
  updated_at?: string
}

export interface SchoolAdminInfo {
  admin_name: string
  admin_email: string
  admin_username: string
  user_id: string
}

export interface SchoolAdminCredentials {
  admin_name: string
  admin_email: string
  username: string
  /** null when no password is stored (read with regenerate=false). */
  password: string | null
  has_password: boolean
}

export type UpdateSchoolInput = Partial<
  Pick<
    PlatformSchool,
    'name' | 'short_name' | 'contact_email' | 'phone' | 'website' | 'address' | 'city' | 'state' | 'zip_code' | 'principal_name' | 'school_number' | 'is_trial' | 'trial_ends_at' | 'logo_url'
  >
>

// ── Billing (backend/src/routes/platform-billing.routes.ts) ──

export type BillingCycle = 'Monthly' | 'Quarterly' | 'Yearly'
export type PaymentStatus = 'paid' | 'unpaid' | 'overdue' | 'pending'

export interface BillingPlan {
  id: string
  name: string
  description: string | null
  monthly_price: number
  quarterly_price: number
  yearly_price: number
  max_students: number | null
  features: string[]
  is_active: boolean
  created_at: string
}

export type BillingPlanInput = Omit<BillingPlan, 'id' | 'created_at' | 'description' | 'max_students' | 'features' | 'is_active'> & {
  description?: string | null
  max_students?: number | null
  features?: string[]
  is_active?: boolean
}

export interface BillingRecord {
  id: string
  school_id: string
  school_name: string | null
  billing_plan_id: string
  subscription_plan: string | null
  billing_cycle: BillingCycle
  amount: number
  currency: string
  start_date: string
  due_date: string
  payment_status: PaymentStatus
  /** Status to show: unpaid/pending past the due date -> 'overdue' (stored status unchanged). */
  effective_status: PaymentStatus
  payment_date: string | null
  payment_method: string | null
  transaction_id: string | null
  notes: string | null
  invoice_number: string
  created_at: string
}

export interface BillingRecordInput {
  school_id: string
  billing_plan_id: string
  billing_cycle: BillingCycle
  amount: number
  currency: string
  start_date: string
  due_date: string
  payment_status: PaymentStatus
  payment_date?: string | null
  payment_method?: string | null
  transaction_id?: string | null
  notes?: string | null
}

export interface BillingRecordFilters {
  page?: number
  limit?: number
  status?: PaymentStatus
  school_id?: string
  search?: string
  due_from?: string
  due_to?: string
}

// ── Feedback & login quotes (backend/src/routes/{feedback,quotes}.routes.ts) ──

export type FeedbackStatus = 'open' | 'in_progress' | 'resolved'
export type FeedbackCategory = 'feature_request' | 'bug'

export interface FeedbackReport {
  id: string
  school_id: string | null
  campus_id: string | null
  submitted_by: string | null
  submitter_role: string | null
  submitter_name: string | null
  submitter_email: string | null
  title: string
  description: string
  category: FeedbackCategory
  status: FeedbackStatus
  created_at: string
  updated_at: string
}

export interface LoginQuote {
  id: string
  text_en: string
  text_ar: string
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export type QuoteRotation = 'weekly' | 'monthly'

// ── Onboarding (POST /schools/onboard, POST /user-profiles/seed-defaults) ──

export interface OnboardSchoolInput {
  school: {
    name: string
    slug: string
    contact_email: string
    address?: string | null
    website?: string | null
    logo_url?: string | null
    is_trial?: boolean
    trial_ends_at?: string | null
  }
  admin: { first_name: string; last_name: string; password: string; username?: string; email?: string }
  /** First invoice; the school id is filled in by the server. */
  billing?: Omit<BillingRecordInput, 'school_id'>
}

export interface OnboardSchoolResult {
  school: PlatformSchool
  admin: { id: string; email: string; username: string; first_name: string; last_name: string }
  billing?: BillingRecord | null
}

// ── Platform settings (backend/src/routes/dashboard.routes.ts, auth.routes.ts) ──

export interface PlatformSettings {
  currency?: string
  support_email?: string
  max_schools?: number
  [key: string]: unknown
}

export interface PlatformBranding {
  logo_shape: LogoShape
  logo_border_width: number
  logo_border_color: string
}

// ── Login page (backend/src/routes/login-page-config.routes.ts) ──

export interface LoginPageConfig {
  background_type: 'gradient' | 'color' | 'image'
  gradient_from: string
  gradient_to: string
  background_color: string
  background_image_url: string | null
  background_image_opacity: number
  text_color_left: string
  text_color_right: string
  logo_url: string | null
  form_offset_x: number
  form_offset_y: number
  form_width: number
  title_en: string
  title_ar: string
  subtitle_en: string
  subtitle_ar: string
  heading_en: string
  heading_ar: string
}

/** Same defaults as the web (frontend/src/lib/api/login-page-config.ts). */
export const DEFAULT_LOGIN_PAGE_CONFIG: LoginPageConfig = {
  background_type: 'gradient',
  gradient_from: '#57A3CC',
  gradient_to: '#022172',
  background_color: '#022172',
  background_image_url: null,
  background_image_opacity: 1,
  text_color_left: '#022172',
  text_color_right: '#ffffff',
  logo_url: null,
  form_offset_x: 0,
  form_offset_y: 0,
  form_width: 448,
  title_en: '',
  title_ar: '',
  subtitle_en: '',
  subtitle_ar: '',
  heading_en: '',
  heading_ar: '',
}

// ── Global public pages (backend/src/routes/public-pages.routes.ts, /public/superadmin/global-pages) ──

export type GlobalPageType = 'url' | 'embed' | 'text' | 'image'
export type GlobalPageRole = 'admin' | 'teacher' | 'student' | 'parent'

export interface GlobalPage {
  id: string
  title: string
  page_type: GlobalPageType
  url?: string
  /** HTML for text pages (edited with a rich text editor on the web). */
  content?: string
  image_url?: string
  order: number
  isActive: boolean
  /** Draft: hidden from users. */
  is_template?: boolean
  start_date?: string
  end_date?: string
  /** Empty = everyone. */
  visible_to_roles?: GlobalPageRole[]
}

export type GlobalPageInput = Omit<GlobalPage, 'id' | 'order'>

// ── Sidebar appearance (backend/src/routes/sidebar-config.routes.ts) ──

export interface SidebarConfig {
  id?: string
  scope?: 'superadmin' | 'school' | 'campus'
  school_id?: string | null
  campus_id?: string | null
  bg_color: string | null
  bg_image_url: string | null
  bg_image_opacity: number
  text_color: string | null
  /** CSS background-position: top | center | bottom | left | right */
  bg_image_position: string | null
}

export type SidebarConfigInput = Partial<Pick<SidebarConfig, 'bg_color' | 'bg_image_url' | 'bg_image_opacity' | 'text_color' | 'bg_image_position'>>

// ── School custom fields (backend/src/routes/custom-fields.routes.ts, ?campus_id=<schoolId>) ──

export interface SchoolFieldDefinition {
  id: string
  school_id: string
  entity_type: 'school'
  category_id: string
  category_name: string
  field_key: string
  label: string
  label_ar?: string | null
  type: CustomFieldType
  options?: string[] | null
  required: boolean
  sort_order: number
  category_order?: number
  campus_scope: CampusScope
  applicable_school_ids?: string[] | null
  is_active?: boolean
}

export interface SchoolFieldInput {
  category_id: string
  category_name: string
  label: string
  type: CustomFieldType
  options?: string[]
  required: boolean
  campus_scope: CampusScope
  applicable_school_ids?: string[]
}

// ── Copy settings between schools (POST /schools/:id/copy-settings) ──

export interface CopySchoolSettingsOptions {
  gradeLevels?: boolean
  periods?: boolean
  gradingScales?: boolean
  defaultFieldOrders?: boolean
  customFields?: boolean
  markingPeriods?: boolean
  accountingCategories?: boolean
}

export interface CopySchoolSettingsResult {
  counts: {
    gradeLevels: number
    sections: number
    periods: number
    gradingScales: number
    defaultFieldOrders: number
    customFields: number
    markingPeriods: number
    accountingCategories: number
  }
  errors: string[]
}

export function platformApi(api: ApiClient) {
  const id = (v: string) => encodeURIComponent(v)
  return {
    getSummary: () => api.get<PlatformSummary>('/dashboard/summary'),
    getStats: () => api.get<PlatformStats>('/dashboard/stats'),
    getSchoolGrowth: (year?: number) => api.get<MonthlySchoolGrowth[]>(`/dashboard/school-growth${qs({ year })}`),
    getRevenue: (year?: number) => api.get<MonthlyRevenue[]>(`/dashboard/revenue${qs({ year })}`),

    // Schools
    listSchools: (status?: SchoolStatus) => api.get<PlatformSchool[]>(`/schools${qs({ status })}`),
    getSchool: (schoolId: string) => api.get<PlatformSchool>(`/schools/${id(schoolId)}`),
    updateSchool: (schoolId: string, input: UpdateSchoolInput) => api.patch<PlatformSchool>(`/schools/${id(schoolId)}`, input),
    setSchoolStatus: (schoolId: string, status: SchoolStatus) =>
      api.patch<PlatformSchool>(`/schools/${id(schoolId)}/status`, { status }),
    getSchoolAdmin: (schoolId: string) => api.get<SchoolAdminInfo>(`/schools/${id(schoolId)}/admin`),
    updateSchoolAdmin: (schoolId: string, input: UpdateSchoolAdminInput) => api.patch<unknown>(`/schools/${id(schoolId)}/admin`, input),
    getLogoAppearance: (schoolId: string) => api.get<SchoolLogoAppearance>(`/schools/${id(schoolId)}/logo-appearance`),
    updateLogoAppearance: (schoolId: string, input: SchoolLogoAppearance) =>
      api.patch<SchoolLogoAppearance>(`/schools/${id(schoolId)}/logo-appearance`, input),
    /** Never resets the password on read (regenerate=false). */
    getSchoolAdminCredentials: (schoolId: string) =>
      api.get<SchoolAdminCredentials>(`/schools/${id(schoolId)}/admin/credentials${qs({ regenerate: 'false' })}`),
    /** Resets the admin's real password; they must change it at next sign-in. */
    regenerateSchoolAdminCredentials: (schoolId: string) =>
      api.post<SchoolAdminCredentials>(`/schools/${id(schoolId)}/admin/credentials/regenerate`),
    /** Copies setup (grades, periods, ...) from another school into this one. */
    copySchoolSettings: (targetSchoolId: string, sourceSchoolId: string, options: CopySchoolSettingsOptions) =>
      api.post<CopySchoolSettingsResult>(`/schools/${id(targetSchoolId)}/copy-settings`, { source_school_id: sourceSchoolId, options }, { timeout: 120_000 }),

    // School custom fields (the school's id goes in ?campus_id; the server checks super admin)
    listSchoolFields: (schoolId: string) =>
      api.get<SchoolFieldDefinition[]>(`/custom-fields/school${qs({ campus_id: schoolId })}`),
    createSchoolField: (schoolId: string, input: SchoolFieldInput) =>
      api.post<SchoolFieldDefinition>(`/custom-fields${qs({ campus_id: schoolId })}`, { entity_type: 'school', ...input }),
    updateSchoolField: (schoolId: string, fieldId: string, input: Partial<SchoolFieldInput>) =>
      api.patch<SchoolFieldDefinition>(`/custom-fields/${id(fieldId)}${qs({ campus_id: schoolId })}`, input),
    deleteSchoolField: (schoolId: string, fieldId: string) =>
      api.del<void>(`/custom-fields/${id(fieldId)}${qs({ campus_id: schoolId })}`),
    reorderSchoolFields: (schoolId: string, categoryId: string, items: { id: string; sort_order: number }[]) =>
      api.post<void>(`/custom-fields/reorder${qs({ campus_id: schoolId })}`, { category_id: categoryId, items }),

    // Billing plans
    listPlans: (includeInactive = false) =>
      api.get<BillingPlan[]>(`/platform-billing/plans${qs({ include_inactive: includeInactive ? 'true' : undefined })}`),
    createPlan: (input: BillingPlanInput) => api.post<BillingPlan>('/platform-billing/plans', input),
    updatePlan: (planId: string, input: Partial<BillingPlanInput>) => api.put<BillingPlan>(`/platform-billing/plans/${id(planId)}`, input),
    deletePlan: (planId: string) => api.del<void>(`/platform-billing/plans/${id(planId)}`),

    // Billing records (invoices)
    listRecords: (filters: BillingRecordFilters = {}) => api.get<BillingRecord[]>(`/platform-billing/records${qs({ ...filters })}`),
    getRecord: (recordId: string) => api.get<BillingRecord>(`/platform-billing/records/${id(recordId)}`),
    createRecord: (input: BillingRecordInput) => api.post<BillingRecord>('/platform-billing/records', input),
    updateRecord: (recordId: string, input: Partial<BillingRecordInput>) =>
      api.put<BillingRecord>(`/platform-billing/records/${id(recordId)}`, input),
    markRecordPaid: (recordId: string, paymentDate?: string) =>
      api.post<BillingRecord>(`/platform-billing/records/${id(recordId)}/mark-paid`, { payment_date: paymentDate }),
    deleteRecord: (recordId: string) => api.del<void>(`/platform-billing/records/${id(recordId)}`),

    // Platform settings (merged server-side; send only changed keys)
    getPlatformSettings: () => api.get<PlatformSettings>('/dashboard/platform-settings'),
    updatePlatformSettings: (patch: Partial<PlatformSettings>) => api.put<PlatformSettings>('/dashboard/platform-settings', patch),
    getBranding: () => api.get<PlatformBranding>('/dashboard/branding'),
    updateBranding: (patch: Partial<PlatformBranding>) => api.put<PlatformBranding>('/dashboard/branding', patch),
    /** Own profile (any role): avatar/photo, names, phone. */
    updateOwnProfile: (patch: { first_name?: string; last_name?: string; phone?: string; avatar_url?: string; profile_photo_url?: string }) =>
      api.put<unknown>('/auth/profile', patch),

    // Login page
    getLoginPageConfig: () => api.get<Partial<LoginPageConfig>>('/login-page-config', { public: true }),
    updateLoginPageConfig: (patch: Partial<LoginPageConfig>) => api.put<LoginPageConfig>('/login-page-config', patch),
    resetLoginPageConfig: () => api.post<LoginPageConfig>('/login-page-config/reset'),

    // Global public pages
    listGlobalPages: () => api.get<GlobalPage[]>('/public/superadmin/global-pages'),
    /** Public: active global pages shown under "About" on the login page. */
    getLoginLinks: () => api.get<GlobalPage[]>('/public/login-links', { public: true }),
    createGlobalPage: (input: GlobalPageInput) => api.post<GlobalPage>('/public/superadmin/global-pages', input),
    updateGlobalPage: (pageId: string, input: Partial<GlobalPageInput>) =>
      api.put<GlobalPage>(`/public/superadmin/global-pages/${id(pageId)}`, input),
    deleteGlobalPage: (pageId: string) => api.del<void>(`/public/superadmin/global-pages/${id(pageId)}`),
    reorderGlobalPages: (orderedIds: string[]) => api.put<GlobalPage[]>('/public/superadmin/global-pages/reorder', { orderedIds }),

    // Sidebar appearance: the super admin's own, or a school's (no impersonation; id in the URL)
    getSidebarConfig: (schoolId?: string) =>
      api.get<SidebarConfig | null>(schoolId ? `/sidebar-config/school/${id(schoolId)}` : '/sidebar-config/superadmin'),
    updateSidebarConfig: (input: SidebarConfigInput, schoolId?: string) =>
      api.put<SidebarConfig>(schoolId ? `/sidebar-config/school/${id(schoolId)}` : '/sidebar-config/superadmin', input),
    resetSidebarConfig: (schoolId?: string) =>
      api.post<SidebarConfig>(schoolId ? `/sidebar-config/school/${id(schoolId)}/reset` : '/sidebar-config/superadmin/reset'),

    // Per-school module access (super admin). Deny-list: null = never set (old allow-list may apply).
    getAllowedModules: (schoolId: string) =>
      api.get<{ allowed_modules: string[] | null }>(`/school-settings/allowed-modules${qs({ school_id: schoolId })}`),
    getDeniedModules: (schoolId: string) =>
      api.get<{ denied_modules: string[] | null }>(`/school-settings/denied-modules${qs({ school_id: schoolId })}`),
    setDeniedModules: (schoolId: string, deniedModules: string[] | null) =>
      api.put<{ denied_modules: string[] | null }>('/school-settings/denied-modules', { school_id: schoolId, denied_modules: deniedModules }),

    // Onboarding
    onboardSchool: (input: OnboardSchoolInput) => api.post<OnboardSchoolResult>('/schools/onboard', input, { timeout: 60_000 }),
    /** Default staff roles for a school (super admin passes the new school's id). */
    seedDefaultRoles: (schoolId: string, roles: { teacher: string[]; staff: string[]; librarian: string[] }) =>
      api.post<unknown>('/user-profiles/seed-defaults', { roles, mode: 'reset', school_id: schoolId }),

    // Feedback from schools
    listFeedback: (filters: { status?: FeedbackStatus; category?: FeedbackCategory } = {}) =>
      api.get<FeedbackReport[]>(`/feedback${qs({ ...filters })}`),
    getFeedbackCount: () => api.get<{ count: number }>('/feedback/count'),
    setFeedbackStatus: (feedbackId: string, status: FeedbackStatus) =>
      api.patch<FeedbackReport>(`/feedback/${id(feedbackId)}`, { status }),

    // Login page quotes
    listQuotes: () => api.get<LoginQuote[]>('/quotes'),
    /** Public: the quote the login page shows now (rotation applied on the server). */
    getCurrentQuote: () => api.get<LoginQuote | null>('/quotes/current', { public: true }),
    createQuote: (input: { text_en: string; text_ar: string; is_active?: boolean; sort_order?: number }) =>
      api.post<LoginQuote>('/quotes', input),
    updateQuote: (quoteId: string, input: Partial<Pick<LoginQuote, 'text_en' | 'text_ar' | 'is_active' | 'sort_order'>>) =>
      api.put<LoginQuote>(`/quotes/${id(quoteId)}`, input),
    deleteQuote: (quoteId: string) => api.del<{ deleted: boolean }>(`/quotes/${id(quoteId)}`),
    reorderQuotes: (orderedIds: string[]) => api.put<{ reordered: boolean }>('/quotes/reorder', { ordered_ids: orderedIds }),
    getQuoteSettings: () => api.get<{ id: string; rotation: QuoteRotation; updated_at: string }>('/quotes/settings'),
    setQuoteRotation: (rotation: QuoteRotation) =>
      api.put<{ id: string; rotation: QuoteRotation; updated_at: string }>('/quotes/settings', { rotation }),
  }
}

export type PlatformApi = ReturnType<typeof platformApi>
