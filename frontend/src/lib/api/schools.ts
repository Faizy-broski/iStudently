import { createClient } from '@/lib/supabase/client'
import { API_URL } from '@/config/api'
import { abortableFetch } from './abortable-fetch'
import { handleSessionExpiry } from '@/context/AuthContext'

interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface School {
  id: string
  name: string
  slug: string
  status: 'active' | 'suspended'
  contact_email: string
  parent_school_id: string | null
  logo_url?: string
}

export interface CreateSchoolDTO {
  name: string
  slug: string
  contact_email: string
  parent_school_id?: string
}

export async function getAuthToken(): Promise<string | null> {
  const supabase = createClient()
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
    const response = await abortableFetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options.headers
      },
      timeout: 30000 // 30 second timeout
    })

    const data = await response.json()

    // Handle 401 Unauthorized - token expired or invalid
    if (response.status === 401) {
      console.error('🔒 Unauthorized - Session expired in schools API')
      await handleSessionExpiry()
      
      return {
        success: false,
        error: 'Session expired. Please login again.'
      }
    }

    // Handle 403 Forbidden - insufficient permissions
    if (response.status === 403) {
      console.error('🚫 Forbidden - Insufficient permissions')
      return {
        success: false,
        error: 'You do not have permission to perform this action'
      }
    }

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `Request failed with status ${response.status}`
      }
    }

    return data
  } catch (error) {
    // Handle aborted requests gracefully
    if (error instanceof Error && error.message === 'Request was cancelled') {
      console.log('ℹ️ API request cancelled:', endpoint)
      return {
        success: false,
        error: 'Request cancelled'
      }
    }
    
    console.error('API Request Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }
  }
}

export async function getMySchools(): Promise<School[]> {
  const result = await apiRequest<School[]>('/schools/my-schools')
  return result.data || []
}

export async function switchSchoolContext(schoolId: string): Promise<School> {
  const result = await apiRequest<School>('/schools/switch-context', {
    method: 'POST',
    body: JSON.stringify({ schoolId })
  })

  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to switch school context')
  }

  return result.data
}

export async function createSchool(data: CreateSchoolDTO): Promise<School> {
  // Try to use the onboarding route if normal create fails, or assume admin can use normal create if permitted
  const result = await apiRequest<School>('/schools', {
    method: 'POST',
    body: JSON.stringify(data)
  })

  // If endpoint doesn't exist or forbidden (403), we might need a different approach.
  // But for now we assume the backend endpoint exists and user has permission (Super Admin or via new RLS)

  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to create school')
  }

  return result.data
}

export interface OnboardSchoolData {
  school: {
    name: string
    slug: string
    contact_email: string
    website?: string | null
    logo_url?: string | null
    address: string
  }
  admin: {
    first_name: string
    last_name: string
    email: string
    password: string
  }
  billing: {
    billing_plan_id: string
    billing_cycle: string
    amount: number
    start_date: string
    due_date: string
    payment_status: string
  }
}

export async function onboardSchool(data: OnboardSchoolData): Promise<School> {
  const result = await apiRequest<School>('/schools/onboard', {
    method: 'POST',
    body: JSON.stringify(data)
  })

  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to onboard school')
  }

  return result.data
}



export async function getAllSchoolsData(filters?: { status?: string }): Promise<ApiResponse<School[]>> {
  const queryParams = new URLSearchParams()
  if (filters?.status && filters.status !== 'all') {
    queryParams.append('status', filters.status)
  }

  const queryString = queryParams.toString() ? `?${queryParams.toString()}` : ''
  return await apiRequest<School[]>(`/schools${queryString}`)
}

export async function updateSchool(id: string, data: Partial<School>): Promise<ApiResponse<School>> {
  return await apiRequest<School>(`/schools/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data)
  })
}

export async function updateSchoolStatus(id: string, status: 'active' | 'suspended'): Promise<ApiResponse<School>> {
  return await apiRequest<School>(`/schools/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status })
  })
}


export async function deleteSchool(id: string): Promise<ApiResponse<void>> {
  return await apiRequest<void>(`/schools/${id}`, {
    method: 'DELETE'
  })
}

export async function getAdmin(schoolId: string): Promise<ApiResponse<any>> {
  return await apiRequest<any>(`/schools/${schoolId}/admin`)
}

export async function updateAdmin(schoolId: string, data: any): Promise<ApiResponse<any>> {
  return await apiRequest<any>(`/schools/${schoolId}/admin`, {
    method: 'PATCH',
    body: JSON.stringify(data)
  })
}

export async function getStats(): Promise<ApiResponse<any>> {
  return await apiRequest<any>('/schools/stats')
}

export const schoolApi = {
  getMySchools,
  switchSchoolContext,
  createSchool,
  getAll: getAllSchoolsData,
  update: updateSchool,
  updateStatus: updateSchoolStatus,
  delete: deleteSchool,
  getAdmin,
  updateAdmin,
  getStats
}
