import { getAuthToken } from './schools'
import { API_URL } from '@/config/api'

interface ApiResponse<T = unknown> {
    success: boolean
    data?: T
    error?: string
    message?: string
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

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    }

    try {
        const response = await fetch(`${API_URL}${endpoint}`, {
            ...options,
            headers: {
                ...headers,
                ...options.headers,
            },
        })

        const data = await response.json()

        if (!response.ok) {
            return {
                success: false,
                error: data.error || `Request failed with status ${response.status}`
            }
        }

        return data
    } catch (error: any) {
        console.error('API request error:', error)
        return {
            success: false,
            error: error.message || 'Network error occurred'
        }
    }
}

export interface SchoolService {
    id: string
    name: string
    code: string
    description?: string
    service_type: 'recurring' | 'one_time'
    charge_frequency: 'monthly' | 'quarterly' | 'yearly' | 'one_time'
    default_charge: number
    is_mandatory: boolean
    is_active: boolean
    campus_id?: string  // For campus-specific services
    grade_charges?: Array<{
        grade_level_id: string
        charge_amount: number
    }>
}

export interface StudentServiceSubscription {
    id: string
    student_id: string
    service_id: string
    service: SchoolService
    start_date: string
    is_active: boolean
}

// Get all services
export async function getServices(activeOnly = true, campusId?: string) {
    let url = `/school-services?active=${activeOnly}`
    if (campusId) {
        url += `&campus_id=${campusId}`
    }
    return apiRequest<SchoolService[]>(url)
}

// Get single service
export async function getServiceById(id: string) {
    return apiRequest<SchoolService>(`/school-services/${id}`)
}

// Create service
export async function createService(data: Partial<SchoolService>) {
    return apiRequest<SchoolService>('/school-services', {
        method: 'POST',
        body: JSON.stringify(data)
    })
}

// Update service
export async function updateService(id: string, data: Partial<SchoolService>) {
    return apiRequest<SchoolService>(`/school-services/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
    })
}

// Delete service
export async function deleteService(id: string) {
    return apiRequest(`/school-services/${id}`, {
        method: 'DELETE'
    })
}

// Set grade charges
export async function setGradeCharges(serviceId: string, charges: Array<{ grade_level_id: string, charge_amount: number }>) {
    return apiRequest(`/school-services/${serviceId}/grade-charges`, {
        method: 'PUT',
        body: JSON.stringify({ charges })
    })
}

// Get student subscriptions
export async function getStudentServices(studentId: string) {
    return apiRequest<StudentServiceSubscription[]>(`/school-services/student/${studentId}`)
}

// Subscribe student to services
export async function subscribeStudentToServices(studentId: string, serviceIds: string[]) {
    return apiRequest(`/school-services/student/${studentId}/subscribe`, {
        method: 'POST',
        body: JSON.stringify({ serviceIds })
    })
}

// Unsubscribe student
export async function unsubscribeStudentFromService(studentId: string, serviceId: string) {
    return apiRequest(`/school-services/student/${studentId}/${serviceId}`, {
        method: 'DELETE'
    })
}
