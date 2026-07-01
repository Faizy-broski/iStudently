import { apiRequest } from '@/lib/api'

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
    city?: string
    state?: string
    zip_code?: string
    contact_email?: string
    phone?: string
    principal_name?: string
    short_name?: string
    school_number?: string
    website?: string | null
    logo_url?: string | null
    status: string
    parent_school_id: string
    created_at: string
    updated_at: string
}

export interface CreateCampusData {
    name: string
    address?: string
    city?: string
    state?: string
    zip_code?: string
    contact_email?: string
    phone?: string
    principal_name?: string
    short_name?: string
    school_number?: string
    logo_url?: string | null
}

/**
 * Get the setup status for the current school
 */
export async function getSetupStatus(): Promise<SetupStatus> {
    const result = await apiRequest<SetupStatus>('/setup/status')

    // If it has success=false, it's an error from the shared apiRequest
    if ((result as any).success === false) {
        throw new Error(result.error || 'Failed to get setup status')
    }

    // Backend returns the status object directly
    if ('hasCampuses' in result) {
        return result as unknown as SetupStatus
    }

    return result.data as SetupStatus
}

/**
 * Get all campuses for the current school
 */
export async function getCampuses(): Promise<Campus[]> {
    const result = await apiRequest<Campus[]>('/setup/campuses')

    // If the backend returns an array directly
    if (Array.isArray(result)) {
        return result
    }

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

    if ((result as any).success === false) {
        throw new Error(result.error || 'Failed to create campus')
    }

    if ('id' in result && 'name' in result) {
        return result as unknown as Campus
    }

    return result.data as Campus
}

/**
 * Update a campus
 */
export async function updateCampus(id: string, data: Partial<CreateCampusData>): Promise<Campus> {
    const result = await apiRequest<Campus>(`/setup/campuses/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
    })

    if ((result as any).success === false) {
        throw new Error(result.error || 'Failed to update campus')
    }

    if ('id' in result && 'name' in result) {
        return result as unknown as Campus
    }

    return result.data as Campus
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

/**
 * Get a single campus by ID (used as fallback when getCampuses returns empty for a librarian)
 */
export async function getCampusById(id: string): Promise<Campus | null> {
    const result = await apiRequest<{ success: boolean; data: Campus }>(`/setup/campuses/${id}`)

    if (!result.success || !result.data) {
        return null
    }

    // The backend wraps single-campus responses in { success, data }
    const payload = result.data as any
    return payload?.data ?? payload ?? null
}
