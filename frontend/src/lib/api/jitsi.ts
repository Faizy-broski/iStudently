import { getAuthToken } from './schools'
import { handleSessionExpiry } from '@/context/AuthContext'
import { API_URL } from '@/config/api'
import { getImpersonationHeaders } from './abortable-fetch'

interface ApiResponse<T = unknown> {
  data: T | null
  error: string | null
}

// ============================================================================
// TYPES
// ============================================================================

export interface JitsiRoom {
  id: string
  school_id: string
  campus_id: string
  owner_profile_id: string
  room_name: string
  title: string
  description?: string | null
  password?: string | null
  start_audio_only: boolean
  created_at: string
  updated_at: string
  /** Only present on getRoom() — resolved school-wide Jitsi domain, null = meet.jit.si */
  jitsi_domain?: string | null
}

export interface CreateRoomInput {
  title: string
  description?: string
  password?: string
  start_audio_only?: boolean
  /** Required for admin (not auto-resolved server-side); optional for teacher. */
  campus_id?: string | null
}

export type UpdateRoomInput = Partial<CreateRoomInput>

export interface WhiteboardSnapshot {
  room_id: string
  scene_data: Record<string, unknown>
  updated_at: string
  updated_by?: string | null
}

export type PollQuestionType = 'single_choice' | 'multiple_choice' | 'text' | 'rating'
export type PollStatus = 'draft' | 'open' | 'closed'

export interface JitsiRoomPoll {
  id: string
  room_id: string
  question_text: string
  question_type: PollQuestionType
  options: unknown[]
  status: PollStatus
  launched_at?: string | null
  closed_at?: string | null
  created_at: string
}

export interface PollResult {
  poll: JitsiRoomPoll
  total_responses: number
  tally: Array<{ option: string; count: number }>
}

// ============================================================================
// HELPERS
// ============================================================================

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  try {
    const token = await getAuthToken()
    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...getImpersonationHeaders(),
        ...(options.headers || {}),
      },
    })
    if (res.status === 401) {
      handleSessionExpiry()
      return { data: null, error: 'Session expired' }
    }
    const json = await res.json()
    if (!res.ok) return { data: null, error: json.error || 'Request failed' }
    return json
  } catch (e: any) {
    return { data: null, error: e.message }
  }
}

// ============================================================================
// ROOMS
// ============================================================================

export const createRoom = (data: CreateRoomInput) =>
  apiFetch<JitsiRoom>('/jitsi/rooms', { method: 'POST', body: JSON.stringify(data) })

export const updateRoom = (id: string, data: UpdateRoomInput) =>
  apiFetch<JitsiRoom>(`/jitsi/rooms/${id}`, { method: 'PUT', body: JSON.stringify(data) })

export const deleteRoom = (id: string) =>
  apiFetch<null>(`/jitsi/rooms/${id}`, { method: 'DELETE' })

export const getRoom = (id: string) => apiFetch<JitsiRoom>(`/jitsi/rooms/${id}`)

export const listMyRooms = () => apiFetch<JitsiRoom[]>('/jitsi/rooms/mine')

// ============================================================================
// WHITEBOARD
// ============================================================================

export const getWhiteboardSnapshot = (roomId: string) =>
  apiFetch<WhiteboardSnapshot | null>(`/jitsi/rooms/${roomId}/whiteboard`)

export const saveWhiteboardSnapshot = (roomId: string, sceneData: Record<string, unknown>) =>
  apiFetch<WhiteboardSnapshot>(`/jitsi/rooms/${roomId}/whiteboard`, {
    method: 'PUT',
    body: JSON.stringify({ scene_data: sceneData }),
  })

// ============================================================================
// POLLS
// ============================================================================

export const listPollsForRoom = (roomId: string) =>
  apiFetch<JitsiRoomPoll[]>(`/jitsi/polls/room/${roomId}`)

export const launchPoll = (
  roomId: string,
  data: { question_text: string; question_type?: PollQuestionType; options?: unknown[] }
) =>
  apiFetch<JitsiRoomPoll>(`/jitsi/polls/room/${roomId}`, { method: 'POST', body: JSON.stringify(data) })

export const closePoll = (pollId: string) =>
  apiFetch<JitsiRoomPoll>(`/jitsi/polls/${pollId}/close`, { method: 'POST' })

export const submitPollResponse = (
  pollId: string,
  data: { selected_options?: unknown[]; answer_text?: string; rating_value?: number }
) =>
  apiFetch<null>(`/jitsi/polls/${pollId}/responses`, { method: 'POST', body: JSON.stringify(data) })

export const getPollResults = (pollId: string) =>
  apiFetch<PollResult>(`/jitsi/polls/${pollId}/results`)
