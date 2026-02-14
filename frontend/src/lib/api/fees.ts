import { createClient } from '@/lib/supabase/client'
import { simpleFetch } from './abortable-fetch'
import { handleSessionExpiry } from '@/context/AuthContext'
import { API_URL } from '@/config/api'
import { getAuthToken } from './schools'

// ============================================================================
// TYPES
// ============================================================================

export interface FeeCategory {
    id: string
    school_id: string
    name: string
    code: string
    description?: string
    is_mandatory: boolean
    is_discountable: boolean
    display_order: number
    is_active: boolean
}

export interface SiblingDiscountTier {
    id?: string
    sibling_count: number
    discount_type: 'percentage' | 'fixed'
    discount_value: number
    applies_to_categories: string[]
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

export interface StudentFee {
    id: string
    student_id: string
    fee_structure_id: string
    academic_year: string
    fee_month?: string
    base_amount: number
    sibling_discount: number
    custom_discount: number
    late_fee_applied: number
    final_amount: number
    amount_paid: number
    balance: number
    status: 'pending' | 'partial' | 'paid' | 'overdue' | 'waived'
    due_date: string
    discount_forfeited: boolean
    fee_breakdown?: Array<{
        category_id: string
        category_name: string
        category_code: string
        amount: number
        is_override?: boolean
        original_amount?: number
    }>
    students?: {
        student_number: string
        profiles: { first_name: string; last_name: string }
    }
    fee_structures?: {
        fee_categories: { name: string; code: string }
    }
}

export interface StudentFeeOverride {
    id: string
    school_id: string
    student_id: string
    fee_category_id: string
    academic_year: string
    override_amount: number
    reason?: string
    is_active: boolean
    created_by?: string
    created_at: string
    updated_at: string
    fee_categories?: { name: string; code: string }
    students?: {
        id: string
        student_number?: string
        profiles: { first_name: string; last_name: string }
        grade_levels?: { name: string }
    }
}

export interface FeePayment {
    id: string
    student_fee_id: string
    amount: number
    payment_method: string
    payment_reference?: string
    payment_date: string
    notes?: string
}

export type FeeAdjustmentType = 'late_fee_removed' | 'late_fee_reduced' | 'custom_discount' | 'fee_waived' | 'discount_restored'

export interface FeeAdjustment {
    id: string
    student_fee_id: string
    adjusted_by: string
    adjustment_type: FeeAdjustmentType
    amount_before: number
    amount_after: number
    adjustment_amount: number
    reason: string
    created_at: string
    adjusted_by_profile?: { first_name: string; last_name: string }
}

export interface StudentFeeHistory {
    data: StudentFee[]
    summary: { totalBilled: number; totalPaid: number; totalDue: number }
    pagination: { page: number; limit: number; total: number; totalPages: number }
}

interface ApiResponse<T = unknown> {
    success: boolean
    data?: T
    error?: string
    message?: string
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// NOTE: Using centralized getAuthToken from schools.ts which includes
// session validation wait logic to prevent race conditions on tab focus

async function apiRequest<T = unknown>(
    endpoint: string,
    options: RequestInit = {}
): Promise<T> {
    const token = await getAuthToken()

    if (!token) {
        throw new Error('Authentication required')
    }

    const headers: HeadersInit = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options.headers,
    }

    const url = `${API_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`

    try {
        const res = await simpleFetch(url, {
            ...options,
            headers,
            timeout: 30000
        })

        const json = await res.json()

        // Handle 401
        if (res.status === 401) {
            handleSessionExpiry()
            throw new Error('Session expired')
        }

        if (!json.success && !res.ok) {
            throw new Error(json.error || `Request failed: ${res.statusText}`)
        } else if (!json.success) {
            throw new Error(json.error || 'API Error')
        }

        return json.data as T
    } catch {
        // Return a safe fallback or rethrow as a generic error that won't trigger abort toasts
        // Since this function returns T, we can't easily return { success: false }.
        // We throw generic errors that the UI should handle gracefully.
        throw new Error('Network error')
    }
}

// Specific helper for paginated responses which have a specific structure
async function apiRequestPaginated<T>(
    endpoint: string,
    options: RequestInit = {}
): Promise<{ data: T[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> {
    const token = await getAuthToken()

    if (!token) {
        throw new Error('Authentication required')
    }

    const headers: HeadersInit = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options.headers,
    }

    const url = `${API_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`

    const res = await fetch(url, { ...options, headers })
    const json = await res.json()

    if (!json.success) throw new Error(json.error || 'API Error')
    return { data: json.data, pagination: json.pagination }
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

export async function getFeeSettings(schoolId: string): Promise<FeeSettings | null> {
    return apiRequest<FeeSettings>(`/fees/settings?school_id=${schoolId}`)
}

export async function updateFeeSettings(schoolId: string, settings: Partial<FeeSettings>): Promise<FeeSettings> {
    return apiRequest<FeeSettings>('/fees/settings', {
        method: 'PUT',
        body: JSON.stringify({ school_id: schoolId, ...settings })
    })
}

export async function getFeeCategories(schoolId: string): Promise<FeeCategory[]> {
    return apiRequest<FeeCategory[]>(`/fees/categories?school_id=${schoolId}`)
}

export async function createFeeCategory(data: Partial<FeeCategory>): Promise<FeeCategory> {
    return apiRequest<FeeCategory>('/fees/categories', {
        method: 'POST',
        body: JSON.stringify(data)
    })
}

export async function updateFeeCategory(id: string, data: Partial<FeeCategory> & { school_id: string }): Promise<FeeCategory> {
    return apiRequest<FeeCategory>(`/fees/categories/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
    })
}

export async function deleteFeeCategory(id: string, schoolId: string): Promise<void> {
    return apiRequest<void>(`/fees/categories/${id}?school_id=${schoolId}`, {
        method: 'DELETE'
    })
}

export async function getSiblingDiscountTiers(schoolId: string): Promise<SiblingDiscountTier[]> {
    return apiRequest<SiblingDiscountTier[]>(`/fees/sibling-discounts?school_id=${schoolId}`)
}

export async function updateSiblingDiscountTiers(schoolId: string, tiers: SiblingDiscountTier[]): Promise<SiblingDiscountTier[]> {
    return apiRequest<SiblingDiscountTier[]>('/fees/sibling-discounts', {
        method: 'PUT',
        body: JSON.stringify({ school_id: schoolId, tiers })
    })
}

export async function getStudentFees(
    schoolId: string,
    options?: { studentId?: string; academicYear?: string; status?: string; page?: number; limit?: number }
): Promise<{ data: StudentFee[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> {
    const params = new URLSearchParams({ school_id: schoolId })
    if (options?.studentId) params.append('student_id', options.studentId)
    if (options?.academicYear) params.append('academic_year', options.academicYear)
    if (options?.status) params.append('status', options.status)
    if (options?.page) params.append('page', options.page.toString())
    if (options?.limit) params.append('limit', options.limit.toString())

    return apiRequestPaginated<StudentFee>(`/fees/students?${params}`)
}

export async function getStudentFeeById(id: string, schoolId: string): Promise<StudentFee & { payments: FeePayment[] }> {
    return apiRequest<StudentFee & { payments: FeePayment[] }>(`/fees/students/${id}?school_id=${schoolId}`)
}

export async function recordPayment(data: {
    school_id: string
    student_fee_id: string
    amount: number
    payment_method?: string
    payment_reference?: string
    received_by?: string
    notes?: string
}): Promise<FeePayment> {
    return apiRequest<FeePayment>('/fees/payments', {
        method: 'POST',
        body: JSON.stringify(data)
    })
}

export async function restoreDiscount(feeId: string, schoolId: string, adminId: string): Promise<StudentFee> {
    return apiRequest<StudentFee>(`/fees/students/${feeId}/restore-discount`, {
        method: 'POST',
        body: JSON.stringify({ school_id: schoolId, admin_id: adminId })
    })
}

export async function waiveFee(feeId: string, schoolId: string, notes?: string): Promise<StudentFee> {
    return apiRequest<StudentFee>(`/fees/students/${feeId}/waive`, {
        method: 'POST',
        body: JSON.stringify({ school_id: schoolId, notes })
    })
}

export async function getFeeDashboardStats(schoolId: string, academicYear?: string): Promise<{
    total_fees: number
    total_collected: number
    total_pending: number
    total_overdue: number
    counts: { pending: number; partial: number; paid: number; overdue: number; waived: number }
}> {
    const params = new URLSearchParams({ school_id: schoolId })
    if (academicYear) params.append('academic_year', academicYear)

    return apiRequest<{
        total_fees: number
        total_collected: number
        total_pending: number
        total_overdue: number
        counts: { pending: number; partial: number; paid: number; overdue: number; waived: number }
    }>(`/fees/dashboard?${params}`)
}

export function getBalanceDisplay(amountPaid: number, finalAmount: number): { value: string; color: string; status: string } {
    const balance = finalAmount - amountPaid

    if (amountPaid === 0 && finalAmount > 0) {
        return { value: '0.00', color: 'text-red-500', status: 'pending' }
    }
    if (amountPaid >= finalAmount) {
        return { value: '0.00', color: 'text-green-500', status: 'cleared' }
    }
    if (amountPaid > 0) {
        return { value: balance.toFixed(2), color: 'text-yellow-500', status: 'partial' }
    }
    return { value: balance.toFixed(2), color: 'text-gray-500', status: 'pending' }
}

export async function adjustFee(
    feeId: string,
    adjustment: {
        type: FeeAdjustmentType
        newLateFee?: number
        customDiscount?: number
        reason: string
    },
    schoolId?: string
): Promise<StudentFee> {
    const params = schoolId ? `?school_id=${schoolId}` : ''
    return apiRequest<StudentFee>(`/fees/${feeId}/adjust${params}`, {
        method: 'PUT',
        body: JSON.stringify(adjustment)
    })
}

export async function getFeeAdjustments(feeId: string, schoolId?: string): Promise<FeeAdjustment[]> {
    const params = schoolId ? `?school_id=${schoolId}` : ''
    return apiRequest<FeeAdjustment[]>(`/fees/${feeId}/adjustments${params}`)
}

export async function getStudentFeeHistory(
    studentId: string,
    options?: { academicYear?: string; status?: string; page?: number; limit?: number }
): Promise<StudentFeeHistory> {
    const params = new URLSearchParams()
    if (options?.academicYear) params.append('academic_year', options.academicYear)
    if (options?.status) params.append('status', options.status)
    if (options?.page) params.append('page', options.page.toString())
    if (options?.limit) params.append('limit', options.limit.toString())

    const res = await apiRequest<{ data: StudentFee[], summary: any, pagination: any }>(`/fees/history/${studentId}?${params}`)
    return { data: res.data, summary: res.summary, pagination: res.pagination }
}

export async function getFeesByGrade(options?: {
    schoolId?: string
    gradeLevelId?: string
    sectionId?: string
    feeMonth?: string
    status?: string
    page?: number
    limit?: number
}): Promise<{ data: StudentFee[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> {
    const params = new URLSearchParams()
    if (options?.schoolId) params.append('school_id', options.schoolId)
    if (options?.gradeLevelId) params.append('grade_level_id', options.gradeLevelId)
    if (options?.sectionId) params.append('section_id', options.sectionId)
    if (options?.feeMonth) params.append('fee_month', options.feeMonth)
    if (options?.status) params.append('status', options.status)
    if (options?.page) params.append('page', options.page.toString())
    if (options?.limit) params.append('limit', options.limit.toString())

    return apiRequestPaginated<StudentFee>(`/fees/by-grade?${params}`)
}

export async function generateFeeForNewStudent(data: {
    student_id: string
    grade_id: string
    service_ids?: string[]
    academic_year: string
    fee_month: string
    due_date: string
}): Promise<StudentFee> {
    return apiRequest<StudentFee>('/fees/generate-for-student', {
        method: 'POST',
        body: JSON.stringify(data)
    })
}

// ============================================================================
// STUDENT FEE OVERRIDES
// ============================================================================

export async function createStudentFeeOverride(data: {
    school_id?: string
    student_id: string
    fee_category_id: string
    academic_year: string
    override_amount: number
    reason?: string
}): Promise<StudentFeeOverride> {
    return apiRequest<StudentFeeOverride>('/fees/overrides', {
        method: 'POST',
        body: JSON.stringify(data)
    })
}

export async function getStudentFeeOverrides(
    studentId: string,
    schoolId?: string,
    academicYear?: string
): Promise<StudentFeeOverride[]> {
    const params = new URLSearchParams()
    if (schoolId) params.append('school_id', schoolId)
    if (academicYear) params.append('academic_year', academicYear)
    
    return apiRequest<StudentFeeOverride[]>(`/fees/overrides/student/${studentId}?${params}`)
}

export async function getAllSchoolFeeOverrides(options?: {
    schoolId?: string
    academicYear?: string
    feeCategoryId?: string
    isActive?: boolean
    page?: number
    limit?: number
}): Promise<{ data: StudentFeeOverride[]; total: number }> {
    const params = new URLSearchParams()
    if (options?.schoolId) params.append('school_id', options.schoolId)
    if (options?.academicYear) params.append('academic_year', options.academicYear)
    if (options?.feeCategoryId) params.append('fee_category_id', options.feeCategoryId)
    if (options?.isActive !== undefined) params.append('is_active', options.isActive.toString())
    if (options?.page) params.append('page', options.page.toString())
    if (options?.limit) params.append('limit', options.limit.toString())
    
    return apiRequest<{ data: StudentFeeOverride[]; total: number }>(`/fees/overrides?${params}`)
}

export async function updateStudentFeeOverride(
    overrideId: string,
    data: {
        school_id?: string
        override_amount?: number
        reason?: string
        is_active?: boolean
    }
): Promise<StudentFeeOverride> {
    return apiRequest<StudentFeeOverride>(`/fees/overrides/${overrideId}`, {
        method: 'PUT',
        body: JSON.stringify(data)
    })
}

export async function deleteStudentFeeOverride(
    overrideId: string,
    schoolId?: string
): Promise<void> {
    const params = schoolId ? `?school_id=${schoolId}` : ''
    await apiRequest<void>(`/fees/overrides/${overrideId}${params}`, {
        method: 'DELETE'
    })
}
