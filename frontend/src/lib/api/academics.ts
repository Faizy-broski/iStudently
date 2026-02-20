import { getAuthToken } from './schools'
import { handleSessionExpiry } from '@/context/AuthContext'

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

export type SubjectType = 'theory' | 'lab' | 'practical'

export interface GradeLevel {
  id: string
  school_id: string
  name: string
  order_index: number
  base_fee: number
  is_active: boolean
  next_grade_id?: string | null
  next_grade_name?: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  sections_count?: number
  subjects_count?: number
  students_count?: number
}

export interface Section {
  id: string
  school_id: string
  grade_level_id: string
  name: string
  capacity: number
  current_strength: number
  is_active: boolean
  created_at: string
  updated_at: string
  created_by: string | null
  grade_name?: string
  available_seats?: number
}

export interface Subject {
  id: string
  school_id: string
  grade_level_id: string
  name: string
  code: string
  subject_type: SubjectType
  is_active: boolean
  created_at: string
  updated_at: string
  created_by: string | null
  grade_name?: string
  grade_order?: number
}

export interface CreateGradeLevelDTO {
  name: string
  order_index: number
  base_fee: number
  campus_id?: string // For campus-specific grade levels
}

export interface UpdateGradeLevelDTO {
  name?: string
  order_index?: number
  base_fee?: number
  is_active?: boolean
  next_grade_id?: string | null
}

export interface CreateSectionDTO {
  grade_level_id: string
  name: string
  capacity: number
  campus_id?: string // For campus-specific sections
}

export interface UpdateSectionDTO {
  name?: string
  capacity?: number
  is_active?: boolean
}

export interface CreateSubjectDTO {
  grade_level_id: string
  name: string
  code: string
  subject_type?: SubjectType
  campus_id?: string // For campus-specific subjects
}

export interface UpdateSubjectDTO {
  name?: string
  code?: string
  subject_type?: SubjectType
  is_active?: boolean
}

// ============================================================================
// API REQUEST HELPER
// ============================================================================

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

    // Handle 401 - session expired or invalid token
    if (response.status === 401) {
      await handleSessionExpiry()
      return {
        success: false,
        error: 'Session expired'
      }
    }

    if (!response.ok) {
      // Handle specific error messages
      let errorMessage = data.error || `Request failed with status ${response.status}`

      // Provide user-friendly error messages for common issues
      if (errorMessage.includes('Cannot coerce') || errorMessage.includes('JSON')) {
        errorMessage = 'Unable to complete the operation. Please try refreshing the page and trying again.'
      }
      if (errorMessage.includes('not found') || errorMessage.includes('access denied')) {
        errorMessage = 'Access denied or item not found. Please check your permissions.'
      }

      return {
        success: false,
        error: errorMessage
      }
    }

    return data
  } catch {
    // Silent fail - return generic error
    return {
      success: false,
      error: 'Network error. Please check your connection.'
    }
  }
}

// ============================================================================
// GRADE LEVELS API
// ============================================================================

export async function createGradeLevel(
  data: CreateGradeLevelDTO
): Promise<ApiResponse<GradeLevel>> {
  return apiRequest<GradeLevel>('/academics/grades', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

export async function getGradeLevels(schoolId?: string): Promise<ApiResponse<GradeLevel[]>> {
  const query = schoolId ? `?school_id=${schoolId}` : ''
  return apiRequest<GradeLevel[]>(`/academics/grades${query}`)
}

export async function getGradeLevelById(id: string): Promise<ApiResponse<GradeLevel>> {
  return apiRequest<GradeLevel>(`/academics/grades/${id}`)
}

export async function updateGradeLevel(
  id: string,
  data: UpdateGradeLevelDTO
): Promise<ApiResponse<GradeLevel>> {
  return apiRequest<GradeLevel>(`/academics/grades/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
}

export async function deleteGradeLevel(id: string, campusId?: string): Promise<ApiResponse<void>> {
  const suffix = campusId ? `?campus_id=${campusId}` : ''
  return apiRequest<void>(`/academics/grades/${id}${suffix}`, {
    method: 'DELETE'
  })
}

// ============================================================================
// SECTIONS API
// ============================================================================

export async function createSection(data: CreateSectionDTO): Promise<ApiResponse<Section>> {
  return apiRequest<Section>('/academics/sections', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

export async function getSections(gradeId?: string, schoolId?: string): Promise<ApiResponse<Section[]>> {
  const params = new URLSearchParams()
  if (gradeId) params.append('grade_id', gradeId)
  if (schoolId) params.append('school_id', schoolId)
  const query = params.toString() ? `?${params.toString()}` : ''
  return apiRequest<Section[]>(`/academics/sections${query}`)
}

export async function getSectionById(id: string): Promise<ApiResponse<Section>> {
  return apiRequest<Section>(`/academics/sections/${id}`)
}

export async function updateSection(
  id: string,
  data: UpdateSectionDTO
): Promise<ApiResponse<Section>> {
  return apiRequest<Section>(`/academics/sections/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
}

export async function deleteSection(id: string, campusId?: string): Promise<ApiResponse<void>> {
  const suffix = campusId ? `?campus_id=${campusId}` : ''
  return apiRequest<void>(`/academics/sections/${id}${suffix}`, {
    method: 'DELETE'
  })
}

// ============================================================================
// SUBJECTS API
// ============================================================================

export async function createSubject(data: CreateSubjectDTO): Promise<ApiResponse<Subject>> {
  return apiRequest<Subject>('/academics/subjects', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

export async function getSubjects(gradeId?: string, schoolId?: string): Promise<ApiResponse<Subject[]>> {
  const params = new URLSearchParams()
  if (gradeId) params.append('grade_id', gradeId)
  if (schoolId) params.append('school_id', schoolId)
  const query = params.toString() ? `?${params.toString()}` : ''
  return apiRequest<Subject[]>(`/academics/subjects${query}`)
}

export async function getSubjectById(id: string): Promise<ApiResponse<Subject>> {
  return apiRequest<Subject>(`/academics/subjects/${id}`)
}

export async function updateSubject(
  id: string,
  data: UpdateSubjectDTO
): Promise<ApiResponse<Subject>> {
  return apiRequest<Subject>(`/academics/subjects/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
}

export async function deleteSubject(id: string, campusId?: string): Promise<ApiResponse<void>> {
  const suffix = campusId ? `?campus_id=${campusId}` : ''
  return apiRequest<void>(`/academics/subjects/${id}${suffix}`, {
    method: 'DELETE'
  })
}

// ============================================================================
// ACADEMIC YEAR API (Global - used across all modules)
// ============================================================================

export interface AcademicYear {
  id: string
  school_id: string
  name: string
  start_date: string
  end_date: string
  is_current: boolean
  is_next: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CreateAcademicYearDTO {
  name: string
  start_date: string
  end_date: string
  is_current?: boolean
  is_next?: boolean
  is_active?: boolean
}

export interface UpdateAcademicYearDTO {
  name?: string
  start_date?: string
  end_date?: string
  is_current?: boolean
  is_next?: boolean
  is_active?: boolean
}

export async function getAcademicYears(): Promise<AcademicYear[]> {
  const result = await apiRequest<AcademicYear[]>('/academics/academic-years')

  if (!result.success) {
    throw new Error(result.error || 'Failed to fetch academic years')
  }

  return result.data || []
}

export async function getCurrentAcademicYear(): Promise<AcademicYear | null> {
  const result = await apiRequest<AcademicYear>('/academics/academic-years/current')
  return result.data || null
}

export async function createAcademicYear(data: CreateAcademicYearDTO): Promise<AcademicYear> {
  const result = await apiRequest<AcademicYear>('/academics/academic-years', {
    method: 'POST',
    body: JSON.stringify(data)
  })
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to create academic year')
  }
  return result.data
}

export async function updateAcademicYear(
  id: string,
  data: UpdateAcademicYearDTO
): Promise<AcademicYear> {
  const result = await apiRequest<AcademicYear>(`/academics/academic-years/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to update academic year')
  }
  return result.data
}

export async function deleteAcademicYear(id: string): Promise<void> {
  const result = await apiRequest<void>(`/academics/academic-years/${id}`, {
    method: 'DELETE'
  })
  if (!result.success) {
    throw new Error(result.error || 'Failed to delete academic year')
  }
}
