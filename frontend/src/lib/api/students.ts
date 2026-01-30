import { getAuthToken } from './schools'
import { abortableFetch } from './abortable-fetch'
import { handleSessionExpiry } from '@/context/AuthContext'
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
      error: 'Authentication required. Please sign in.'
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  }

  try {
    const response = await abortableFetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
      timeout: 30000
    })

    const data = await response.json()

    // Handle 401 Unauthorized
    if (response.status === 401) {
      console.error('🔒 Session expired in students API')
      await handleSessionExpiry()
      return {
        success: false,
        error: 'Session expired. Please login again.'
      }
    }

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `Request failed with status ${response.status}`
      }
    }

    return data
  } catch (error: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
    // Handle aborted requests gracefully
    if (error instanceof Error && error.message === 'Request was cancelled') {
      console.log('ℹ️ Request cancelled:', endpoint)
      return {
        success: false,
        error: 'Request cancelled'
      }
    }
    console.error('API request error:', error)
    return {
      success: false,
      error: error.message || 'Network error occurred'
    }
  }
}

// ============================================================================
// TYPES
// ============================================================================

export interface Student {
  id: string
  profile_id: string | null
  school_id: string
  student_number: string
  grade_level: string | null
  medical_info?: {
    blood_group?: string
    allergies?: string[]
    medications?: string[]
    conditions?: string[]
    emergency_notes?: string
  }
  custom_fields?: Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
  created_at: string
  profile?: {
    id: string
    first_name: string | null
    father_name: string | null // NEW
    grandfather_name: string | null // NEW
    last_name: string | null
    email: string | null
    phone: string | null
    avatar_url: string | null
    profile_photo_url: string | null // NEW
    is_active: boolean
  }
}

export interface CreateStudentDTO {
  student_number: string
  grade_level?: string
  grade_level_id?: string
  section_id?: string
  campus_id?: string // Campus/School assignment
  first_name: string
  father_name?: string // NEW
  grandfather_name?: string // NEW
  last_name: string
  email?: string
  phone?: string
  profile_photo_url?: string // NEW: Supabase storage URL
  password?: string // NEW: Optional password
  medical_info?: Student['medical_info']
  custom_fields?: Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
}

export interface UpdateStudentDTO {
  student_number?: string
  grade_level?: string
  grade_level_id?: string
  section_id?: string
  first_name?: string
  father_name?: string // NEW
  grandfather_name?: string // NEW
  last_name?: string
  email?: string
  phone?: string
  profile_photo_url?: string // NEW
  password?: string // NEW: Optional password update
  medical_info?: Student['medical_info']
  custom_fields?: Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
}

// ============================================================================
// STUDENT API
// ============================================================================

export async function getStudents(params?: {
  page?: number
  limit?: number
  search?: string
  grade_level?: string
  campus_id?: string
}) {
  const queryParams = new URLSearchParams()
  if (params?.page) queryParams.append('page', params.page.toString())
  if (params?.limit) queryParams.append('limit', params.limit.toString())
  if (params?.search) queryParams.append('search', params.search)
  if (params?.grade_level) queryParams.append('grade_level', params.grade_level)
  if (params?.campus_id) queryParams.append('campus_id', params.campus_id)

  const query = queryParams.toString()
  return apiRequest<Student[]>(`/students${query ? `?${query}` : ''}`)
}

export async function getStudentById(id: string, campusId?: string) {
  const queryParams = new URLSearchParams()
  if (campusId) queryParams.append('campus_id', campusId)
  
  const query = queryParams.toString()
  return apiRequest<Student>(`/students/${id}${query ? `?${query}` : ''}`)
}

export async function getStudentByNumber(studentNumber: string) {
  return apiRequest<Student>(`/students/number/${studentNumber}`)
}

export async function createStudent(data: CreateStudentDTO) {
  return apiRequest<Student>('/students', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

export async function updateStudent(id: string, data: UpdateStudentDTO, campusId?: string) {
  const queryParams = new URLSearchParams()
  if (campusId) queryParams.append('campus_id', campusId)
  
  const query = queryParams.toString()
  return apiRequest<Student>(`/students/${id}${query ? `?${query}` : ''}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
}

export async function deleteStudent(id: string) {
  return apiRequest(`/students/${id}`, {
    method: 'DELETE'
  })
}

export async function getStudentsByGrade(gradeLevel: string) {
  return apiRequest<Student[]>(`/students/grade/${gradeLevel}`)
}

export async function getStudentStats() {
  return apiRequest<{
    total: number
    active: number
    inactive: number
    byGrade: Record<string, number>
  }>('/students/stats')
}
