import { API_URL } from '@/config/api'
import { getAuthToken } from './schools'
import { handleSessionExpiry } from '@/context/AuthContext'

export interface ReadingLog {
  id: string
  student_id: string
  school_id: string
  book_id: string | null
  book_title: string
  book_author: string | null
  session_date: string
  pages_read: number | null
  notes: string | null
  audio_file_path: string | null
  audio_url: string | null
  created_at: string
  updated_at: string
  student?: { first_name: string; last_name: string; profile_image: string | null }
}

export interface CreateReadingLogDTO {
  book_id?: string | null
  book_title: string
  book_author?: string | null
  session_date?: string | null
  pages_read?: number | null
  notes?: string | null
  audio_file_path?: string | null
}

interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

async function authFetch<T>(
  endpoint: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  try {
    const token = await getAuthToken()
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options?.headers as Record<string, string> | undefined),
      },
    })

    if (response.status === 401) {
      handleSessionExpiry()
      return { success: false, error: 'Session expired' }
    }

    const data = await response.json()
    if (!response.ok) return { success: false, error: data?.error ?? 'Request failed' }
    return data
  } catch {
    return { success: false, error: 'Network error' }
  }
}

export async function createReadingLog(
  dto: CreateReadingLogDTO
): Promise<ApiResponse<ReadingLog>> {
  return authFetch<ReadingLog>('/reading-logs', {
    method: 'POST',
    body: JSON.stringify(dto),
  })
}

export async function attachReadingLogAudio(
  logId: string,
  audioFilePath: string
): Promise<ApiResponse<void>> {
  return authFetch<void>(`/reading-logs/${logId}/audio`, {
    method: 'PATCH',
    body: JSON.stringify({ audio_file_path: audioFilePath }),
  })
}

export async function getMyReadingLogs(): Promise<ApiResponse<ReadingLog[]>> {
  return authFetch<ReadingLog[]>('/reading-logs/my')
}

export async function getSchoolReadingLogs(
  studentId?: string
): Promise<ApiResponse<ReadingLog[]>> {
  const qs = studentId ? `?student_id=${encodeURIComponent(studentId)}` : ''
  return authFetch<ReadingLog[]>(`/reading-logs${qs}`)
}
