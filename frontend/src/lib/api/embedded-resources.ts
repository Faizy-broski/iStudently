import { getAuthToken } from './schools'
import { handleSessionExpiry } from '@/context/AuthContext'
import { API_URL } from '@/config/api'

interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface EmbeddedResource {
  id: string
  school_id: string
  title: string
  url: string
  // Audience targeting
  published_grade_ids: string[]       // students in these grades (empty = all)
  published_section_ids: string[]     // students in these sections (overrides grade when set)
  visible_to_roles: string[]          // empty = all roles
  visible_to_teacher_ids: string[]    // empty = all teachers
  visible_to_student_ids: string[]    // specific student record IDs (empty = all in section/grade)
  is_active: boolean
  sort_order: number                  // manual display order (lower first)
  created_at: string
  updated_at: string
  created_by: string | null
  // Enriched server-side
  published_grade_names?: string[]
  published_section_names?: string[]
  creator_name?: string | null
}

export interface CreateEmbeddedResourceDTO {
  title: string
  url: string
  published_grade_ids?: string[]
  published_section_ids?: string[]
  visible_to_roles?: string[]
  visible_to_teacher_ids?: string[]
  visible_to_student_ids?: string[]
  sort_order?: number
  campus_id?: string
}

export interface UpdateEmbeddedResourceDTO {
  title?: string
  url?: string
  published_grade_ids?: string[]
  published_section_ids?: string[]
  visible_to_roles?: string[]
  visible_to_teacher_ids?: string[]
  visible_to_student_ids?: string[]
  is_active?: boolean
  sort_order?: number
}

async function apiRequest<T = unknown>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = await getAuthToken()
  if (!token) return { success: false, error: 'Authentication required. Please sign in.' }

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    })

    const data = await response.json()

    if (response.status === 401) {
      await handleSessionExpiry()
      return { success: false, error: 'Session expired' }
    }

    if (!response.ok) {
      return { success: false, error: data.error || `Request failed with status ${response.status}` }
    }

    return data
  } catch {
    return { success: false, error: 'Network error. Please check your connection.' }
  }
}

// Admin — fetch all resources for the selected campus
export async function getEmbeddedResources(campusId?: string): Promise<ApiResponse<EmbeddedResource[]>> {
  const qs = campusId ? `?school_id=${encodeURIComponent(campusId)}` : ''
  return apiRequest<EmbeddedResource[]>(`/embedded-resources${qs}`)
}

// Non-admin users — grade-filtered list (backend uses profile.campus_id automatically)
export async function getEmbeddedResourcesForUser(
  gradeId?: string
): Promise<ApiResponse<EmbeddedResource[]>> {
  const qs = gradeId ? `?grade_id=${gradeId}` : ''
  return apiRequest<EmbeddedResource[]>(`/embedded-resources/for-user${qs}`)
}

export async function getEmbeddedResourceById(
  id: string,
  campusId?: string
): Promise<ApiResponse<EmbeddedResource>> {
  const qs = campusId ? `?school_id=${encodeURIComponent(campusId)}` : ''
  return apiRequest<EmbeddedResource>(`/embedded-resources/${id}${qs}`)
}

export async function createEmbeddedResource(
  data: CreateEmbeddedResourceDTO
): Promise<ApiResponse<EmbeddedResource>> {
  return apiRequest<EmbeddedResource>('/embedded-resources', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateEmbeddedResource(
  id: string,
  data: UpdateEmbeddedResourceDTO,
  campusId?: string
): Promise<ApiResponse<EmbeddedResource>> {
  const qs = campusId ? `?school_id=${encodeURIComponent(campusId)}` : ''
  return apiRequest<EmbeddedResource>(`/embedded-resources/${id}${qs}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function deleteEmbeddedResource(
  id: string,
  campusId?: string
): Promise<ApiResponse<void>> {
  const qs = campusId ? `?school_id=${encodeURIComponent(campusId)}` : ''
  return apiRequest<void>(`/embedded-resources/${id}${qs}`, { method: 'DELETE' })
}
