import { getAuthToken } from './schools'
import { API_URL } from '@/config/api'

interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// ============================================================================
// TYPES
// ============================================================================

export type ResourceType = 'link' | 'book' | 'post' | 'file' | 'video'

export interface LearningResource {
  id: string
  school_id: string
  campus_id?: string
  academic_year_id: string
  teacher_id: string
  section_id?: string
  subject_id?: string
  grade_level_id?: string
  title: string
  description?: string
  resource_type: ResourceType
  url?: string
  content?: string
  file_urls?: string[]
  book_title?: string
  book_author?: string
  book_isbn?: string
  book_cover_url?: string
  tags?: string[]
  is_pinned: boolean
  is_published: boolean
  view_count: number
  created_at: string
  updated_at: string
  teacher?: {
    id: string
    profile: {
      first_name: string
      last_name: string
    }
  }
  section?: {
    id: string
    name: string
    grade_level?: {
      id: string
      name: string
    }
  }
  subject?: {
    id: string
    name: string
  }
}

export interface CreateResourceDTO {
  school_id: string
  campus_id?: string
  academic_year_id: string
  teacher_id: string
  section_id?: string
  subject_id?: string
  grade_level_id?: string
  title: string
  description?: string
  resource_type: ResourceType
  url?: string
  content?: string
  file_urls?: string[]
  book_title?: string
  book_author?: string
  book_isbn?: string
  book_cover_url?: string
  tags?: string[]
  is_pinned?: boolean
  is_published?: boolean
}

export interface UpdateResourceDTO extends Partial<Omit<CreateResourceDTO, 'school_id' | 'teacher_id'>> {}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

const getHeaders = async () => {
  const token = await getAuthToken()
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  }
}

// Get resources by teacher
export const getTeacherResources = async (
  teacherId: string,
  filters?: {
    section_id?: string
    subject_id?: string
    resource_type?: string
    is_published?: boolean
    search?: string
  },
  pagination?: {
    page?: number
    limit?: number
  }
): Promise<PaginatedResponse<LearningResource>> => {
  const params = new URLSearchParams({ teacher_id: teacherId })
  
  if (filters?.section_id) params.append('section_id', filters.section_id)
  if (filters?.subject_id) params.append('subject_id', filters.subject_id)
  if (filters?.resource_type) params.append('resource_type', filters.resource_type)
  if (filters?.is_published !== undefined) params.append('is_published', String(filters.is_published))
  if (filters?.search) params.append('search', filters.search)
  
  params.append('page', String(pagination?.page || 1))
  params.append('limit', String(pagination?.limit || 10))

  const response = await fetch(
    `${API_URL}/learning-resources/teacher?${params.toString()}`,
    { headers: await getHeaders() }
  )

  const result: ApiResponse<PaginatedResponse<LearningResource>> = await response.json()
  
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to fetch resources')
  }

  return result.data
}

// Get resources by section (for students)
export const getSectionResources = async (
  sectionId: string,
  filters?: {
    subject_id?: string
    resource_type?: string
    search?: string
  },
  pagination?: {
    page?: number
    limit?: number
  }
): Promise<PaginatedResponse<LearningResource>> => {
  const params = new URLSearchParams({ section_id: sectionId })
  
  if (filters?.subject_id) params.append('subject_id', filters.subject_id)
  if (filters?.resource_type) params.append('resource_type', filters.resource_type)
  if (filters?.search) params.append('search', filters.search)
  
  params.append('page', String(pagination?.page || 1))
  params.append('limit', String(pagination?.limit || 10))

  const response = await fetch(
    `${API_URL}/learning-resources/section?${params.toString()}`,
    { headers: await getHeaders() }
  )

  const result: ApiResponse<PaginatedResponse<LearningResource>> = await response.json()
  
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to fetch resources')
  }

  return result.data
}

// Get single resource
export const getResource = async (resourceId: string): Promise<LearningResource> => {
  const response = await fetch(
    `${API_URL}/learning-resources/${resourceId}`,
    { headers: await getHeaders() }
  )

  const result: ApiResponse<LearningResource> = await response.json()
  
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Resource not found')
  }

  return result.data
}

// Create resource
export const createResource = async (dto: CreateResourceDTO): Promise<LearningResource> => {
  const response = await fetch(
    `${API_URL}/learning-resources`,
    {
      method: 'POST',
      headers: await getHeaders(),
      body: JSON.stringify(dto)
    }
  )

  const result: ApiResponse<LearningResource> = await response.json()
  
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to create resource')
  }

  return result.data
}

// Update resource
export const updateResource = async (
  resourceId: string,
  dto: UpdateResourceDTO
): Promise<LearningResource> => {
  const response = await fetch(
    `${API_URL}/learning-resources/${resourceId}`,
    {
      method: 'PUT',
      headers: await getHeaders(),
      body: JSON.stringify(dto)
    }
  )

  const result: ApiResponse<LearningResource> = await response.json()
  
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to update resource')
  }

  return result.data
}

// Delete resource
export const deleteResource = async (resourceId: string): Promise<void> => {
  const response = await fetch(
    `${API_URL}/learning-resources/${resourceId}`,
    {
      method: 'DELETE',
      headers: await getHeaders()
    }
  )

  const result: ApiResponse<{ deleted: boolean }> = await response.json()
  
  if (!result.success) {
    throw new Error(result.error || 'Failed to delete resource')
  }
}

// Record view (for students)
export const recordResourceView = async (
  resourceId: string,
  studentId: string
): Promise<void> => {
  const response = await fetch(
    `${API_URL}/learning-resources/view`,
    {
      method: 'POST',
      headers: await getHeaders(),
      body: JSON.stringify({ resource_id: resourceId, student_id: studentId })
    }
  )

  const result: ApiResponse<{ recorded: boolean }> = await response.json()
  
  if (!result.success) {
    console.error('Failed to record view:', result.error)
  }
}

// Get view stats (for teachers)
export const getResourceViewStats = async (
  resourceId: string
): Promise<{ total_views: number; unique_views: number }> => {
  const response = await fetch(
    `${API_URL}/learning-resources/${resourceId}/stats`,
    { headers: await getHeaders() }
  )

  const result: ApiResponse<{ total_views: number; unique_views: number }> = await response.json()
  
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to get view stats')
  }

  return result.data
}
