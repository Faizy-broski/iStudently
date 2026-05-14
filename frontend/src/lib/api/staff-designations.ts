import { API_URL } from '@/config/api'
import { getAuthToken } from './schools'

export interface StaffDesignation {
    id: string
    school_id: string
    campus_id: string | null
    name: string
    description: string | null
    is_system: boolean
    is_active: boolean
    created_at: string
    updated_at: string
}

export interface CreateDesignationDTO {
    name: string
    campus_id?: string | null
    description?: string
}

export interface UpdateDesignationDTO {
    name?: string
    description?: string
    is_active?: boolean
}

interface ApiResponse<T> {
    success: boolean
    data?: T
    error?: string
}

async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    const token = await getAuthToken()
    
    const response = await fetch(`${API_URL}/api/staff-designations${endpoint}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            ...options.headers,
        },
    })

    const data = await response.json()
    
    if (!response.ok) {
        return { success: false, error: data.error || 'Request failed' }
    }

    return data
}

/**
 * Get designations for a school/campus
 * If campusId is provided, returns both campus-specific AND school-wide designations
 */
export async function getDesignations(campusId?: string): Promise<ApiResponse<StaffDesignation[]>> {
    const query = campusId ? `?campus_id=${campusId}` : ''
    return apiRequest<StaffDesignation[]>(`/${query}`)
}

/**
 * Get all designations grouped by campus
 */
export async function getDesignationsGrouped(): Promise<ApiResponse<{
    schoolWide: StaffDesignation[]
    byCampus: Record<string, StaffDesignation[]>
}>> {
    return apiRequest('/grouped')
}

/**
 * Create a new designation
 */
export async function createDesignation(dto: CreateDesignationDTO): Promise<ApiResponse<StaffDesignation>> {
    return apiRequest<StaffDesignation>('/', {
        method: 'POST',
        body: JSON.stringify(dto),
    })
}

/**
 * Update a designation
 */
export async function updateDesignation(id: string, dto: UpdateDesignationDTO): Promise<ApiResponse<StaffDesignation>> {
    return apiRequest<StaffDesignation>(`/${id}`, {
        method: 'PUT',
        body: JSON.stringify(dto),
    })
}

/**
 * Delete a designation
 */
export async function deleteDesignation(id: string): Promise<ApiResponse<void>> {
    return apiRequest<void>(`/${id}`, {
        method: 'DELETE',
    })
}

/**
 * Seed default designations for the school
 */
export async function seedDefaultDesignations(): Promise<ApiResponse<StaffDesignation[]>> {
    return apiRequest<StaffDesignation[]>('/seed', {
        method: 'POST',
    })
}
