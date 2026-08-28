import { getAuthToken } from './schools'
import { handleSessionExpiry } from '@/context/AuthContext'
import { API_URL } from '@/config/api'
import { getImpersonationHeaders } from './abortable-fetch'

interface ApiResponse<T = unknown> {
  data: T | null
  error: string | null
}

export type CoachingNoteType = 'strength' | 'area_for_growth' | 'action_item'
export type CoachingNoteStatus = 'open' | 'in_progress' | 'completed'

export interface CoachingNote {
  id: string
  evaluation_id: string
  note_type: CoachingNoteType
  content: string
  target_date: string | null
  status: CoachingNoteStatus
  created_at: string
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  try {
    const token = await getAuthToken()
    const res = await fetch(`${API_URL}${path}`, {
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

export const listNotes = (evaluationId: string) =>
  apiFetch<CoachingNote[]>(`/inspection-coaching/evaluation/${evaluationId}`)

export const addNote = (evaluationId: string, input: { note_type: CoachingNoteType; content: string; target_date?: string }) =>
  apiFetch<CoachingNote>(`/inspection-coaching/evaluation/${evaluationId}`, { method: 'POST', body: JSON.stringify(input) })

export const updateNote = (id: string, input: { content?: string; target_date?: string | null; status?: CoachingNoteStatus }) =>
  apiFetch<CoachingNote>(`/inspection-coaching/${id}`, { method: 'PUT', body: JSON.stringify(input) })

export const deleteNote = (id: string) =>
  apiFetch<null>(`/inspection-coaching/${id}`, { method: 'DELETE' })
