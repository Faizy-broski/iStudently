import { getAuthToken } from './schools'
import { handleSessionExpiry } from '@/context/AuthContext'
import { API_URL } from '@/config/api'

interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// Helper function to make authenticated requests with 401 handling
async function authenticatedFetch(url: string, options: RequestInit = {}) {
  const token = await getAuthToken()
  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`
    }
  })
  
  // Handle 401 - session expired
  if (response.status === 401) {
    await handleSessionExpiry()
    throw new Error('Session expired')
  }
  
  return response
}

// ============================================================================
// TYPES
// ============================================================================

export type AssignmentStatus = 'pending' | 'submitted' | 'late' | 'graded' | 'returned'

export interface Assignment {
  id: string
  school_id: string
  teacher_id: string
  section_id: string
  subject_id: string
  academic_year_id: string
  title: string
  description: string | null
  instructions: string | null
  assigned_date: string
  due_date: string
  due_time: string | null
  max_score: number
  is_graded: boolean
  allow_late_submission: boolean
  attachments: any[]
  is_published: boolean
  is_archived: boolean
  created_at: string
  updated_at: string
  teacher?: {
    id: string
    profile: {
      first_name: string | null
      last_name: string | null
    }
  }
  section?: {
    id: string
    name: string
    current_strength?: number
    grade_level?: {
      name: string
    }
  }
  subject?: {
    id: string
    name: string
  }
  academic_year?: {
    id: string
    year_name: string
  }
}

export interface CreateAssignmentDTO {
  school_id: string
  campus_id?: string  // For multi-campus support
  teacher_id: string
  section_id: string
  subject_id: string
  academic_year_id: string
  title: string
  description?: string
  instructions?: string
  assigned_date?: string
  due_date: string
  due_time?: string
  max_score?: number
  is_graded?: boolean
  allow_late_submission?: boolean
  attachments?: any[]
  is_published?: boolean
  created_by?: string
}

export interface UpdateAssignmentDTO {
  title?: string
  description?: string
  instructions?: string
  due_date?: string
  due_time?: string
  max_score?: number
  is_graded?: boolean
  allow_late_submission?: boolean
  attachments?: any[]
  is_published?: boolean
  is_archived?: boolean
}

export interface AssignmentSubmission {
  id: string
  assignment_id: string
  student_id: string
  school_id: string
  submission_text: string | null
  attachments: any[]
  status: AssignmentStatus
  submitted_at: string | null
  score: number | null
  feedback: string | null
  graded_at: string | null
  graded_by: string | null
  created_at: string
  updated_at: string
  student?: {
    id: string
    student_number: string
    profile: {
      first_name: string | null
      last_name: string | null
    }
  }
  assignment?: {
    title: string
    max_score: number
  }
}

export interface AssignmentStats {
  total_students: number
  submitted: number
  pending: number
  graded: number
  average_score: number
}

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

export async function getTeacherAssignments(
  teacherId: string,
  filters?: {
    section_id?: string
    subject_id?: string
    academic_year_id?: string
    is_archived?: boolean
    search?: string
    status?: 'all' | 'active' | 'upcoming' | 'past'
    page?: number
    limit?: number
  }
): Promise<PaginatedResponse<Assignment>> {
  const token = await getAuthToken()
  const params = new URLSearchParams({ teacher_id: teacherId })
  if (filters?.section_id) params.append('section_id', filters.section_id)
  if (filters?.subject_id) params.append('subject_id', filters.subject_id)
  if (filters?.academic_year_id) params.append('academic_year_id', filters.academic_year_id)
  if (filters?.is_archived !== undefined) params.append('is_archived', String(filters.is_archived))
  if (filters?.search) params.append('search', filters.search)
  if (filters?.status) params.append('status', filters.status)
  if (filters?.page) params.append('page', String(filters.page))
  if (filters?.limit) params.append('limit', String(filters.limit))

  const response = await fetch(`${API_URL}/assignments/teacher?${params}`, {
    headers: { Authorization: `Bearer ${token}` }
  })

  const result: ApiResponse<PaginatedResponse<Assignment>> = await response.json()
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to fetch assignments')
  }

  return result.data
}

export async function getSectionAssignments(
  sectionId: string,
  filters?: {
    subject_id?: string
    academic_year_id?: string
  }
): Promise<Assignment[]> {
  const token = await getAuthToken()
  const params = new URLSearchParams({ section_id: sectionId })
  if (filters?.subject_id) params.append('subject_id', filters.subject_id)
  if (filters?.academic_year_id) params.append('academic_year_id', filters.academic_year_id)

  const response = await fetch(`${API_URL}/assignments/section?${params}`, {
    headers: { Authorization: `Bearer ${token}` }
  })

  const result: ApiResponse<Assignment[]> = await response.json()
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to fetch assignments')
  }

  return result.data
}

export async function getAssignment(assignmentId: string): Promise<Assignment> {
  const token = await getAuthToken()
  const response = await fetch(`${API_URL}/assignments/${assignmentId}`, {
    headers: { Authorization: `Bearer ${token}` }
  })

  const result: ApiResponse<Assignment> = await response.json()
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to fetch assignment')
  }

  return result.data
}

export async function createAssignment(dto: CreateAssignmentDTO): Promise<Assignment> {
  const token = await getAuthToken()
  const response = await fetch(`${API_URL}/assignments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(dto)
  })

  const result: ApiResponse<Assignment> = await response.json()
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to create assignment')
  }

  return result.data
}

export async function updateAssignment(
  assignmentId: string,
  dto: UpdateAssignmentDTO
): Promise<Assignment> {
  const token = await getAuthToken()
  const response = await fetch(`${API_URL}/assignments/${assignmentId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(dto)
  })

  const result: ApiResponse<Assignment> = await response.json()
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to update assignment')
  }

  return result.data
}

export async function deleteAssignment(assignmentId: string): Promise<void> {
  const token = await getAuthToken()
  const response = await fetch(`${API_URL}/assignments/${assignmentId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  })

  const result: ApiResponse = await response.json()
  if (!result.success) {
    throw new Error(result.error || 'Failed to delete assignment')
  }
}

export async function getAssignmentSubmissions(
  assignmentId: string
): Promise<AssignmentSubmission[]> {
  const token = await getAuthToken()
  const response = await fetch(`${API_URL}/assignments/${assignmentId}/submissions`, {
    headers: { Authorization: `Bearer ${token}` }
  })

  const result: ApiResponse<AssignmentSubmission[]> = await response.json()
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to fetch submissions')
  }

  return result.data
}

export async function getAssignmentStats(assignmentId: string): Promise<AssignmentStats> {
  const token = await getAuthToken()
  const response = await fetch(`${API_URL}/assignments/${assignmentId}/stats`, {
    headers: { Authorization: `Bearer ${token}` }
  })

  const result: ApiResponse<AssignmentStats> = await response.json()
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to fetch assignment stats')
  }

  return result.data
}

export async function gradeSubmission(
  submissionId: string,
  gradeData: { score: number; feedback: string; graded_by: string }
): Promise<AssignmentSubmission> {
  const token = await getAuthToken()
  const response = await fetch(`${API_URL}/assignments/submissions/${submissionId}/grade`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(gradeData)
  })

  const result: ApiResponse<AssignmentSubmission> = await response.json()
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to grade submission')
  }

  return result.data
}
