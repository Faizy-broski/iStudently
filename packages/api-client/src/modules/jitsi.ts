// Live classes on Jitsi: ad-hoc rooms ("My Rooms"), room details, in-call polls, the whiteboard
// snapshot, the school's Jitsi domain setting, and ending a course-bound session. Same endpoints as
// frontend/src/lib/api/jitsi.ts (+ getJitsiSettings / endOnlineClassSession); routers:
// jitsi-room.routes.ts, jitsi-room-poll.routes.ts, school-settings.routes.ts, online-class.routes.ts.
// Responses are { data, error } (the client fills in `success`).
import type { ApiClient } from '../client'
import { qs } from '../query'

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
  jitsi_domain?: string | null
  online_class_id?: string | null
  target_campus_id?: string | null
  target_grade_level_id?: string | null
  target_section_id?: string | null
  target_campus?: { name: string } | null
  target_grade_level?: { name: string } | null
  target_section?: { name: string } | null
}

export interface JitsiRoomInput {
  title: string
  description?: string
  password?: string
  start_audio_only?: boolean
  campus_id?: string | null
  target_campus_id?: string | null
  target_grade_level_id?: string | null
  target_section_id?: string | null
}

export type JitsiPollType = 'single_choice' | 'multiple_choice' | 'text' | 'rating'

export interface JitsiPoll {
  id: string
  room_id: string
  question_text: string
  question_type: JitsiPollType
  options: unknown[]
  status: 'draft' | 'open' | 'closed'
  launched_at?: string | null
  closed_at?: string | null
  created_at: string
}

export interface JitsiPollResult {
  poll: JitsiPoll
  total_responses: number
  tally: { option: string; count: number }[]
}

/** The school's Jitsi host, or meet.jit.si when unset/invalid (web: JitsiRoomEmbed resolveDomain). */
export function jitsiDomain(domain?: string | null): string {
  const d = (domain ?? '').trim()
  if (!d || !d.includes('.') || d.split('.').some((s) => !s)) return 'meet.jit.si'
  return d
}

export function jitsiApi(api: ApiClient) {
  const id = (v: string) => encodeURIComponent(v)
  return {
    myRooms: () => api.get<JitsiRoom[]>('/jitsi/rooms/mine'),
    schoolRooms: () => api.get<JitsiRoom[]>('/jitsi/rooms/school'),
    room: (roomId: string) => api.get<JitsiRoom>(`/jitsi/rooms/${id(roomId)}`),
    createRoom: (input: JitsiRoomInput) => api.post<JitsiRoom>('/jitsi/rooms', input),
    updateRoom: (roomId: string, input: Partial<JitsiRoomInput>) => api.put<JitsiRoom>(`/jitsi/rooms/${id(roomId)}`, input),
    deleteRoom: (roomId: string) => api.del<null>(`/jitsi/rooms/${id(roomId)}`),
    polls: (roomId: string) => api.get<JitsiPoll[]>(`/jitsi/polls/room/${id(roomId)}`),
    launchPoll: (roomId: string, input: { question_text: string; question_type?: JitsiPollType; options?: unknown[] }) => api.post<JitsiPoll>(`/jitsi/polls/room/${id(roomId)}`, input),
    closePoll: (pollId: string) => api.post<JitsiPoll>(`/jitsi/polls/${id(pollId)}/close`),
    pollResults: (pollId: string) => api.get<JitsiPollResult>(`/jitsi/polls/${id(pollId)}/results`),
    /** A participant's answer to the open poll. */
    respondPoll: (pollId: string, body: { selected_options?: unknown[]; answer_text?: string; rating_value?: number }) => api.post<null>(`/jitsi/polls/${id(pollId)}/responses`, body),
    settings: (campusId?: string | null) => api.get<{ jitsi_domain: string }>(`/school-settings/jitsi${qs({ campus_id: campusId ?? undefined })}`),
    saveSettings: (settings: { jitsi_domain: string }, campusId?: string | null) => api.put<{ message: string }>(`/school-settings/jitsi${qs({ campus_id: campusId ?? undefined })}`, { ...settings, campus_id: campusId || undefined }),
    endSession: (onlineClassId: string) => api.post<unknown>(`/online-classes/${id(onlineClassId)}/end-session`),
  }
}
