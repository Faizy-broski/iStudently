import { API_URL } from '@/config/api'
import { getAuthToken } from './schools'
import { Staff, Profile, EmploymentType } from './teachers' // Reuse types
import { handleSessionExpiry } from '@/context/AuthContext'
import { simpleFetch } from './abortable-fetch'

interface ApiResponse<T = unknown> {
    success: boolean
    data?: T
    error?: string
    message?: string
}

// Re-export shared types
export type { Staff, Profile, EmploymentType }

// NEW DTOs for Staff (Specific to Custom Fields support)
export interface CreateStaffDTO {
    profile_id?: string
    school_id?: string
    employee_number?: string
    title?: string
    department?: string
    qualifications?: string
    specialization?: string
    date_of_joining?: string
    employment_type?: EmploymentType
    permissions?: Record<string, any>
    custom_fields?: any[] // NEW
    created_by?: string
    first_name?: string
    last_name?: string
    email?: string
    phone?: string
    username?: string
    password?: string
    profile_photo_url?: string
    base_salary?: number
}

export interface UpdateStaffDTO {
    employee_number?: string
    title?: string
    department?: string
    qualifications?: string
    specialization?: string
    date_of_joining?: string
    employment_type?: EmploymentType
    is_active?: boolean
    permissions?: Record<string, any>
    custom_fields?: any[] // NEW
    first_name?: string
    last_name?: string
    email?: string
    phone?: string
    password?: string
}

async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = await getAuthToken()
    const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
    }

    try {
        const response = await simpleFetch(`${API_URL}${endpoint}`, {
            ...options,
            headers,
            timeout: 30000
        })

        // Handle session expiry
        if (response.status === 401) {
            handleSessionExpiry()
            throw new Error('Session expired. Please log in again.')
        }

        let data
        try {
            data = await response.json()
        } catch {
            throw new Error(`API request failed: ${response.status} ${response.statusText} - Invalid JSON response`)
        }

        if (!response.ok) {
            const errorMsg = data.error || data.message || `API request failed: ${response.status} ${response.statusText}`
            throw new Error(errorMsg)
        }

        return data
    } catch (e) {
        if (e instanceof Error && e.message === 'Session expired. Please log in again.') {
            throw e
        }
        // For other errors, we rethrow but could consider silent failure here too if completely matching others.
        // However, staff.ts throws errors which are likely caught by UI. 
        // To be consistent with the "Silence Abort Errors" plan, we should ensure abort/network errors are silent or generic.
        // But staff.ts seems to return T directly or throw. The pattern in students.ts was returning { success: false }. 
        // staff.ts returns T. So we MUST throw or return a default.
        // Since the signature returns Promise<T>, we can't easily return { success: false } without changing return type.
        // Let's keep throwing but ensure NO abort errors are logged or thrown as AbortError.
        throw new Error(e instanceof Error ? e.message : 'Network error')
    }
}

// ============================================================================
// STAFF MANAGEMENT (Use for Staff AND Librarians)
// ============================================================================

export async function getAllStaff(page = 1, limit = 10, search?: string, role: 'staff' | 'librarian' | 'all' = 'all', campusId?: string) {
    const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        role // Filter by role
    })
    if (search) queryParams.append('search', search)
    if (campusId) queryParams.append('campus_id', campusId)

    return apiRequest<{ data: Staff[], total: number, page: number, totalPages: number }>(`/staff?${queryParams.toString()}`)
}

export async function getStaffById(id: string) {
    return apiRequest<Staff>(`/staff/${id}`)
}

export async function createStaff(data: CreateStaffDTO) {
    return apiRequest<Staff>('/staff', {
        method: 'POST',
        body: JSON.stringify(data)
    })
}

export async function updateStaff(id: string, data: UpdateStaffDTO) {
    return apiRequest<Staff>(`/staff/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
    })
}

export async function deleteStaff(id: string) {
    return apiRequest<boolean>(`/staff/${id}`, {
        method: 'DELETE'
    })
}
