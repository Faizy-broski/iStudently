// Student billing (backend/src/routes/fees.routes.ts, /fees). Every call carries the campus as
// school_id; the server resolves and checks it (own school family only).
import type { ApiClient } from '../../client'
import { qs } from '../../query'
import type { ApiResponse } from '../../types'

export type StudentFeeStatus = 'pending' | 'partial' | 'paid' | 'overdue' | 'waived'
export type PaymentMethod = 'cash' | 'online' | 'bank_deposit' | 'cheque'

export interface FeeDashboard {
  total_fees: number
  total_collected: number
  total_pending: number
  total_overdue: number
  counts: Record<StudentFeeStatus, number>
}

export interface StudentFee {
  id: string
  student_id: string
  academic_year: string
  fee_month?: string
  base_amount: number
  sibling_discount: number
  custom_discount: number
  late_fee_applied: number
  final_amount: number
  amount_paid: number
  balance: number
  status: StudentFeeStatus
  due_date: string
  discount_forfeited: boolean
  fee_breakdown?: { category_id: string; category_name: string; category_code: string; amount: number; is_override?: boolean }[]
  students?: { student_number: string; profiles: { first_name: string; last_name: string; father_name?: string | null }; grade_levels?: { name: string } | null }
  fee_structures?: { fee_categories?: { name: string } | null } | null
}

export type FeeAdjustmentType = 'late_fee_removed' | 'late_fee_reduced' | 'custom_discount' | 'fee_waived' | 'discount_restored'

export interface FeeAdjustment {
  id: string
  student_fee_id: string
  adjustment_type: FeeAdjustmentType
  amount_before: number
  amount_after: number
  adjustment_amount: number
  reason: string
  created_at: string
  adjusted_by_profile?: { first_name: string; last_name: string } | null
}

/** One fee record with its payments (web: FeeChallanModal). */
export interface StudentFeeDetail extends StudentFee {
  services_amount?: number | null
  discount_reason?: string | null
  late_fee_applied_at?: string | null
  notes?: string | null
  payments: { id: string; amount: number; payment_method?: string | null; payment_reference?: string | null; payment_date: string; notes?: string | null }[]
}

/** A row in the payments student picker. */
export interface PaymentStudent {
  id: string
  student_number: string
  grade_level?: string | null
  profiles: { first_name: string; last_name: string; email?: string; phone?: string }
  grade_levels?: { id: string; name: string } | null
  sections?: { id: string; name: string } | null
  custom_fields?: { ethnicity?: string; gender?: string; address?: string; city?: string; state?: string; zip_code?: string } | null
  parent_student_links?: {
    parent_id: string
    relationship: string
    parents?: { id: string; address: string | null; city: string | null; state: string | null; zip_code: string | null; profiles?: { first_name: string; last_name: string } | null } | null
  }[]
}

export interface StudentPayment {
  id: string
  receipt_number?: string
  manual_receipt_number?: string
  /** Set on refunds: the payment this refunds (amount is negative). */
  refund_of?: string | null
  amount: number
  payment_date: string
  comment?: string
  is_lunch_payment: boolean
  payment_method?: PaymentMethod
  file_url?: string
  created_at: string
  created_by_profile?: { first_name: string; last_name: string } | null
}

export interface StudentLedger {
  payments: StudentPayment[]
  summary: { totalFees: number; totalPayments: number; balance: number }
  studentInfo?: { id: string; student_number: string; first_name: string; last_name: string }
}

export interface RecordPaymentInput {
  student_id: string
  amount: number
  /** YYYY-MM-DD */
  payment_date: string
  payment_method: PaymentMethod
  comment?: string | null
  is_lunch_payment?: boolean
  manual_receipt_number?: string
  /** Your own receipt number; generated when left out. */
  receipt_number?: string
  /** Attachment URL from media.uploadAttachment. */
  file_url?: string
}

export interface FeeCategory {
  id: string
  name: string
  code: string
  description?: string | null
  is_mandatory: boolean
  is_discountable: boolean
  display_order: number
  is_active: boolean
}

/** What the web's category form sends (code is upper-cased). */
export type FeeCategoryInput = Pick<FeeCategory, 'name' | 'code' | 'is_discountable'> & { is_active?: boolean }

export type PeriodType = 'monthly' | 'termly' | 'quarterly' | 'semester' | 'annual' | 'one_time'

export interface FeeStructure {
  id: string
  academic_year: string
  grade_level_id: string
  fee_category_id: string
  period_type: PeriodType
  period_name?: string | null
  period_number?: number | null
  amount: number
  due_date: string
  grade_level?: { name: string }
  fee_category?: { name: string }
}

export interface FeeStructureInput {
  academic_year: string
  grade_level_id: string
  fee_category_id: string
  period_type: PeriodType
  period_name?: string | null
  /** Needed for termly/quarterly/semester so generation can tell Term 1 from Term 2. */
  period_number?: number | null
  amount: number
  due_date: string
}

export interface GenerateFeesInput {
  /** Academic year name, e.g. "2026-2027" (must match the fee structures). */
  academic_year: string
  period_type: PeriodType
  /** Monthly billing only: 1-12 and the year. */
  month?: number
  year?: number
  period_number?: number
  /** Empty/undefined = all grades. */
  grade_level_id?: string[]
  section_id?: string[]
  /** null = all categories. */
  category_ids?: string[] | null
  student_status?: 'active' | 'inactive'
  gender?: 'male' | 'female'
  /** true = only students with a sibling on record, false = only without. */
  has_siblings?: boolean
}

export interface GenerateFeesResult {
  feesCreated: number
  studentsProcessed: number
  studentsFound?: number
  skippedNoGrade: number
  skippedNoFeeStructures: number
  skippedZeroAmount: number
  skippedError: number
  skippedAlreadyExists?: number
}

export interface FeeOverride {
  id: string
  student_id: string
  fee_category_id: string
  academic_year: string
  override_amount: number
  reason?: string | null
  is_active: boolean
  fee_categories?: { name: string; code: string }
  students?: { id: string; student_number?: string; profiles: { first_name: string; last_name: string }; grade_levels?: { name: string } }
}

/** Discount for a family with this many enrolled siblings. */
export interface SiblingDiscountTier {
  id?: string
  sibling_count: number
  discount_type: 'percentage' | 'fixed'
  discount_value: number
  applies_to_categories?: string[]
}

export interface FeeSettings {
  enable_late_fees: boolean
  late_fee_type: 'percentage' | 'fixed'
  late_fee_value: number
  grace_days: number
  enable_sibling_discounts: boolean
  discount_forfeiture_enabled: boolean
  admin_can_restore_discounts: boolean
  allow_partial_payments: boolean
  min_partial_payment_percent: number
}

export interface StudentWithPayments {
  id: string
  student_number: string
  profiles: { first_name: string; last_name: string }
  grade_levels?: { id: string; name: string } | null
  sections?: { name: string } | null
  payments: (StudentPayment & { student_fee_id?: string })[]
  balance: number
  parent_student_links?: { parent_id: string; parents?: { profiles?: { first_name: string; last_name: string } | null } | null }[]
}

export function adminFeesApi(api: ApiClient) {
  const id = (v: string) => encodeURIComponent(v)
  return {
    dashboard: (campusId: string, academicYear?: string) => api.get<FeeDashboard>(`/fees/dashboard${qs({ school_id: campusId, academic_year: academicYear })}`),
    /** Fee records (one per student per month), e.g. for balances. */
    studentFees: (campusId: string, p: { student_id?: string; status?: StudentFeeStatus; academic_year?: string; page?: number; limit?: number } = {}) =>
      api.get<StudentFee[]>(`/fees/students${qs({ school_id: campusId, ...p })}`),
    paymentStudents: (campusId: string, p: { search?: string; grade_level_id?: string; grade_level_ids?: string[]; section_ids?: string[]; page?: number; limit?: number } = {}) =>
      api.get<PaymentStudent[]>(
        `/fees/payments/students${qs({
          school_id: campusId,
          search: p.search,
          grade_level_id: Array.isArray(p.grade_level_ids) && p.grade_level_ids.length ? p.grade_level_ids.join(',') : p.grade_level_id,
          section_id: Array.isArray(p.section_ids) && p.section_ids.length ? p.section_ids.join(',') : undefined,
          page: p.page,
          limit: p.limit,
        })}`,
      ),
    /** All payments of one student with totals (fees billed, paid, balance). */
    ledger: (campusId: string, studentId: string) => api.get<StudentLedger>(`/fees/payments/student/${id(studentId)}${qs({ school_id: campusId })}`),
    recordPayment: (campusId: string, input: RecordPaymentInput) => api.post<StudentPayment>('/fees/payments/record', { ...input, school_id: campusId }),
    refundPayment: (campusId: string, paymentId: string, amount: number, comment?: string) =>
      api.post<StudentPayment>(`/fees/payments/${id(paymentId)}/refund`, { school_id: campusId, amount, comment: comment || undefined }),
    /** Edit a payment (amount, date, method, comment, lunch, MRN) or set its attachment. */
    updatePayment: (
      campusId: string,
      paymentId: string,
      patch: Partial<{ amount: number; payment_date: string; comment: string | null; is_lunch_payment: boolean; payment_method: PaymentMethod; manual_receipt_number: string | null; file_url: string }>,
    ) => api.put<StudentPayment>(`/fees/payments/${id(paymentId)}`, { ...patch, school_id: campusId }),
    deletePayment: (campusId: string, paymentId: string) => api.del<void>(`/fees/payments/${id(paymentId)}${qs({ school_id: campusId })}`),
    categories: (campusId: string) => api.get<FeeCategory[]>(`/fees/categories${qs({ school_id: campusId })}`),
    createCategory: (campusId: string, input: FeeCategoryInput) => api.post<FeeCategory>('/fees/categories', { ...input, school_id: campusId }),
    updateCategory: (campusId: string, categoryId: string, input: Partial<FeeCategoryInput>) =>
      api.put<FeeCategory>(`/fees/categories/${id(categoryId)}`, { ...input, school_id: campusId }),
    deleteCategory: (campusId: string, categoryId: string) => api.del<void>(`/fees/categories/${id(categoryId)}${qs({ school_id: campusId })}`),
    /** academicYear is the year's name (e.g. "2026-2027"), as the web uses. */
    structures: (campusId: string, academicYear: string) => api.get<FeeStructure[]>(`/fees/structures${qs({ school_id: campusId, academic_year: academicYear })}`),
    createStructure: (campusId: string, input: FeeStructureInput) => api.post<FeeStructure>('/fees/structures', { ...input, school_id: campusId }),
    updateStructure: (campusId: string, structureId: string, input: Partial<FeeStructureInput>) =>
      api.put<FeeStructure>(`/fees/structures/${id(structureId)}`, { ...input, school_id: campusId }),
    deleteStructure: (campusId: string, structureId: string) => api.del<void>(`/fees/structures/${id(structureId)}${qs({ school_id: campusId })}`),
    /** Creates fee records from the structures; the response also has `message` and `severity`. */
    generate: (campusId: string, input: GenerateFeesInput) =>
      api.post<GenerateFeesResult>('/fees/generate-monthly', { ...input, school_id: campusId }, { timeout: 120_000 }) as Promise<
        ApiResponse<GenerateFeesResult> & { severity?: 'success' | 'info' | 'warning' }
      >,
    /** Fee record for one student (web: Generate Fees, "Individual student"); returns the new fee. */
    generateForStudent: (
      campusId: string,
      input: { student_id: string; grade_id: string; academic_year: string; period_type: PeriodType; category_ids: string[] | null; fee_month?: string; due_date?: string; period_number?: number },
    ) => api.post<StudentFee>('/fees/generate-for-student', { ...input, service_ids: [], school_id: campusId }, { timeout: 60_000 }),
    /** First fee challan for a newly added student, with their services (web AddStudentForm: generateFeeForNewStudent). */
    generateFirstFee: (campusId: string | undefined, input: { student_id: string; grade_id: string; service_ids: string[]; academic_year: string; fee_month: string; due_date: string }) =>
      api.post<StudentFee>('/fees/generate-for-student', { ...input, campus_id: campusId }, { timeout: 60_000 }),
    /** Custom amounts for one student + category in a year (returned with the usual `pagination`). */
    overrides: async (campusId: string, p: { academic_year?: string; page?: number; limit?: number } = {}): Promise<ApiResponse<FeeOverride[]>> => {
      const limit = p.limit ?? 50
      const res = (await api.get<FeeOverride[]>(`/fees/overrides${qs({ school_id: campusId, academic_year: p.academic_year, page: p.page, limit })}`)) as ApiResponse<FeeOverride[]> & { total?: number }
      if (!res.success) return res
      const total = res.total ?? res.data?.length ?? 0
      return { success: true, status: res.status, data: res.data ?? [], pagination: { total, page: p.page ?? 1, limit, totalPages: Math.max(1, Math.ceil(total / limit)) } }
    },
    createOverride: (campusId: string, input: { student_id: string; fee_category_id: string; academic_year: string; override_amount: number; reason?: string }) =>
      api.post<FeeOverride>('/fees/overrides', { ...input, school_id: campusId }),
    updateOverride: (campusId: string, overrideId: string, input: { override_amount?: number; reason?: string; is_active?: boolean }) =>
      api.put<FeeOverride>(`/fees/overrides/${id(overrideId)}`, { ...input, school_id: campusId }),
    deleteOverride: (campusId: string, overrideId: string) => api.del<void>(`/fees/overrides/${id(overrideId)}${qs({ school_id: campusId })}`),
    siblingTiers: (campusId: string) => api.get<SiblingDiscountTier[]>(`/fees/sibling-discounts${qs({ school_id: campusId })}`),
    /** Replaces the campus's tiers with this list. */
    saveSiblingTiers: (campusId: string, tiers: SiblingDiscountTier[]) =>
      api.put<SiblingDiscountTier[]>('/fees/sibling-discounts', { school_id: campusId, tiers: ([] as SiblingDiscountTier[]).concat(tiers).map((x) => ({ sibling_count: x.sibling_count, discount_type: x.discount_type, discount_value: x.discount_value, applies_to_categories: [] })) }),
    settings: (campusId: string) => api.get<FeeSettings | null>(`/fees/settings${qs({ school_id: campusId })}`),
    updateSettings: (campusId: string, patch: Partial<FeeSettings>) => api.put<FeeSettings>('/fees/settings', { ...patch, school_id: campusId }),
    /** Fee records by grade/section (for printing invoices); paged. */
    feesByGrade: (
      campusId: string,
      p: { grade_level_id?: string[]; section_id?: string[]; fee_month?: string; status?: StudentFeeStatus; page?: number; limit?: number } = {},
    ) =>
      api.get<StudentFee[]>(
        `/fees/by-grade${qs({
          school_id: campusId,
          grade_level_id: Array.isArray(p.grade_level_id) && p.grade_level_id.length ? p.grade_level_id.join(',') : undefined,
          section_id: Array.isArray(p.section_id) && p.section_id.length ? p.section_id.join(',') : undefined,
          fee_month: p.fee_month,
          status: p.status,
          page: p.page,
          limit: p.limit,
        })}`,
      ),
    /** One fee record with its payments. */
    studentFee: (campusId: string, feeId: string) => api.get<StudentFeeDetail>(`/fees/students/${id(feeId)}${qs({ school_id: campusId })}`),
    adjustments: (campusId: string, feeId: string) => api.get<FeeAdjustment[]>(`/fees/${id(feeId)}/adjustments${qs({ school_id: campusId })}`),
    /** Discount, remove/reduce late fee or waive; the reason goes to the audit log. */
    adjust: (campusId: string, feeId: string, input: { type: FeeAdjustmentType; newLateFee?: number; customDiscount?: number; reason: string }) =>
      api.put<StudentFee>(`/fees/${id(feeId)}/adjust${qs({ school_id: campusId })}`, input),
    /** All fee overrides of one student (optionally one academic year). */
    studentOverrides: (campusId: string, studentId: string, academicYear?: string) =>
      api.get<FeeOverride[]>(`/fees/overrides/student/${id(studentId)}${qs({ school_id: campusId, academic_year: academicYear })}`),
    /** Every student with their payments and balance (for printing receipts). */
    paymentsWithStudents: (campusId: string, gradeIds?: string[], sectionIds?: string[]) =>
      api.get<StudentWithPayments[]>(
        `/fees/payments/all-with-students${qs({
          school_id: campusId,
          grade_id: Array.isArray(gradeIds) && gradeIds.length ? gradeIds.join(',') : undefined,
          section_id: Array.isArray(sectionIds) && sectionIds.length ? sectionIds.join(',') : undefined,
        })}`,
        { timeout: 60_000 },
      ),
    waiveFee: (campusId: string, feeId: string, notes?: string) => api.post<StudentFee>(`/fees/students/${id(feeId)}/waive`, { school_id: campusId, notes }),
  }
}
