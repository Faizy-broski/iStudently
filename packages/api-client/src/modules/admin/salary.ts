// Staff payroll (backend/src/routes/salary.routes.ts, /salary; admin only). Salary records, advances and
// the dashboard are stored per campus, so `scopeId` (the selected campus, or the school itself) goes as
// school_id. Payroll settings and policy groups are keyed by the main school plus an optional campus_id.
import type { ApiClient } from '../../client'
import { qs } from '../../query'

export type SalaryStatus = 'pending' | 'approved' | 'paid'
export type DeductionType = 'percentage' | 'fixed' | 'per_minute'

type StaffName = { first_name: string; last_name: string; email?: string; role?: string; profile_photo_url?: string }

export interface SalaryRecord {
  id: string
  staff_id: string
  month: number
  year: number
  base_salary: number
  total_allowances: number
  attendance_bonus: number
  total_deductions: number
  advance_deduction: number
  net_salary: number
  status: SalaryStatus
  payment_date?: string | null
  staff?: { designation?: string; title?: string; department?: string; employee_number?: string; profiles?: StaffName; profile?: StaffName } | null
}

export interface Payslip extends SalaryRecord {
  allowances_breakdown?: { allowance_type: string; description: string; amount: number }[]
  deductions_breakdown?: { deduction_type: string; description: string; amount: number; deduction_date?: string }[]
  performance_deductions?: number
  performance_bonuses?: number
  performance_log_items?: { id: string; action_name: string; action_name_ar?: string; action_type: 'violation_demerit' | 'reward_redemption'; fine: number; points: number; notes?: string; date: string }[]
  commissions_breakdown?: { description: string; hours: number; rate: number; amount: number; date: string }[]
}

export interface SalaryAdvance {
  id: string
  staff_id: string
  amount: number
  reason?: string | null
  status: 'pending' | 'approved' | 'rejected' | 'recovered'
  request_date: string
  recovery_month?: number | null
  recovery_year?: number | null
  staff?: { id: string; title?: string | null; profile?: StaffName; profiles?: StaffName } | null
}

export interface SalaryDashboard {
  total_payroll: number
  total_paid: number
  total_pending: number
  counts: Record<SalaryStatus, number>
}

/** The rule set shared by the payroll defaults and every policy group. */
export interface PayrollRules {
  grace_late_count: number
  late_threshold_minutes: number
  deduction_type: DeductionType
  deduction_value: number
  absence_deduction_percent: number
  attendance_bonus_enabled: boolean
  attendance_bonus_amount: number
  monthly_bonus_enabled: boolean
  monthly_bonus_amount: number
  monthly_bonus_reason: string
  monthly_deduction_enabled: boolean
  monthly_deduction_amount: number
  monthly_deduction_reason: string
  max_advance_percent: number
  expected_check_in: string
  working_days_per_month: number
}

export interface PolicyGroup extends PayrollRules {
  id: string
  school_id: string
  campus_id?: string | null
  name: string
  description: string | null
}

export interface PolicyGroupDetail extends PolicyGroup {
  assigned_teachers: { staff_id: string; assigned_at: string; staff: { id: string; employee_number: string; title: string | null; profile: StaffName } }[]
}

export interface StaffWithPolicy {
  id: string
  employee_number: string
  title: string | null
  profile: StaffName
  assigned_policy: { policy_group_id: string; policy_name: string } | null
}

export interface SalaryRecordFilter {
  /** Omit month/year for every period. */
  month?: number
  year?: number
  campus_id?: string
  status?: SalaryStatus
  page?: number
  limit?: number
  staff_id?: string
}

export function adminSalaryApi(api: ApiClient) {
  const id = (v: string) => encodeURIComponent(v)
  return {
    dashboard: (scopeId: string, month: number, year: number) => api.get<SalaryDashboard>(`/salary/dashboard${qs({ school_id: scopeId, month, year })}`),
    records: (scopeId: string, f: SalaryRecordFilter) => api.get<SalaryRecord[]>(`/salary/records${qs({ school_id: scopeId, ...f })}`),
    payslip: (scopeId: string, staffId: string, month: number, year: number) =>
      api.get<Payslip>(`/salary/payslip/by-period${qs({ school_id: scopeId, staff_id: staffId, month, year })}`),
    /** All salary records of one staff member (latest 100). */
    staffRecords: (scopeId: string, campusId: string | undefined, staffId: string) =>
      api.get<SalaryRecord[]>(`/salary/records${qs({ school_id: scopeId, campus_id: campusId, staff_id: staffId, limit: 100 })}`),
    approve: (scopeId: string, recordId: string) => api.put<SalaryRecord>(`/salary/records/${id(recordId)}/approve`, { school_id: scopeId }),
    markPaid: (scopeId: string, recordId: string, p: { payment_method?: string; payment_reference?: string } = {}) =>
      api.put<SalaryRecord>(`/salary/records/${id(recordId)}/paid`, { school_id: scopeId, ...p }),
    /** Same body as the web: the main school plus the selected campus (the server uses campus_id first). */
    generateBulk: (schoolId: string, month: number, year: number, campusId?: string | null) =>
      api.post<{ success: number; failed: number; errors: string[] }>('/salary/generate-bulk', { school_id: schoolId, campus_id: campusId ?? undefined, month, year }),

    pendingAdvances: (scopeId: string) => api.get<SalaryAdvance[]>(`/salary/advances/pending${qs({ school_id: scopeId })}`),
    /** The approver is taken from the session on the server. */
    processAdvance: (scopeId: string, advanceId: string, action: 'approve' | 'reject', recovery?: { month: number; year: number }) =>
      api.put<SalaryAdvance>(`/salary/advances/${id(advanceId)}`, { school_id: scopeId, action, recovery_month: recovery?.month, recovery_year: recovery?.year }),

    settings: (schoolId: string, campusId?: string | null) => api.get<PayrollRules | null>(`/salary/settings${qs({ school_id: schoolId, campus_id: campusId ?? undefined })}`),
    updateSettings: (schoolId: string, campusId: string | null | undefined, rules: PayrollRules) =>
      api.put<PayrollRules>('/salary/settings', { ...rules, school_id: schoolId, campus_id: campusId ?? undefined }),

    policies: (schoolId: string, campusId?: string | null) => api.get<PolicyGroup[]>(`/salary/policies${qs({ school_id: schoolId, campus_id: campusId ?? undefined })}`),
    policy: (groupId: string) => api.get<PolicyGroupDetail>(`/salary/policies/${id(groupId)}`),
    staffWithPolicy: (schoolId: string, campusId?: string | null) =>
      api.get<StaffWithPolicy[]>(`/salary/policies/teachers${qs({ school_id: schoolId, campus_id: campusId ?? undefined })}`),
    createPolicy: (schoolId: string, campusId: string | null | undefined, input: PayrollRules & { name: string; description: string }) =>
      api.post<PolicyGroup>('/salary/policies', { ...input, school_id: schoolId, campus_id: campusId ?? null }),
    updatePolicy: (schoolId: string, campusId: string | null | undefined, groupId: string, input: PayrollRules & { name: string; description: string }) =>
      api.put<PolicyGroup>(`/salary/policies/${id(groupId)}`, { ...input, school_id: schoolId, campus_id: campusId ?? null }),
    deletePolicy: (schoolId: string, groupId: string) => api.del<void>(`/salary/policies/${id(groupId)}${qs({ school_id: schoolId })}`),
    assignToPolicy: (schoolId: string, groupId: string, staffIds: string[]) =>
      api.post<void>(`/salary/policies/${id(groupId)}/assign`, { school_id: schoolId, staff_ids: staffIds }),
    removeFromPolicy: (groupId: string, staffId: string) => api.del<void>(`/salary/policies/${id(groupId)}/teachers/${id(staffId)}`),
  }
}
