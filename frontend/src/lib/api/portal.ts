import { getAuthToken } from './schools'

const API_URL = process.env.NEXT_PUBLIC_API_URL

// ================================================================
// TYPES
// ================================================================

export interface PortalNote {
  id: string
  school_id: string
  campus_id: string
  title: string
  content: string
  content_type: 'markdown' | 'html' | 'plain'
  file_url?: string
  file_name?: string
  embed_link?: string
  sort_order: number
  is_pinned: boolean
  visible_from?: string
  visible_until?: string
  visible_to_roles: string[]
  visible_to_grade_ids?: string[]
  visible_to_user_ids?: string[]
  created_by?: string
  created_at: string
  updated_at: string
  is_active: boolean
}

export interface CreateNoteDTO {
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

export interface PortalPoll {
  id: string
  school_id: string
  campus_id: string
  title: string
  description?: string
  sort_order: number
  show_results: boolean
  visible_from?: string
  visible_until?: string
  visible_to_roles: string[]
  visible_to_grade_ids?: string[]
  visible_to_user_ids?: string[]
  created_by?: string
  created_at: string
  updated_at: string
  is_active: boolean
  questions?: PollQuestion[]
  has_voted?: boolean
}

export interface PollQuestion {
  id: string
  poll_id: string
  question_text: string
  question_type: 'single_choice' | 'multiple_choice' | 'text' | 'rating'
  options: (string | { value: string; label: string; icon?: string })[]  // JSONB flexible
  is_required: boolean
  sort_order: number
  created_at: string
}

export interface CreatePollDTO {
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
  questions?: CreateQuestionDTO[]
}

export interface CreateQuestionDTO {
  question_text: string
  question_type?: 'single_choice' | 'multiple_choice' | 'text' | 'rating'
  options?: (string | { value: string; label: string; icon?: string })[]  // JSONB flexible
  is_required?: boolean
  sort_order?: number
}

export interface PollResponseDTO {
  question_id: string
  answer_text?: string
  selected_options?: (string | { value: string })[]  // JSONB flexible
  rating_value?: number
}

export interface PollResults {
  poll: { id: string; title: string }
  total_responses: number
  questions: Array<{
    question_id: string
    question_text: string
    question_type: string
    total_responses: number
    options?: Array<{ option: string; count: number }>
    average_rating?: number
    text_responses?: string[]
  }>
}

// ================================================================
// HELPER
// ================================================================

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getAuthToken()
  
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    },
  })

  const data = await response.json()

  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Request failed')
  }

  return data
}

// ================================================================
// NOTES API
// ================================================================

export async function getNotes(options: {
  campus_id?: string
  include_inactive?: boolean
  page?: number
  limit?: number
} = {}) {
  const params = new URLSearchParams()
  if (options.campus_id) params.append('campus_id', options.campus_id)
  if (options.include_inactive) params.append('include_inactive', 'true')
  if (options.page) params.append('page', options.page.toString())
  if (options.limit) params.append('limit', options.limit.toString())

  const query = params.toString()
  const data = await apiRequest<{ notes: PortalNote[]; pagination: any }>(
    `/api/portal/notes${query ? `?${query}` : ''}`
  )

  return data
}

export async function getNoteById(id: string) {
  const data = await apiRequest<{ data: PortalNote }>(`/api/portal/notes/${id}`)
  return data.data
}

export async function createNote(dto: CreateNoteDTO) {
  const data = await apiRequest<{ data: PortalNote }>('/api/portal/notes', {
    method: 'POST',
    body: JSON.stringify(dto),
  })
  return data.data
}

export async function updateNote(id: string, dto: Partial<CreateNoteDTO>) {
  const data = await apiRequest<{ data: PortalNote }>(`/api/portal/notes/${id}`, {
    method: 'PUT',
    body: JSON.stringify(dto),
  })
  return data.data
}

export async function deleteNote(id: string) {
  await apiRequest(`/api/portal/notes/${id}`, { method: 'DELETE' })
}

// ================================================================
// POLLS API
// ================================================================

export async function getPolls(options: {
  campus_id?: string
  include_inactive?: boolean
  page?: number
  limit?: number
} = {}) {
  const params = new URLSearchParams()
  if (options.campus_id) params.append('campus_id', options.campus_id)
  if (options.include_inactive) params.append('include_inactive', 'true')
  if (options.page) params.append('page', options.page.toString())
  if (options.limit) params.append('limit', options.limit.toString())

  const query = params.toString()
  const data = await apiRequest<{ polls: PortalPoll[]; pagination: any }>(
    `/api/portal/polls${query ? `?${query}` : ''}`
  )

  return data
}

export async function getPollById(id: string) {
  const data = await apiRequest<{ data: PortalPoll }>(`/api/portal/polls/${id}`)
  return data.data
}

export async function createPoll(dto: CreatePollDTO) {
  const data = await apiRequest<{ data: PortalPoll }>('/api/portal/polls', {
    method: 'POST',
    body: JSON.stringify(dto),
  })
  return data.data
}

export async function updatePoll(id: string, dto: Partial<CreatePollDTO>) {
  const data = await apiRequest<{ data: PortalPoll }>(`/api/portal/polls/${id}`, {
    method: 'PUT',
    body: JSON.stringify(dto),
  })
  return data.data
}

export async function deletePoll(id: string) {
  await apiRequest(`/api/portal/polls/${id}`, { method: 'DELETE' })
}

export async function getPollResults(pollId: string) {
  const data = await apiRequest<{ data: PollResults }>(`/api/portal/polls/${pollId}/results`)
  return data.data
}

export async function submitPollResponses(pollId: string, responses: PollResponseDTO[]) {
  await apiRequest(`/api/portal/polls/${pollId}/respond`, {
    method: 'POST',
    body: JSON.stringify({ responses }),
  })
}

export async function getMyPollResponses(pollId: string) {
  const data = await apiRequest<{ data: any[] }>(`/api/portal/polls/${pollId}/my-responses`)
  return data.data
}

// ================================================================
// QUESTIONS API (Admin)
// ================================================================

export async function addPollQuestion(pollId: string, dto: CreateQuestionDTO) {
  const data = await apiRequest<{ data: PollQuestion }>(
    `/api/portal/polls/${pollId}/questions`,
    {
      method: 'POST',
      body: JSON.stringify(dto),
    }
  )
  return data.data
}

export async function updatePollQuestion(questionId: string, dto: Partial<CreateQuestionDTO>) {
  const data = await apiRequest<{ data: PollQuestion }>(
    `/api/portal/questions/${questionId}`,
    {
      method: 'PUT',
      body: JSON.stringify(dto),
    }
  )
  return data.data
}

export async function deletePollQuestion(questionId: string) {
  await apiRequest(`/api/portal/questions/${questionId}`, { method: 'DELETE' })
}
