import { createClient } from '@/lib/supabase/client'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'

// Initialize supabase client once
const supabase = createClient()

interface ApiResponse<T> {
    success?: boolean
    data?: T
    error?: string
}

async function getAuthToken(): Promise<string | null> {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token || null
}

async function apiRequest<T = unknown>(
    endpoint: string,
    options: RequestInit = {}
): Promise<ApiResponse<T>> {
    const token = await getAuthToken()

    if (!token) {
        return {
            success: false,
            error: 'Authentication required'
        }
    }

    try {
        const response = await fetch(`${API_URL}${endpoint}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
                ...options.headers
            }
        })

        const data = await response.json()

        if (!response.ok) {
            return {
                success: false,
                error: data.error || `Request failed with status ${response.status}`
            }
        }

        return { success: true, data }
    } catch (error) {
        console.error('API Request Error:', error)
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred'
        }
    }
}

export interface SetupStatus {
    hasCampuses: boolean
    hasAcademicYear: boolean
    isComplete: boolean
    campusCount: number
    academicYearCount: number
}

export interface Campus {
    id: string
    name: string
    slug: string
    address?: string
    contact_email?: string
    phone?: string
    status: string
    parent_school_id: string
    created_at: string
    updated_at: string
}

export interface CreateCampusData {
    name: string
    address?: string
    contact_email?: string
    phone?: string
}

/**
 * Get the setup status for the current school
 */
export async function getSetupStatus(): Promise<SetupStatus> {
    const result = await apiRequest<SetupStatus>('/setup/status')

    if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to get setup status')
    }

    return result.data
}

/**
 * Get all campuses for the current school
 */
export async function getCampuses(): Promise<Campus[]> {
    const result = await apiRequest<Campus[]>('/setup/campuses')

    if (!result.success) {
        throw new Error(result.error || 'Failed to get campuses')
    }

    return result.data || []
}

/**
 * Create a new campus
 */
export async function createCampus(data: CreateCampusData): Promise<Campus> {
    const result = await apiRequest<Campus>('/setup/campuses', {
        method: 'POST',
        body: JSON.stringify(data)
    })

    if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to create campus')
    }

    return result.data
}

/**
 * Update a campus
 */
export async function updateCampus(id: string, data: Partial<CreateCampusData>): Promise<Campus> {
    const result = await apiRequest<Campus>(`/setup/campuses/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
    })

    if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to update campus')
    }

    return result.data
}

/**
 * Delete a campus
 */
export async function deleteCampus(id: string): Promise<void> {
    const result = await apiRequest(`/setup/campuses/${id}`, {
        method: 'DELETE'
    })

    if (!result.success) {
        throw new Error(result.error || 'Failed to delete campus')
    }
}
