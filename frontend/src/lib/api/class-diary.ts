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

export interface DiaryFile {
  id: string
  diary_entry_id: string
  file_name: string
  file_url: string
  file_type?: string
  file_size?: number
  uploaded_at: string
  uploaded_by?: string
}

export interface DiaryComment {
  id: string
  diary_entry_id: string
  author_id: string
  content: string
  created_at: string
  updated_at: string
  author?: {
    id: string
    first_name: string
    last_name: string
    role: string
  }
}

export interface DiaryEntry {
  id: string
  school_id: string
  campus_id?: string
  timetable_entry_id?: string
  teacher_id: string
  section_id: string
  subject_id?: string
  diary_date: string
  day_of_week?: number
  content: string
  entry_time?: string
  enable_comments: boolean
  is_published: boolean
  created_at: string
  updated_at: string
  created_by?: string
  teacher?: {
    id: string
    profile?: { first_name: string; last_name: string }
  }
  section?: {
    id: string
    name: string
    grade_level?: { id: string; name: string }
  }
  subject?: {
    id: string
    name: string
  }
  files?: DiaryFile[]
  comments?: DiaryComment[]
}

export interface CreateDiaryEntryDTO {
  content: string
  section_id: string
  teacher_id: string
  subject_id?: string
  diary_date: string
  day_of_week?: number
  timetable_entry_id?: string
  entry_time?: string
  enable_comments?: boolean
  campus_id?: string
}

export interface UpdateDiaryEntryDTO {
  content?: string
  enable_comments?: boolean
  is_published?: boolean
}

// ==================
// API Functions
// ==================

export async function getDiaryEntries(params?: {
  diary_date?: string
  section_id?: string
  subject_id?: string
  teacher_id?: string
  campus_id?: string
  day_of_week?: number
  page?: number
  limit?: number
}): Promise<ApiResponse<DiaryEntry[]>> {
  const searchParams = new URLSearchParams()
  if (params?.diary_date) searchParams.set('diary_date', params.diary_date)
  if (params?.section_id) searchParams.set('section_id', params.section_id)
  if (params?.subject_id) searchParams.set('subject_id', params.subject_id)
  if (params?.teacher_id) searchParams.set('teacher_id', params.teacher_id)
  if (params?.campus_id) searchParams.set('campus_id', params.campus_id)
  if (params?.day_of_week !== undefined) searchParams.set('day_of_week', params.day_of_week.toString())
  if (params?.page) searchParams.set('page', params.page.toString())
  if (params?.limit) searchParams.set('limit', params.limit.toString())

  const qs = searchParams.toString()
  return apiRequest<DiaryEntry[]>(`/class-diary${qs ? `?${qs}` : ''}`)
}

export async function getDiaryReadView(params: {
  diary_date: string
  section_id?: string
  teacher_id?: string
  campus_id?: string
}): Promise<ApiResponse<DiaryEntry[]>> {
  const searchParams = new URLSearchParams()
  searchParams.set('diary_date', params.diary_date)
  if (params.section_id) searchParams.set('section_id', params.section_id)
  if (params.teacher_id) searchParams.set('teacher_id', params.teacher_id)
  if (params.campus_id) searchParams.set('campus_id', params.campus_id)

  return apiRequest<DiaryEntry[]>(`/class-diary/read?${searchParams.toString()}`)
}

export async function getDiaryEntryById(id: string): Promise<ApiResponse<DiaryEntry>> {
  return apiRequest<DiaryEntry>(`/class-diary/${id}`)
}

export async function createDiaryEntry(dto: CreateDiaryEntryDTO): Promise<ApiResponse<DiaryEntry>> {
  return apiRequest<DiaryEntry>('/class-diary', {
    method: 'POST',
    body: JSON.stringify(dto),
  })
}

export async function updateDiaryEntry(id: string, dto: UpdateDiaryEntryDTO): Promise<ApiResponse<DiaryEntry>> {
  return apiRequest<DiaryEntry>(`/class-diary/${id}`, {
    method: 'PUT',
    body: JSON.stringify(dto),
  })
}

export async function deleteDiaryEntry(id: string): Promise<ApiResponse<void>> {
  return apiRequest<void>(`/class-diary/${id}`, { method: 'DELETE' })
}

export async function toggleComments(id: string, enable: boolean): Promise<ApiResponse<DiaryEntry>> {
  return apiRequest<DiaryEntry>(`/class-diary/${id}/toggle-comments`, {
    method: 'PATCH',
    body: JSON.stringify({ enable }),
  })
}

export async function addDiaryFile(
  entryId: string,
  file: { file_name: string; file_url: string; file_type?: string; file_size?: number }
): Promise<ApiResponse<DiaryFile>> {
  return apiRequest<DiaryFile>(`/class-diary/${entryId}/files`, {
    method: 'POST',
    body: JSON.stringify(file),
  })
}

export async function removeDiaryFile(fileId: string): Promise<ApiResponse<void>> {
  return apiRequest<void>(`/class-diary/files/${fileId}`, { method: 'DELETE' })
}

export async function addDiaryComment(
  entryId: string,
  content: string
): Promise<ApiResponse<DiaryComment>> {
  return apiRequest<DiaryComment>(`/class-diary/${entryId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  })
}

export async function deleteDiaryComment(commentId: string): Promise<ApiResponse<void>> {
  return apiRequest<void>(`/class-diary/comments/${commentId}`, { method: 'DELETE' })
}
