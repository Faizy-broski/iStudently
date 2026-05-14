import { getAuthToken } from './schools'
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
    return { success: false, error: 'Authentication required. Please sign in.' }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  }

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: { ...headers, ...options.headers },
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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Network error occurred'
    console.error('API request error:', error)
    return { success: false, error: message }
  }
}

// ==================
// Types
// ==================

export interface LessonPlanFile {
  id: string
  lesson_id: string
  file_name: string
  file_url: string
  file_type?: string
  file_size?: number
  uploaded_at: string
  uploaded_by?: string
}

export interface LessonPlanItem {
  id: string
  lesson_id: string
  sort_order: number
  time_minutes?: number
  teacher_activity?: string
  learner_activity?: string
  formative_assessment?: string
  learning_materials?: string
  created_at: string
  updated_at: string
}

export interface LessonPlanLesson {
  id: string
  school_id: string
  campus_id?: string
  course_period_id: string
  teacher_id: string
  academic_year_id: string
  title: string
  on_date: string
  lesson_number: number
  length_minutes?: number
  learning_objectives?: string
  evaluation?: string
  inclusiveness?: string
  is_published: boolean
  created_at: string
  updated_at: string
  created_by?: string
  course_period?: {
    id: string
    title?: string
    short_name?: string
    course?: { id: string; title: string; short_name?: string }
    section?: {
      id: string
      name: string
      grade_level?: { id: string; name: string }
    }
    period?: { id: string; title: string; short_name?: string; sort_order?: number }
    teacher?: {
      id: string
      profile?: { first_name: string; last_name: string }
    }
  }
  teacher?: {
    id: string
    profile?: { first_name: string; last_name: string }
  }
  items?: LessonPlanItem[]
  files?: LessonPlanFile[]
}

export interface LessonPlanSummaryItem {
  course_period_id: string
  course_period: LessonPlanLesson['course_period']
  count: number
  last_date: string
}

export interface CreateLessonDTO {
  course_period_id: string
  teacher_id: string
  academic_year_id: string
  title: string
  on_date: string
  lesson_number?: number
  length_minutes?: number
  learning_objectives?: string
  evaluation?: string
  inclusiveness?: string
  campus_id?: string
  items?: CreateLessonItemDTO[]
}

export interface UpdateLessonDTO {
  title?: string
  on_date?: string
  lesson_number?: number
  length_minutes?: number
  learning_objectives?: string
  evaluation?: string
  inclusiveness?: string
  is_published?: boolean
}

export interface CreateLessonItemDTO {
  sort_order: number
  time_minutes?: number
  teacher_activity?: string
  learner_activity?: string
  formative_assessment?: string
  learning_materials?: string
}

// ==================
// API Functions
// ==================

export async function getLessonPlans(params?: {
  course_period_id?: string
  teacher_id?: string
  campus_id?: string
  academic_year_id?: string
  date_from?: string
  date_to?: string
  on_date?: string
  page?: number
  limit?: number
}): Promise<ApiResponse<LessonPlanLesson[]>> {
  const searchParams = new URLSearchParams()
  if (params?.course_period_id) searchParams.set('course_period_id', params.course_period_id)
  if (params?.teacher_id) searchParams.set('teacher_id', params.teacher_id)
  if (params?.campus_id) searchParams.set('campus_id', params.campus_id)
  if (params?.academic_year_id) searchParams.set('academic_year_id', params.academic_year_id)
  if (params?.date_from) searchParams.set('date_from', params.date_from)
  if (params?.date_to) searchParams.set('date_to', params.date_to)
  if (params?.on_date) searchParams.set('on_date', params.on_date)
  if (params?.page) searchParams.set('page', params.page.toString())
  if (params?.limit) searchParams.set('limit', params.limit.toString())

  const qs = searchParams.toString()
  return apiRequest<LessonPlanLesson[]>(`/lesson-plans${qs ? `?${qs}` : ''}`)
}

export async function getLessonPlanSummary(params?: {
  teacher_id?: string
  campus_id?: string
  academic_year_id?: string
}): Promise<ApiResponse<LessonPlanSummaryItem[]>> {
  const searchParams = new URLSearchParams()
  if (params?.teacher_id) searchParams.set('teacher_id', params.teacher_id)
  if (params?.campus_id) searchParams.set('campus_id', params.campus_id)
  if (params?.academic_year_id) searchParams.set('academic_year_id', params.academic_year_id)

  const qs = searchParams.toString()
  return apiRequest<LessonPlanSummaryItem[]>(`/lesson-plans/summary${qs ? `?${qs}` : ''}`)
}

export async function getLessonPlanById(id: string): Promise<ApiResponse<LessonPlanLesson>> {
  return apiRequest<LessonPlanLesson>(`/lesson-plans/${id}`)
}

export async function createLessonPlan(dto: CreateLessonDTO): Promise<ApiResponse<LessonPlanLesson>> {
  return apiRequest<LessonPlanLesson>('/lesson-plans', {
    method: 'POST',
    body: JSON.stringify(dto),
  })
}

export async function updateLessonPlan(id: string, dto: UpdateLessonDTO): Promise<ApiResponse<LessonPlanLesson>> {
  return apiRequest<LessonPlanLesson>(`/lesson-plans/${id}`, {
    method: 'PUT',
    body: JSON.stringify(dto),
  })
}

export async function deleteLessonPlan(id: string): Promise<ApiResponse<void>> {
  return apiRequest<void>(`/lesson-plans/${id}`, { method: 'DELETE' })
}

export async function replaceLessonItems(
  lessonId: string,
  items: CreateLessonItemDTO[]
): Promise<ApiResponse<LessonPlanLesson>> {
  return apiRequest<LessonPlanLesson>(`/lesson-plans/${lessonId}/items`, {
    method: 'PUT',
    body: JSON.stringify({ items }),
  })
}

export async function addLessonFile(
  lessonId: string,
  file: { file_name: string; file_url: string; file_type?: string; file_size?: number }
): Promise<ApiResponse<LessonPlanFile>> {
  return apiRequest<LessonPlanFile>(`/lesson-plans/${lessonId}/files`, {
    method: 'POST',
    body: JSON.stringify(file),
  })
}

export async function removeLessonFile(fileId: string): Promise<ApiResponse<void>> {
  return apiRequest<void>(`/lesson-plans/files/${fileId}`, { method: 'DELETE' })
}
