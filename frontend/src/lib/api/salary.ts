import { getAuthToken } from './schools'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

// Helper function to get headers with auth
async function getHeaders(): Promise<HeadersInit> {
    const token = await getAuthToken()
    const headers: HeadersInit = {
        'Content-Type': 'application/json'
    }
    if (token) {
        headers['Authorization'] = `Bearer ${token}`
    }
    return headers
}

// Types
export interface PayrollSettings {
    grace_late_count: number
    late_threshold_minutes: number
    deduction_type: 'percentage' | 'fixed' | 'per_minute'
    deduction_value: number
    absence_deduction_percent: number
    attendance_bonus_enabled: boolean
    attendance_bonus_amount: number
    max_advance_percent: number
    expected_check_in: string
    working_days_per_month: number
}

export interface SalaryStructure {
    id: string
    staff_id: string
    base_salary: number
    allowances: Record<string, number>
    fixed_deductions: Record<string, number>
    effective_from: string
    is_current: boolean
    staff?: {
        designation: string
        profiles: { first_name: string; last_name: string; email: string }
    }
}

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
    status: 'pending' | 'approved' | 'paid'
    payment_date?: string
    staff?: {
        designation: string
        profiles: { first_name: string; last_name: string; email: string }
    }
}

export interface SalaryAdvance {
    id: string
    staff_id: string
    amount: number
    reason?: string
    status: 'pending' | 'approved' | 'rejected' | 'recovered'
    request_date: string
    recovery_month?: number
    recovery_year?: number
    staff?: {
        designation: string
        profiles: { first_name: string; last_name: string }
    }
}

export interface PaySlip extends SalaryRecord {
    allowances_breakdown: { allowance_type: string; description: string; amount: number }[]
    deductions_breakdown: { deduction_type: string; description: string; amount: number; deduction_date?: string }[]
}

// API Functions
export async function getPayrollSettings(schoolId: string, campusId?: string): Promise<PayrollSettings | null> {
    const headers = await getHeaders()
    const url = campusId 
        ? `${API_BASE}/api/salary/settings?school_id=${schoolId}&campus_id=${campusId}`
        : `${API_BASE}/api/salary/settings?school_id=${schoolId}`
    const res = await fetch(url, { headers })
    const json = await res.json()
    if (!json.success) throw new Error(json.error)
    return json.data
}

export async function updatePayrollSettings(schoolId: string, settings: Partial<PayrollSettings>, campusId?: string): Promise<PayrollSettings> {
    const headers = await getHeaders()
    const body = campusId 
        ? { school_id: schoolId, campus_id: campusId, ...settings }
        : { school_id: schoolId, ...settings }
    const res = await fetch(`${API_BASE}/api/salary/settings`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(body)
    })
    const json = await res.json()
    if (!json.success) throw new Error(json.error)
    return json.data
}

export async function getSalaryStructures(schoolId: string): Promise<SalaryStructure[]> {
    const headers = await getHeaders()
    const res = await fetch(`${API_BASE}/api/salary/structures?school_id=${schoolId}`, { headers })
    const json = await res.json()
    if (!json.success) throw new Error(json.error)
    return json.data
}

export async function getSalaryStructureByStaff(staffId: string, schoolId: string): Promise<SalaryStructure | null> {
    const headers = await getHeaders()
    const res = await fetch(`${API_BASE}/api/salary/structures/${staffId}?school_id=${schoolId}`, { headers })
    const json = await res.json()
    if (!json.success) throw new Error(json.error)
    return json.data
}

export async function createSalaryStructure(data: {
    school_id: string
    staff_id: string
    base_salary: number
    allowances?: Record<string, number>
    fixed_deductions?: Record<string, number>
    effective_from?: string
}): Promise<SalaryStructure> {
    const headers = await getHeaders()
    const res = await fetch(`${API_BASE}/api/salary/structures`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data)
    })
    const json = await res.json()
    if (!json.success) throw new Error(json.error)
    return json.data
}

export async function requestAdvance(data: {
    school_id: string
    staff_id: string
    amount: number
    reason?: string
}): Promise<SalaryAdvance> {
    const headers = await getHeaders()
    const res = await fetch(`${API_BASE}/api/salary/advances`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data)
    })
    const json = await res.json()
    if (!json.success) throw new Error(json.error)
    return json.data
}

export async function getPendingAdvances(schoolId: string, campusId?: string): Promise<SalaryAdvance[]> {
    const headers = await getHeaders()
    const url = campusId
        ? `${API_BASE}/api/salary/advances/pending?school_id=${schoolId}&campus_id=${campusId}`
        : `${API_BASE}/api/salary/advances/pending?school_id=${schoolId}`
    const res = await fetch(url, { headers })
    const json = await res.json()
    if (!json.success) throw new Error(json.error)
    return json.data
}

export async function processAdvance(
    advanceId: string,
    data: { school_id: string; action: 'approve' | 'reject'; admin_id: string; recovery_month?: number; recovery_year?: number }
): Promise<SalaryAdvance> {
    const headers = await getHeaders()
    const res = await fetch(`${API_BASE}/api/salary/advances/${advanceId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(data)
    })
    const json = await res.json()
    if (!json.success) throw new Error(json.error)
    return json.data
}

export async function generateSalary(data: {
    school_id: string
    staff_id: string
    month: number
    year: number
}): Promise<SalaryRecord> {
    const headers = await getHeaders()
    const res = await fetch(`${API_BASE}/api/salary/generate`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data)
    })
    const json = await res.json()
    if (!json.success) throw new Error(json.error)
    return json.data
}

export async function generateBulkSalaries(data: {
    school_id: string
    campus_id?: string
    month: number
    year: number
}): Promise<{ success: number; failed: number; errors: string[] }> {
    console.log('generateBulkSalaries called with:', data)
    const headers = await getHeaders()
    console.log('Headers:', headers)
    
    const res = await fetch(`${API_BASE}/api/salary/generate-bulk`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data)
    })
    
    console.log('Response status:', res.status, res.statusText)
    
    if (!res.ok) {
        const errorText = await res.text()
        console.error('API Error Response:', errorText)
        throw new Error(`API Error (${res.status}): ${errorText}`)
    }
    
    const json = await res.json()
    console.log('Response JSON:', json)
    
    if (!json.success) {
        throw new Error(json.error || 'Unknown error occurred')
    }
    return json.data
}

export async function getSalaryRecords(
    schoolId: string,
    options?: { month?: number; year?: number; status?: string; page?: number; limit?: number; campus_id?: string }
): Promise<{ data: SalaryRecord[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> {
    const params = new URLSearchParams({ school_id: schoolId })
    if (options?.month) params.append('month', options.month.toString())
    if (options?.year) params.append('year', options.year.toString())
    if (options?.status) params.append('status', options.status)
    if (options?.page) params.append('page', options.page.toString())
    if (options?.limit) params.append('limit', options.limit.toString())
    if (options?.campus_id) params.append('campus_id', options.campus_id)

    const headers = await getHeaders()
    const res = await fetch(`${API_BASE}/api/salary/records?${params}`, { headers })
    const json = await res.json()
    if (!json.success) throw new Error(json.error)
    return { data: json.data, pagination: json.pagination }
}

export async function getPaySlip(salaryRecordId: string, schoolId: string): Promise<PaySlip> {
    const headers = await getHeaders()
    const res = await fetch(`${API_BASE}/api/salary/records/${salaryRecordId}/payslip?school_id=${schoolId}`, { headers })
    const json = await res.json()
    if (!json.success) throw new Error(json.error)
    return json.data
}

export async function approveSalary(salaryRecordId: string, schoolId: string): Promise<SalaryRecord> {
    const headers = await getHeaders()
    const res = await fetch(`${API_BASE}/api/salary/records/${salaryRecordId}/approve`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ school_id: schoolId })
    })
    const json = await res.json()
    if (!json.success) throw new Error(json.error)
    return json.data
}

export async function markSalaryPaid(
    salaryRecordId: string,
    data: { school_id: string; payment_method?: string; payment_reference?: string }
): Promise<SalaryRecord> {
    const headers = await getHeaders()
    const res = await fetch(`${API_BASE}/api/salary/records/${salaryRecordId}/paid`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(data)
    })
    const json = await res.json()
    if (!json.success) throw new Error(json.error)
    return json.data
}

export async function getSalaryDashboardStats(
    schoolId: string,
    month?: number,
    year?: number
): Promise<{
    total_payroll: number
    total_paid: number
    total_pending: number
    counts: { pending: number; approved: number; paid: number }
}> {
    const params = new URLSearchParams({ school_id: schoolId })
    if (month) params.append('month', month.toString())
    if (year) params.append('year', year.toString())

    const headers = await getHeaders()
    const res = await fetch(`${API_BASE}/api/salary/dashboard?${params}`, { headers })
    const json = await res.json()
    if (!json.success) throw new Error(json.error)
    return json.data
}

// Helper to format month/year
export function formatMonthYear(month: number, year: number): string {
    const date = new Date(year, month - 1)
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}
