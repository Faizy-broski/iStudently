// Portal notes and polls (school admin). Same endpoints as frontend/src/lib/api/portal.ts;
// router: portal.routes.ts. The list endpoints spread their payload ({ notes } / { polls }) next to
// `success`, so the client moves it into `data`.
import type { ApiClient } from '../../client'
import { qs } from '../../query'
import type { ApiResponse } from '../../types'

export interface PortalNote {
  id: string
  campus_id: string
  title: string
  content: string
  content_type: 'markdown' | 'html' | 'plain'
  file_url?: string | null
  file_name?: string | null
  embed_link?: string | null
  sort_order: number
  is_pinned: boolean
  visible_from?: string | null
  visible_until?: string | null
  visible_to_roles: string[]
  visible_to_grade_ids?: string[] | null
  visible_to_user_ids?: string[] | null
  is_active: boolean
}

export interface PortalNoteInput {
  title: string
  content: string
  content_type?: 'markdown' | 'html' | 'plain'
  file_url?: string
  file_name?: string
  embed_link?: string
  sort_order?: number
  is_pinned?: boolean
  visible_from?: string
  visible_until?: string
  visible_to_roles?: string[]
  visible_to_grade_ids?: string[]
  visible_to_user_ids?: string[]
  campus_id: string
}

export type PollQuestionType = 'single_choice' | 'multiple_choice' | 'text' | 'rating'

export interface PortalPollQuestion {
  id: string
  question_text: string
  question_type: PollQuestionType
  options: (string | { value: string; label: string })[]
  is_required: boolean
  sort_order: number
}

export interface PortalPoll {
  id: string
  campus_id: string
  title: string
  description?: string | null
  sort_order: number
  show_results: boolean
  visible_from?: string | null
  visible_until?: string | null
  visible_to_roles: string[]
  visible_to_grade_ids?: string[] | null
  visible_to_user_ids?: string[] | null
  is_active: boolean
  questions?: PortalPollQuestion[]
}

export interface PortalPollInput {
  title: string
  description?: string
  sort_order?: number
  show_results?: boolean
  visible_from?: string
  visible_until?: string
  visible_to_roles?: string[]
  visible_to_grade_ids?: string[]
  visible_to_user_ids?: string[]
  campus_id: string
  questions?: { question_text: string; question_type?: PollQuestionType; options?: string[]; is_required?: boolean; sort_order?: number }[]
}

export interface PortalPollResults {
  poll: { id: string; title: string }
  total_responses: number
  questions: {
    question_id: string
    question_text: string
    question_type: string
    total_responses: number
    options?: { option: string; count: number }[]
    average_rating?: number
    rating_distribution?: { rating: number; count: number }[]
    text_responses?: string[]
  }[]
}

const moveInto = <T>(r: ApiResponse<unknown>, field: string): ApiResponse<T> => ({ ...r, data: (r as unknown as Record<string, T>)[field] })

export function adminPortalApi(api: ApiClient) {
  const id = (v: string) => encodeURIComponent(v)
  return {
    notes: async (campusId: string) => moveInto<PortalNote[]>(await api.get(`/portal/notes${qs({ campus_id: campusId, include_inactive: 'true' })}`), 'notes'),
    createNote: (body: PortalNoteInput) => api.post<PortalNote>('/portal/notes', body),
    updateNote: (noteId: string, body: Partial<PortalNoteInput>) => api.put<PortalNote>(`/portal/notes/${id(noteId)}`, body),
    deleteNote: (noteId: string) => api.del<void>(`/portal/notes/${id(noteId)}`),

    polls: async (campusId: string) => moveInto<PortalPoll[]>(await api.get(`/portal/polls${qs({ campus_id: campusId, include_inactive: 'true' })}`), 'polls'),
    createPoll: (body: PortalPollInput) => api.post<PortalPoll>('/portal/polls', body),
    updatePoll: (pollId: string, body: Partial<PortalPollInput>) => api.put<PortalPoll>(`/portal/polls/${id(pollId)}`, body),
    deletePoll: (pollId: string) => api.del<void>(`/portal/polls/${id(pollId)}`),
    pollResults: (pollId: string) => api.get<PortalPollResults>(`/portal/polls/${id(pollId)}/results`),
  }
}
