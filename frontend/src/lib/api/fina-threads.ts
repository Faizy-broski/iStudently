import { getAuthToken } from './schools'
import { handleSessionExpiry } from '@/context/AuthContext'
import { API_URL } from '@/config/api'
import { getImpersonationHeaders } from './abortable-fetch'
import { withCampusParam } from './fina-campus'

interface ApiResponse<T = unknown> {
  data: T | null
  error: string | null
}

interface ProfileRef { first_name: string | null; last_name: string | null }

export interface FinaThread {
  id: string
  school_id: string
  teacher_id: string
  guardian_id: string
  student_id: string
  created_at: string
  last_message_at: string
  teacher?: ProfileRef | null
  guardian?: ProfileRef | null
  student?: { id: string; profile: ProfileRef | null } | null
}

export interface FinaMessage {
  id: string
  thread_id: string
  sender_id: string
  body: string
  created_at: string
  read_at: string | null
  sender?: { first_name: string | null; last_name: string | null; role: string } | null
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  try {
    const token = await getAuthToken()
    const res = await fetch(`${API_URL}${withCampusParam(path)}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...getImpersonationHeaders(),
        ...options.headers,
      },
    })
    if (res.status === 401) {
      await handleSessionExpiry()
      return { data: null, error: 'Session expired' }
    }
    const json = await res.json()
    if (!res.ok) return { data: null, error: json.error || 'Request failed' }
    return json
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Network error' }
  }
}

export const listMyThreads = () => apiFetch<FinaThread[]>('/fina/threads')

export const listMyWardsForThreads = () => apiFetch<{ id: string; sectionId: string | null; name: string }[]>('/fina/threads/my-wards')

export const listMyStudentsForThreads = () => apiFetch<{ id: string; sectionId: string | null; name: string }[]>('/fina/threads/my-students')

export const listContactsForStudent = (studentId: string) => apiFetch<{ id: string; name: string }[]>(`/fina/threads/contacts/${studentId}`)

export const getOrCreateThread = (input: { teacher_profile_id?: string; guardian_profile_id?: string; student_id: string }) =>
  apiFetch<FinaThread>('/fina/threads', { method: 'POST', body: JSON.stringify(input) })

export const listMessages = (threadId: string) => apiFetch<FinaMessage[]>(`/fina/threads/${threadId}/messages`)

export const sendMessage = (threadId: string, body: string) =>
  apiFetch<FinaMessage>(`/fina/threads/${threadId}/messages`, { method: 'POST', body: JSON.stringify({ body }) })
