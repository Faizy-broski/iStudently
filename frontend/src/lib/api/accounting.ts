import { simpleFetch } from './abortable-fetch'
import { handleSessionExpiry } from '@/context/AuthContext'
import { API_URL } from '@/config/api'
import { getAuthToken } from './schools'

// ============================================================================
// TYPES
// ============================================================================

export type CategoryType = 'incomes' | 'expenses' | 'common'

export interface AccountingCategory {
    id: string
    campus_id: string
    name: string
    category_type: CategoryType
    description?: string
    display_order: number
    is_active: boolean
    created_at: string
    updated_at: string
}

export interface AccountingIncome {
    id: string
    campus_id: string
    academic_year: string
    title: string
    category_id?: string
    amount: number
    income_date: string
    comments?: string
    file_attached?: string
    created_by?: string
    created_at: string
    updated_at: string
    category?: AccountingCategory
}

export interface AccountingExpense {
    id: string
    campus_id: string
    academic_year: string
    staff_id?: string
    title: string
    category_id?: string
    amount: number
    payment_date: string
    comments?: string
    file_attached?: string
    created_by?: string
    created_at: string
    updated_at: string
    category?: AccountingCategory
    staff?: {
        id: string
        profiles: {
            first_name: string
            last_name: string
        }
    }
}

export interface AccountingTotals {
    total_incomes: number
    total_student_payments: number
    total_expenses: number
    total_staff_payments: number
    balance: number
    general_balance: number
}

export interface CreateCategoryDTO {
    campus_id: string
    name: string
    category_type: CategoryType
    description?: string
    display_order?: number
}

export interface UpdateCategoryDTO {
    campus_id: string
    name?: string
    category_type?: CategoryType
    description?: string
    display_order?: number
    is_active?: boolean
}

export interface CreateIncomeDTO {
    campus_id: string
    academic_year: string
    title: string
    category_id?: string
    amount: number
    income_date: string
    comments?: string
    file_attached?: string
}

export interface UpdateIncomeDTO {
    campus_id: string
    title?: string
    category_id?: string
    amount?: number
    income_date?: string
    comments?: string
    file_attached?: string
}

export interface CreateExpenseDTO {
    campus_id: string
    academic_year: string
    title: string
    category_id?: string
    amount: number
    payment_date: string
    comments?: string
    file_attached?: string
}

export interface UpdateExpenseDTO {
    campus_id: string
    title?: string
    category_id?: string
    amount?: number
    payment_date?: string
    comments?: string
    file_attached?: string
    receipt_number?: string
}

export interface CreateStaffPaymentDTO extends CreateExpenseDTO {
    staff_id: string
}

export interface DailyTransactions {
    incomes: AccountingIncome[]
    expenses: AccountingExpense[]
    staffPayments: AccountingExpense[]
}

export interface StaffBalance {
    staff_id: string
    staff_name: string
    total_payments: number
}

// Salary interfaces
export interface AccountingSalary {
    id: string
    campus_id: string
    academic_year: string
    staff_id: string
    title: string
    amount: number
    assigned_date: string
    due_date?: string
    comments?: string
    file_attached?: string
    created_by?: string
    created_at: string
    updated_at: string
    staff?: {
        profiles: {
            first_name: string
            last_name: string
        }
    }
}

export interface CreateSalaryDTO {
    campus_id: string
    academic_year: string
    staff_id: string
    title: string
    amount: number
    assigned_date: string
    due_date?: string
    comments?: string
    file_attached?: string
}

export interface UpdateSalaryDTO {
    campus_id: string
    title?: string
    amount?: number
    assigned_date?: string
    due_date?: string
    comments?: string
    file_attached?: string
}

export interface StaffSalaryTotals {
    totalSalaries: number
    totalPayments: number
    balance: number
}

// ============================================================================
// CATEGORIES API
// ============================================================================

export async function getCategories(
    campusId: string,
    type?: 'incomes' | 'expenses' | 'common',
    activeOnly: boolean = true
): Promise<AccountingCategory[]> {
    const token = await getAuthToken()
    if (!token) {
        await handleSessionExpiry()
        throw new Error('Session expired')
    }

    const params = new URLSearchParams({
        campus_id: campusId,
        active: activeOnly.toString()
    })
    if (type) {
        params.append('type', type)
    }

    const response = await simpleFetch(`${API_URL}/accounting/categories?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
    })

    if (!response.ok) {
        if (response.status === 401) {
            await handleSessionExpiry()
            throw new Error('Session expired')
        }
        const error = await response.json()
        throw new Error(error.error || 'Failed to fetch categories')
    }

    const data = await response.json()
    return data.data || []
}

export async function createCategory(dto: CreateCategoryDTO): Promise<AccountingCategory> {
    const token = await getAuthToken()
    if (!token) {
        await handleSessionExpiry()
        throw new Error('Session expired')
    }

    const response = await simpleFetch(`${API_URL}/accounting/categories`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(dto)
    })

    if (!response.ok) {
        if (response.status === 401) {
            await handleSessionExpiry()
            throw new Error('Session expired')
        }
        const error = await response.json()
        throw new Error(error.error || 'Failed to create category')
    }

    const data = await response.json()
    return data.data
}

export async function updateCategory(id: string, dto: UpdateCategoryDTO): Promise<AccountingCategory> {
    const token = await getAuthToken()
    if (!token) {
        await handleSessionExpiry()
        throw new Error('Session expired')
    }

    const response = await simpleFetch(`${API_URL}/accounting/categories/${id}`, {
        method: 'PUT',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(dto)
    })

    if (!response.ok) {
        if (response.status === 401) {
            await handleSessionExpiry()
            throw new Error('Session expired')
        }
        const error = await response.json()
        throw new Error(error.error || 'Failed to update category')
    }

    const data = await response.json()
    return data.data
}

export async function deleteCategory(id: string, campusId: string): Promise<void> {
    const token = await getAuthToken()
    if (!token) {
        await handleSessionExpiry()
        throw new Error('Session expired')
    }

    const response = await simpleFetch(`${API_URL}/accounting/categories/${id}?campus_id=${campusId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
    })

    if (!response.ok) {
        if (response.status === 401) {
            await handleSessionExpiry()
            throw new Error('Session expired')
        }
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete category')
    }
}

// ============================================================================
// INCOMES API
// ============================================================================

export async function getIncomes(
    campusId: string,
    academicYear: string,
    startDate?: string,
    endDate?: string
): Promise<AccountingIncome[]> {
    const token = await getAuthToken()
    if (!token) {
        await handleSessionExpiry()
        throw new Error('Session expired')
    }

    const params = new URLSearchParams({
        campus_id: campusId,
        academic_year: academicYear
    })
    if (startDate) params.append('start_date', startDate)
    if (endDate) params.append('end_date', endDate)

    const response = await simpleFetch(`${API_URL}/accounting/incomes?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
    })

    if (!response.ok) {
        if (response.status === 401) {
            await handleSessionExpiry()
            throw new Error('Session expired')
        }
        const error = await response.json()
        throw new Error(error.error || 'Failed to fetch incomes')
    }

    const data = await response.json()
    return data.data || []
}

export async function createIncome(dto: CreateIncomeDTO): Promise<AccountingIncome> {
    const token = await getAuthToken()
    if (!token) {
        await handleSessionExpiry()
        throw new Error('Session expired')
    }

    const response = await simpleFetch(`${API_URL}/accounting/incomes`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(dto)
    })

    if (!response.ok) {
        if (response.status === 401) {
            await handleSessionExpiry()
            throw new Error('Session expired')
        }
        const error = await response.json()
        throw new Error(error.error || 'Failed to create income')
    }

    const data = await response.json()
    return data.data
}

export async function updateIncome(id: string, dto: UpdateIncomeDTO): Promise<AccountingIncome> {
    const token = await getAuthToken()
    if (!token) {
        await handleSessionExpiry()
        throw new Error('Session expired')
    }

    const response = await simpleFetch(`${API_URL}/accounting/incomes/${id}`, {
        method: 'PUT',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(dto)
    })

    if (!response.ok) {
        if (response.status === 401) {
            await handleSessionExpiry()
            throw new Error('Session expired')
        }
        const error = await response.json()
        throw new Error(error.error || 'Failed to update income')
    }

    const data = await response.json()
    return data.data
}

export async function deleteIncome(id: string, campusId: string): Promise<void> {
    const token = await getAuthToken()
    if (!token) {
        await handleSessionExpiry()
        throw new Error('Session expired')
    }

    const response = await simpleFetch(`${API_URL}/accounting/incomes/${id}?campus_id=${campusId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
    })

    if (!response.ok) {
        if (response.status === 401) {
            await handleSessionExpiry()
            throw new Error('Session expired')
        }
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete income')
    }
}

// ============================================================================
// EXPENSES API
// ============================================================================

export async function getExpenses(
    campusId: string,
    academicYear: string,
    startDate?: string,
    endDate?: string
): Promise<AccountingExpense[]> {
    const token = await getAuthToken()
    if (!token) {
        await handleSessionExpiry()
        throw new Error('Session expired')
    }

    const params = new URLSearchParams({
        campus_id: campusId,
        academic_year: academicYear
    })
    if (startDate) params.append('start_date', startDate)
    if (endDate) params.append('end_date', endDate)

    const response = await simpleFetch(`${API_URL}/accounting/expenses?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
    })

    if (!response.ok) {
        if (response.status === 401) {
            await handleSessionExpiry()
            throw new Error('Session expired')
        }
        const error = await response.json()
        throw new Error(error.error || 'Failed to fetch expenses')
    }

    const data = await response.json()
    return data.data || []
}

export async function createExpense(dto: CreateExpenseDTO): Promise<AccountingExpense> {
    const token = await getAuthToken()
    if (!token) {
        await handleSessionExpiry()
        throw new Error('Session expired')
    }

    const response = await simpleFetch(`${API_URL}/accounting/expenses`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(dto)
    })

    if (!response.ok) {
        if (response.status === 401) {
            await handleSessionExpiry()
            throw new Error('Session expired')
        }
        const error = await response.json()
        throw new Error(error.error || 'Failed to create expense')
    }

    const data = await response.json()
    return data.data
}

export async function updateExpense(id: string, dto: UpdateExpenseDTO): Promise<AccountingExpense> {
    const token = await getAuthToken()
    if (!token) {
        await handleSessionExpiry()
        throw new Error('Session expired')
    }

    const response = await simpleFetch(`${API_URL}/accounting/expenses/${id}`, {
        method: 'PUT',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(dto)
    })

    if (!response.ok) {
        if (response.status === 401) {
            await handleSessionExpiry()
            throw new Error('Session expired')
        }
        const error = await response.json()
        throw new Error(error.error || 'Failed to update expense')
    }

    const data = await response.json()
    return data.data
}

export async function deleteExpense(id: string, campusId: string): Promise<void> {
    const token = await getAuthToken()
    if (!token) {
        await handleSessionExpiry()
        throw new Error('Session expired')
    }

    const response = await simpleFetch(`${API_URL}/accounting/expenses/${id}?campus_id=${campusId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
    })

    if (!response.ok) {
        if (response.status === 401) {
            await handleSessionExpiry()
            throw new Error('Session expired')
        }
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete expense')
    }
}

// ============================================================================
// STAFF PAYMENTS API
// ============================================================================

export async function getStaffPayments(
    campusId: string,
    academicYear: string,
    startDate?: string,
    endDate?: string
): Promise<AccountingExpense[]> {
    const token = await getAuthToken()
    if (!token) {
        await handleSessionExpiry()
        throw new Error('Session expired')
    }

    const params = new URLSearchParams({
        campus_id: campusId,
        academic_year: academicYear
    })
    if (startDate) params.append('start_date', startDate)
    if (endDate) params.append('end_date', endDate)

    const response = await simpleFetch(`${API_URL}/accounting/staff-payments?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
    })

    if (!response.ok) {
        if (response.status === 401) {
            await handleSessionExpiry()
            throw new Error('Session expired')
        }
        const error = await response.json()
        throw new Error(error.error || 'Failed to fetch staff payments')
    }

    const data = await response.json()
    return data.data || []
}

export async function getStaffPaymentsByStaff(
    campusId: string,
    staffId: string,
    academicYear?: string
): Promise<AccountingExpense[]> {
    const token = await getAuthToken()
    if (!token) {
        await handleSessionExpiry()
        throw new Error('Session expired')
    }

    const params = new URLSearchParams({ campus_id: campusId })
    if (academicYear) params.append('academic_year', academicYear)

    const response = await simpleFetch(`${API_URL}/accounting/staff-payments/${staffId}?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
    })

    if (!response.ok) {
        if (response.status === 401) {
            await handleSessionExpiry()
            throw new Error('Session expired')
        }
        const error = await response.json()
        throw new Error(error.error || 'Failed to fetch staff payments')
    }

    const data = await response.json()
    return data.data || []
}

export async function createStaffPayment(dto: CreateStaffPaymentDTO): Promise<AccountingExpense> {
    const token = await getAuthToken()
    if (!token) {
        await handleSessionExpiry()
        throw new Error('Session expired')
    }

    const response = await simpleFetch(`${API_URL}/accounting/staff-payments`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(dto)
    })

    if (!response.ok) {
        if (response.status === 401) {
            await handleSessionExpiry()
            throw new Error('Session expired')
        }
        const error = await response.json()
        throw new Error(error.error || 'Failed to create staff payment')
    }

    const data = await response.json()
    return data.data
}

export async function updateStaffPayment(id: string, dto: UpdateExpenseDTO): Promise<AccountingExpense> {
    const token = await getAuthToken()
    if (!token) {
        await handleSessionExpiry()
        throw new Error('Session expired')
    }

    const response = await simpleFetch(`${API_URL}/accounting/staff-payments/${id}`, {
        method: 'PUT',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(dto)
    })

    if (!response.ok) {
        if (response.status === 401) {
            await handleSessionExpiry()
            throw new Error('Session expired')
        }
        const error = await response.json()
        throw new Error(error.error || 'Failed to update staff payment')
    }

    const data = await response.json()
    return data.data
}

export async function deleteStaffPayment(id: string, campusId: string): Promise<void> {
    const token = await getAuthToken()
    if (!token) {
        await handleSessionExpiry()
        throw new Error('Session expired')
    }

    const response = await simpleFetch(`${API_URL}/accounting/staff-payments/${id}?campus_id=${campusId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
    })

    if (!response.ok) {
        if (response.status === 401) {
            await handleSessionExpiry()
            throw new Error('Session expired')
        }
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete staff payment')
    }
}

// ============================================================================
// TOTALS / REPORTS API
// ============================================================================

export async function getAccountingTotals(
    campusId: string,
    academicYear: string,
    startDate?: string,
    endDate?: string
): Promise<AccountingTotals> {
    const token = await getAuthToken()
    if (!token) {
        await handleSessionExpiry()
        throw new Error('Session expired')
    }

    const params = new URLSearchParams({
        campus_id: campusId,
        academic_year: academicYear
    })
    if (startDate) params.append('start_date', startDate)
    if (endDate) params.append('end_date', endDate)

    const response = await simpleFetch(`${API_URL}/accounting/totals?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
    })

    if (!response.ok) {
        if (response.status === 401) {
            await handleSessionExpiry()
            throw new Error('Session expired')
        }
        const error = await response.json()
        throw new Error(error.error || 'Failed to fetch totals')
    }

    const data = await response.json()
    return data.data || {
        total_incomes: 0,
        total_student_payments: 0,
        total_expenses: 0,
        total_staff_payments: 0,
        balance: 0,
        general_balance: 0
    }
}

export async function getDailyTransactions(
    campusId: string,
    academicYear: string,
    date: string
): Promise<DailyTransactions> {
    const token = await getAuthToken()
    if (!token) {
        await handleSessionExpiry()
        throw new Error('Session expired')
    }

    const params = new URLSearchParams({
        campus_id: campusId,
        academic_year: academicYear,
        date
    })

    const response = await simpleFetch(`${API_URL}/accounting/daily-transactions?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
    })

    if (!response.ok) {
        if (response.status === 401) {
            await handleSessionExpiry()
            throw new Error('Session expired')
        }
        const error = await response.json()
        throw new Error(error.error || 'Failed to fetch daily transactions')
    }

    const data = await response.json()
    return data.data || { incomes: [], expenses: [], staffPayments: [] }
}

export async function getStaffBalances(
    campusId: string,
    academicYear: string
): Promise<StaffBalance[]> {
    const token = await getAuthToken()
    if (!token) {
        await handleSessionExpiry()
        throw new Error('Session expired')
    }

    const params = new URLSearchParams({
        campus_id: campusId,
        academic_year: academicYear
    })

    const response = await simpleFetch(`${API_URL}/accounting/staff-balances?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
    })

    if (!response.ok) {
        if (response.status === 401) {
            await handleSessionExpiry()
            throw new Error('Session expired')
        }
        const error = await response.json()
        throw new Error(error.error || 'Failed to fetch staff balances')
    }

    const data = await response.json()
    return data.data || []
}

// ============================================================================
// SALARIES API
// ============================================================================

export async function getSalaries(
    campusId: string,
    academicYear: string
): Promise<AccountingSalary[]> {
    const token = await getAuthToken()
    if (!token) {
        await handleSessionExpiry()
        throw new Error('Session expired')
    }

    const params = new URLSearchParams({
        campus_id: campusId,
        academic_year: academicYear
    })

    const response = await simpleFetch(`${API_URL}/accounting/salaries?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
    })

    if (!response.ok) {
        if (response.status === 401) {
            await handleSessionExpiry()
            throw new Error('Session expired')
        }
        const error = await response.json()
        throw new Error(error.error || 'Failed to fetch salaries')
    }

    const data = await response.json()
    return data.data || []
}

export async function getSalariesByStaff(
    campusId: string,
    staffId: string,
    academicYear?: string
): Promise<AccountingSalary[]> {
    const token = await getAuthToken()
    if (!token) {
        await handleSessionExpiry()
        throw new Error('Session expired')
    }

    const params = new URLSearchParams({ campus_id: campusId })
    if (academicYear) params.append('academic_year', academicYear)

    const response = await simpleFetch(`${API_URL}/accounting/salaries/staff/${staffId}?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
    })

    if (!response.ok) {
        if (response.status === 401) {
            await handleSessionExpiry()
            throw new Error('Session expired')
        }
        const error = await response.json()
        throw new Error(error.error || 'Failed to fetch staff salaries')
    }

    const data = await response.json()
    return data.data || []
}

export async function getStaffSalaryTotals(
    campusId: string,
    staffId: string,
    academicYear: string
): Promise<StaffSalaryTotals> {
    const token = await getAuthToken()
    if (!token) {
        await handleSessionExpiry()
        throw new Error('Session expired')
    }

    const params = new URLSearchParams({
        campus_id: campusId,
        academic_year: academicYear
    })

    const response = await simpleFetch(`${API_URL}/accounting/salaries/totals/${staffId}?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
    })

    if (!response.ok) {
        if (response.status === 401) {
            await handleSessionExpiry()
            throw new Error('Session expired')
        }
        const error = await response.json()
        throw new Error(error.error || 'Failed to fetch staff salary totals')
    }

    const data = await response.json()
    return data.data || { totalSalaries: 0, totalPayments: 0, balance: 0 }
}

export async function createSalary(dto: CreateSalaryDTO): Promise<AccountingSalary> {
    const token = await getAuthToken()
    if (!token) {
        await handleSessionExpiry()
        throw new Error('Session expired')
    }

    const response = await simpleFetch(`${API_URL}/accounting/salaries`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(dto)
    })

    if (!response.ok) {
        if (response.status === 401) {
            await handleSessionExpiry()
            throw new Error('Session expired')
        }
        const error = await response.json()
        throw new Error(error.error || 'Failed to create salary')
    }

    const data = await response.json()
    return data.data
}

export async function updateSalary(id: string, dto: UpdateSalaryDTO): Promise<AccountingSalary> {
    const token = await getAuthToken()
    if (!token) {
        await handleSessionExpiry()
        throw new Error('Session expired')
    }

    const response = await simpleFetch(`${API_URL}/accounting/salaries/${id}`, {
        method: 'PUT',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(dto)
    })

    if (!response.ok) {
        if (response.status === 401) {
            await handleSessionExpiry()
            throw new Error('Session expired')
        }
        const error = await response.json()
        throw new Error(error.error || 'Failed to update salary')
    }

    const data = await response.json()
    return data.data
}

export async function deleteSalary(id: string, campusId: string): Promise<void> {
    const token = await getAuthToken()
    if (!token) {
        await handleSessionExpiry()
        throw new Error('Session expired')
    }

    const response = await simpleFetch(`${API_URL}/accounting/salaries/${id}?campus_id=${campusId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
    })

    if (!response.ok) {
        if (response.status === 401) {
            await handleSessionExpiry()
            throw new Error('Session expired')
        }
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete salary')
    }
}

// ============================================================================
// TEACHER HOURS API
// ============================================================================

export interface TeacherWithHours {
    id: string
    employee_number?: string
    payment_type?: string
    profile?: {
        first_name: string
        father_name?: string
        last_name: string
    }
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

export interface TeacherHoursDetailResponse {
    teacher: {
        id: string
        first_name: string
        last_name: string
        employee_id?: string
    }
    entries: TeacherHoursEntry[]
}

export async function getTeachersWithHours(campusId: string): Promise<{ data: TeacherWithHours[] }> {
    const token = await getAuthToken()
    if (!token) {
        await handleSessionExpiry()
        throw new Error('Session expired')
    }

    const response = await simpleFetch(`${API_URL}/accounting/teacher-hours?campus_id=${campusId}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` }
    })

    if (!response.ok) {
        if (response.status === 401) {
            await handleSessionExpiry()
            throw new Error('Session expired')
        }
        const error = await response.json()
        throw new Error(error.error || 'Failed to fetch teachers')
    }

    return response.json()
}

export async function getTeacherHoursDetail(
    campusId: string,
    teacherId: string,
    startDate: string,
    endDate: string,
    academicYearId: string
): Promise<{ data: TeacherHoursEntry[] }> {
    const token = await getAuthToken()
    if (!token) {
        await handleSessionExpiry()
        throw new Error('Session expired')
    }

    const params = new URLSearchParams({
        campus_id: campusId,
        start_date: startDate,
        end_date: endDate,
        academic_year_id: academicYearId
    })

    const response = await simpleFetch(`${API_URL}/accounting/teacher-hours/${teacherId}?${params}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` }
    })

    if (!response.ok) {
        if (response.status === 401) {
            await handleSessionExpiry()
            throw new Error('Session expired')
        }
        const error = await response.json()
        throw new Error(error.error || 'Failed to fetch teacher hours')
    }

    return response.json()
}

export async function updateTeacherHourlyRates(
    campusId: string,
    teacherId: string,
    rates: Array<{ timetable_entry_id: string; hourly_rate: number }>
): Promise<{ success: boolean }> {
    const token = await getAuthToken()
    if (!token) {
        await handleSessionExpiry()
        throw new Error('Session expired')
    }

    const response = await simpleFetch(`${API_URL}/accounting/teacher-hours/${teacherId}/rates`, {
        method: 'PUT',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            campus_id: campusId,
            rates
        })
    })

    if (!response.ok) {
        if (response.status === 401) {
            await handleSessionExpiry()
            throw new Error('Session expired')
        }
        const error = await response.json()
        throw new Error(error.error || 'Failed to update hourly rates')
    }

    return response.json()
}

// ============================================================================
// PAYEES API
// ============================================================================

export interface Payee {
    id: string
    school_id: string
    name: string
    email?: string
    phone?: string
    address?: string
    bank?: string
    account_number?: string
    swift_iban?: string
    bsb_bic?: string
    rollover: boolean
    is_active: boolean
    total_payments?: number
    created_at: string
    updated_at: string
}

export interface PayeePayment {
    id: string
    school_id: string
    payee_id: string
    academic_year_id?: string
    amount: number
    payment_date: string
    description?: string
    reference_number?: string
    file_attached?: string
    created_at: string
    updated_at: string
}

export interface CreatePayeeDTO {
    campus_id: string
    name: string
    email?: string
    phone?: string
    address?: string
    bank?: string
    account_number?: string
    swift_iban?: string
    bsb_bic?: string
    rollover?: boolean
}

export interface CreatePayeePaymentDTO {
    campus_id: string
    academic_year_id?: string
    amount: number
    payment_date: string
    description?: string
    reference_number?: string
    file_attached?: string
}

export async function getPayees(campusId: string): Promise<{ data: Payee[] }> {
    const token = await getAuthToken()
    if (!token) {
        await handleSessionExpiry()
        throw new Error('Session expired')
    }

    const response = await simpleFetch(`${API_URL}/accounting/payees?campus_id=${campusId}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` }
    })

    if (!response.ok) {
        if (response.status === 401) {
            await handleSessionExpiry()
            throw new Error('Session expired')
        }
        const error = await response.json()
        throw new Error(error.error || 'Failed to fetch payees')
    }

    return response.json()
}

export async function getPayeeById(campusId: string, payeeId: string): Promise<{ data: Payee }> {
    const token = await getAuthToken()
    if (!token) {
        await handleSessionExpiry()
        throw new Error('Session expired')
    }

    const response = await simpleFetch(`${API_URL}/accounting/payees/${payeeId}?campus_id=${campusId}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` }
    })

    if (!response.ok) {
        if (response.status === 401) {
            await handleSessionExpiry()
            throw new Error('Session expired')
        }
        const error = await response.json()
        throw new Error(error.error || 'Failed to fetch payee')
    }

    return response.json()
}

export async function createPayee(dto: CreatePayeeDTO): Promise<{ data: Payee }> {
    const token = await getAuthToken()
    if (!token) {
        await handleSessionExpiry()
        throw new Error('Session expired')
    }

    const response = await simpleFetch(`${API_URL}/accounting/payees`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(dto)
    })

    if (!response.ok) {
        if (response.status === 401) {
            await handleSessionExpiry()
            throw new Error('Session expired')
        }
        const error = await response.json()
        throw new Error(error.error || 'Failed to create payee')
    }

    return response.json()
}

export async function updatePayee(payeeId: string, dto: Partial<CreatePayeeDTO>): Promise<{ data: Payee }> {
    const token = await getAuthToken()
    if (!token) {
        await handleSessionExpiry()
        throw new Error('Session expired')
    }

    const response = await simpleFetch(`${API_URL}/accounting/payees/${payeeId}`, {
        method: 'PUT',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(dto)
    })

    if (!response.ok) {
        if (response.status === 401) {
            await handleSessionExpiry()
            throw new Error('Session expired')
        }
        const error = await response.json()
        throw new Error(error.error || 'Failed to update payee')
    }

    return response.json()
}

export async function deletePayee(campusId: string, payeeId: string): Promise<void> {
    const token = await getAuthToken()
    if (!token) {
        await handleSessionExpiry()
        throw new Error('Session expired')
    }

    const response = await simpleFetch(`${API_URL}/accounting/payees/${payeeId}?campus_id=${campusId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
    })

    if (!response.ok) {
        if (response.status === 401) {
            await handleSessionExpiry()
            throw new Error('Session expired')
        }
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete payee')
    }
}

export async function getPayeePayments(campusId: string, payeeId: string): Promise<{ data: PayeePayment[] }> {
    const token = await getAuthToken()
    if (!token) {
        await handleSessionExpiry()
        throw new Error('Session expired')
    }

    const response = await simpleFetch(`${API_URL}/accounting/payees/${payeeId}/payments?campus_id=${campusId}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` }
    })

    if (!response.ok) {
        if (response.status === 401) {
            await handleSessionExpiry()
            throw new Error('Session expired')
        }
        const error = await response.json()
        throw new Error(error.error || 'Failed to fetch payee payments')
    }

    return response.json()
}

export async function createPayeePayment(payeeId: string, dto: CreatePayeePaymentDTO): Promise<{ data: PayeePayment }> {
    const token = await getAuthToken()
    if (!token) {
        await handleSessionExpiry()
        throw new Error('Session expired')
    }

    const response = await simpleFetch(`${API_URL}/accounting/payees/${payeeId}/payments`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(dto)
    })

    if (!response.ok) {
        if (response.status === 401) {
            await handleSessionExpiry()
            throw new Error('Session expired')
        }
        const error = await response.json()
        throw new Error(error.error || 'Failed to create payment')
    }

    return response.json()
}

export async function deletePayeePayment(campusId: string, paymentId: string): Promise<void> {
    const token = await getAuthToken()
    if (!token) {
        await handleSessionExpiry()
        throw new Error('Session expired')
    }

    const response = await simpleFetch(`${API_URL}/accounting/payee-payments/${paymentId}?campus_id=${campusId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
    })

    if (!response.ok) {
        if (response.status === 401) {
            await handleSessionExpiry()
            throw new Error('Session expired')
        }
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete payment')
    }
}
