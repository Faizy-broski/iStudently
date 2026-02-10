import { getAuthToken } from './schools'
import { handleSessionExpiry } from '@/context/AuthContext' // Fixed import path from contexts to context
import { simpleFetch } from './abortable-fetch'
import { API_URL } from '@/config/api'

interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
  pagination?: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
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
    const response = await simpleFetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
      timeout: 30000
    })

    const data = await response.json()

    if (!response.ok) {
      if (response.status === 401) {
        handleSessionExpiry()
      }
      return {
        success: false,
        error: data.error || `Request failed`
      }
    }

    return data
  } catch {
    // Silent fail
    return {
      success: false,
      error: 'Network error'
    }
  }
}

// ============================================================================
// TYPES
// ============================================================================

export interface StudentWithRelationship {
  id: string
  student_id: string
  student_number: string
  grade_level: string | null
  profile?: {
    first_name: string | null
    last_name: string | null
  }
  relationship: string
  is_emergency_contact: boolean
}

export interface Parent {
  id: string
  profile_id: string | null
  school_id: string
  occupation: string | null
  workplace: string | null
  income: string | null
  cnic: string | null
  address: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  country: string | null
  emergency_contact_name: string | null
  emergency_contact_relation: string | null
  emergency_contact_phone: string | null
  notes: string | null
  metadata: Record<string, any> | null
  custom_fields?: Record<string, any>
  created_at: string
  updated_at: string
  profile?: {
    id: string
    first_name: string | null
    last_name: string | null
    email: string | null
    phone: string | null
    avatar_url: string | null
    is_active: boolean
  }
  children?: StudentWithRelationship[]
}

export interface CreateParentDTO {
  first_name: string
  last_name: string
  email?: string
  password?: string // NEW: Optional password
  phone?: string
  occupation?: string
  workplace?: string
  income?: string
  cnic?: string
  address?: string
  city?: string
  state?: string
  zip_code?: string
  country?: string
  emergency_contact_name?: string
  emergency_contact_relation?: string
  emergency_contact_phone?: string
  receive_notifications?: boolean
  is_primary_contact?: boolean
  notes?: string
  metadata?: Record<string, any>
  custom_fields?: Record<string, any>
}

export interface UpdateParentDTO {
  first_name?: string
  last_name?: string
  email?: string
  password?: string // NEW: Optional password update
  phone?: string
  occupation?: string
  workplace?: string
  income?: string
  cnic?: string
  address?: string
  city?: string
  state?: string
  zip_code?: string
  country?: string
  emergency_contact_name?: string
  emergency_contact_relation?: string
  emergency_contact_phone?: string
  receive_notifications?: boolean
  is_primary_contact?: boolean
  notes?: string
  metadata?: Record<string, any>
  custom_fields?: Record<string, any>
}

export interface CreateParentStudentLinkDTO {
  student_id: string
  relationship: string
  is_emergency_contact?: boolean
}

// ============================================================================
// PARENT API
// ============================================================================

export async function getParents(params?: {
  page?: number
  limit?: number
  search?: string
}) {
  const queryParams = new URLSearchParams()
  if (params?.page) queryParams.append('page', params.page.toString())
  if (params?.limit) queryParams.append('limit', params.limit.toString())
  if (params?.search) queryParams.append('search', params.search)

  const query = queryParams.toString()
  return apiRequest<Parent[]>(`/parents${query ? `?${query}` : ''}`)
}

export async function getParentsWithChildren(params?: {
  page?: number
  limit?: number
  search?: string
}) {
  const queryParams = new URLSearchParams()
  if (params?.page) queryParams.append('page', params.page.toString())
  if (params?.limit) queryParams.append('limit', params.limit.toString())
  if (params?.search) queryParams.append('search', params.search)

  const query = queryParams.toString()
  return apiRequest<Parent[]>(`/parents/with-children${query ? `?${query}` : ''}`)
}

export async function getParentById(id: string) {
  return apiRequest<Parent>(`/parents/${id}`)
}

export async function getParentWithChildren(id: string) {
  return apiRequest<Parent>(`/parents/${id}/children`)
}

export async function getParentChildren(id: string) {
  return apiRequest<StudentWithRelationship[]>(`/parents/${id}/students`)
}

export async function createParent(data: CreateParentDTO) {
  return apiRequest<Parent>('/parents', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

export async function updateParent(id: string, data: UpdateParentDTO) {
  return apiRequest<Parent>(`/parents/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
}

export async function deleteParent(id: string) {
  return apiRequest(`/parents/${id}`, {
    method: 'DELETE'
  })
}

export async function linkParentToStudent(parentId: string, data: CreateParentStudentLinkDTO) {
  return apiRequest(`/parents/${parentId}/link-student`, {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

export async function unlinkParentFromStudent(parentId: string, studentId: string) {
  return apiRequest(`/parents/${parentId}/unlink-student/${studentId}`, {
    method: 'DELETE'
  })
}

export async function searchParents(query: string) {
  return apiRequest<Parent[]>(`/parents/search?q=${encodeURIComponent(query)}`)
}
