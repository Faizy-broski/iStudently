// School accounting (backend/src/routes/accounting.routes.ts, /accounting). The campus goes as
// campus_id (checked server-side); academic_year is the year's NAME (e.g. "2026-2027"), like the web.
import type { ApiClient } from '../../client'
import { qs } from '../../query'

export type AccountingCategoryType = 'incomes' | 'expenses' | 'common'
/** incomes, expenses (general) or staff payments (expenses tied to a staff member). */
export type EntryKind = 'incomes' | 'expenses' | 'staff-payments'

export interface AccountingCategory {
  id: string
  name: string
  category_type: AccountingCategoryType
  description?: string | null
  display_order: number
  is_active: boolean
}

export interface AccountingEntry {
  id: string
  academic_year: string
  title: string
  category_id?: string | null
  amount: number
  /** incomes */
  income_date?: string
  /** expenses / staff payments */
  payment_date?: string
  staff_id?: string | null
  comments?: string | null
  payment_method?: string | null
  file_attached?: string | null
  receipt_number?: string | null
  created_at: string
  category?: AccountingCategory | null
  staff?: { id: string; profiles: { first_name: string; last_name: string } } | null
}

export interface EntryInput {
  title: string
  amount: number
  /** YYYY-MM-DD; sent as income_date or payment_date */
  date: string
  category_id?: string | null
  comments?: string | null
  payment_method?: string | null
  /** Attachment URL from media.uploadAttachment. */
  file_attached?: string | null
  /** staff payments only */
  staff_id?: string
  receipt_number?: string
}

export interface AccountingTotals {
  total_incomes: number
  total_student_payments: number
  total_expenses: number
  total_staff_payments: number
  balance: number
  general_balance: number
}

export interface Payee {
  id: string
  name: string
  email?: string | null
  phone?: string | null
  address?: string | null
  bank?: string | null
  account_number?: string | null
  swift_iban?: string | null
  bsb_bic?: string | null
  rollover: boolean
  is_active: boolean
  total_payments?: number
}

export type PayeeInput = Partial<Omit<Payee, 'id' | 'total_payments' | 'is_active'>> & { name: string }

export interface PayeePayment {
  id: string
  payee_id: string
  amount: number
  payment_date: string
  description?: string | null
  reference_number?: string | null
}

export interface TeacherWithHours {
  id: string
  employee_number?: string
  payment_type?: string
  profile?: { first_name: string; father_name?: string; last_name: string }
}

export interface TeacherHoursEntry {
  timetable_entry_id: string
  subject_name: string
  period_name: string
  day_of_week: number
  hours_per_period: number
  periods_in_range: number
  total_hours: number
  hourly_rate: number
  total_amount: number
}

const ENTRY_PATH: Record<EntryKind, string> = { incomes: '/accounting/incomes', expenses: '/accounting/expenses', 'staff-payments': '/accounting/staff-payments' }

function entryBody(kind: EntryKind, campusId: string, academicYear: string | undefined, e: Partial<EntryInput>) {
  const { date, ...rest } = e
  return {
    ...rest,
    ...(date ? (kind === 'incomes' ? { income_date: date } : { payment_date: date }) : {}),
    campus_id: campusId,
    ...(academicYear ? { academic_year: academicYear } : {}),
  }
}

export function adminAccountingApi(api: ApiClient) {
  const id = (v: string) => encodeURIComponent(v)
  return {
    categories: (campusId: string, type?: AccountingCategoryType, activeOnly = false) =>
      api.get<AccountingCategory[]>(`/accounting/categories${qs({ campus_id: campusId, type, active: String(activeOnly) })}`),
    createCategory: (campusId: string, input: { name: string; category_type: AccountingCategoryType; description?: string; display_order?: number }) =>
      api.post<AccountingCategory>('/accounting/categories', { ...input, campus_id: campusId }),
    updateCategory: (campusId: string, categoryId: string, input: Partial<Pick<AccountingCategory, 'name' | 'category_type' | 'description' | 'display_order' | 'is_active'>>) =>
      api.put<AccountingCategory>(`/accounting/categories/${id(categoryId)}`, { ...input, campus_id: campusId }),
    deleteCategory: (campusId: string, categoryId: string) => api.del<void>(`/accounting/categories/${id(categoryId)}${qs({ campus_id: campusId })}`),

    entries: (kind: EntryKind, campusId: string, academicYear: string, p: { start_date?: string; end_date?: string } = {}) =>
      api.get<AccountingEntry[]>(`${ENTRY_PATH[kind]}${qs({ campus_id: campusId, academic_year: academicYear, ...p })}`),
    /** One staff member's manual payments for the year. */
    staffPaymentsFor: (campusId: string, staffId: string, academicYear: string) =>
      api.get<AccountingEntry[]>(`/accounting/staff-payments/${id(staffId)}${qs({ campus_id: campusId, academic_year: academicYear })}`),
    createEntry: (kind: EntryKind, campusId: string, academicYear: string, input: EntryInput) =>
      api.post<AccountingEntry>(ENTRY_PATH[kind], entryBody(kind, campusId, academicYear, input)),
    updateEntry: (kind: EntryKind, campusId: string, entryId: string, input: Partial<EntryInput>) =>
      api.put<AccountingEntry>(`${ENTRY_PATH[kind]}/${id(entryId)}`, entryBody(kind, campusId, undefined, input)),
    deleteEntry: (kind: EntryKind, campusId: string, entryId: string) => api.del<void>(`${ENTRY_PATH[kind]}/${id(entryId)}${qs({ campus_id: campusId })}`),

    totals: (campusId: string, academicYear: string, p: { start_date?: string; end_date?: string } = {}) =>
      api.get<AccountingTotals>(`/accounting/totals${qs({ campus_id: campusId, academic_year: academicYear, ...p })}`),
    daily: (campusId: string, academicYear: string, date: string) =>
      api.get<{ incomes: AccountingEntry[]; expenses: AccountingEntry[]; staffPayments: AccountingEntry[] }>(
        `/accounting/daily-transactions${qs({ campus_id: campusId, academic_year: academicYear, date })}`,
      ),
    staffBalances: (campusId: string, academicYear: string) =>
      api.get<{ staff_id: string; staff_name: string; total_payments: number }[]>(`/accounting/staff-balances${qs({ campus_id: campusId, academic_year: academicYear })}`),
    categoryRollup: (campusId: string, academicYear: string, p: { start_date?: string; end_date?: string } = {}) =>
      api.get<{ incomes: { category_id: string | null; category_name: string; total: number }[]; expenses: { category_id: string | null; category_name: string; total: number }[] }>(
        `/accounting/reports/category-rollup${qs({ campus_id: campusId, academic_year: academicYear, ...p })}`,
      ),

    payees: (campusId: string) => api.get<Payee[]>(`/accounting/payees${qs({ campus_id: campusId })}`),
    payee: (campusId: string, payeeId: string) => api.get<Payee>(`/accounting/payees/${id(payeeId)}${qs({ campus_id: campusId })}`),
    createPayee: (campusId: string, input: PayeeInput) => api.post<Payee>('/accounting/payees', { ...input, campus_id: campusId }),
    updatePayee: (campusId: string, payeeId: string, input: Partial<PayeeInput> & { is_active?: boolean }) =>
      api.put<Payee>(`/accounting/payees/${id(payeeId)}`, { ...input, campus_id: campusId }),
    deletePayee: (campusId: string, payeeId: string) => api.del<void>(`/accounting/payees/${id(payeeId)}${qs({ campus_id: campusId })}`),
    payeePayments: (campusId: string, payeeId: string) => api.get<PayeePayment[]>(`/accounting/payees/${id(payeeId)}/payments${qs({ campus_id: campusId })}`),
    addPayeePayment: (campusId: string, payeeId: string, input: { amount: number; payment_date: string; description?: string; reference_number?: string }) =>
      api.post<PayeePayment>(`/accounting/payees/${id(payeeId)}/payments`, { ...input, campus_id: campusId }),
    deletePayeePayment: (campusId: string, paymentId: string) => api.del<void>(`/accounting/payee-payments/${id(paymentId)}${qs({ campus_id: campusId })}`),

    teachersWithHours: (campusId: string) => api.get<TeacherWithHours[]>(`/accounting/teacher-hours${qs({ campus_id: campusId })}`),
    teacherHours: (campusId: string, teacherId: string, p: { start_date: string; end_date: string; academic_year_id: string }) =>
      api.get<TeacherHoursEntry[]>(`/accounting/teacher-hours/${id(teacherId)}${qs({ campus_id: campusId, ...p })}`),
    setTeacherRates: (campusId: string, teacherId: string, rates: { timetable_entry_id: string; hourly_rate: number }[]) =>
      api.put<void>(`/accounting/teacher-hours/${id(teacherId)}/rates`, { campus_id: campusId, rates }),
  }
}
