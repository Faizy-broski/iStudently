import { API_URL } from '@/config/api'

export interface ReadingText {
  id: string
  school_id: string
  title: string
  language: 'en' | 'ar'
  content: string
  word_count: number
  grade_level_id?: string | null
  grade_level_name?: string | null
  created_by?: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  quiz_questions?: QuizQuestion[]
}

export interface QuizQuestion {
  id: string
  text_id: string
  question: string
  option_a: string
  option_b: string
  option_c?: string | null
  option_d?: string | null
  correct_ans: 'a' | 'b' | 'c' | 'd'
}

export interface LeaderboardEntry {
  student_id: string
  first_name: string
  last_name: string
  profile_photo_url?: string | null
  total_points: number
  best_wpm: number
  sessions: number
}

export interface StudentStats {
  total_points: number
  best_wpm: number
  sessions: number
  recent_logs: ReadingLog[]
}

export interface WordResult {
  word: string
  status: 'correct' | 'incorrect' | 'unread'
}

export interface ReadingLog {
  id: string
  student_id: string
  text_id: string
  target_wpm: number
  correct_words: number
  incorrect_words: number
  accuracy_percentage: number
  points_earned: number
  comprehension_bonus: boolean
  grading_mode: 'voice' | 'manual'
  audio_url: string | null
  word_results: WordResult[] | null
  created_at: string
  // Joined (populated in list/detail views)
  text_title?: string
  student_name?: string
}

export interface SessionLog extends ReadingLog {
  school_id: string
  text_content?: string
  text_language?: string
}

export interface DashboardStats {
  total_texts: number
  total_sessions: number
  top_wpm_this_week: number
}

export interface SubmitLogPayload {
  text_id: string
  target_wpm: number
  correct_words: number
  incorrect_words: number
  accuracy_percentage: number
  comprehension_bonus: boolean
  grading_mode: 'voice' | 'manual'
  audio_url?: string
  word_results?: WordResult[]
}

interface PaginatedResponse<T> {
  success: boolean
  data?: T[]
  pagination?: { total: number; page: number; limit: number; totalPages: number }
  error?: string
}

interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
}

export function getBadge(bestWpm: number): { label: string; emoji: string } {
  if (bestWpm >= 150) return { label: 'Jahbaz Reader', emoji: '🏆' }
  if (bestWpm >= 100) return { label: 'Silver Reader', emoji: '🥈' }
  if (bestWpm >= 50)  return { label: 'Bronze Reader', emoji: '🥉' }
  return { label: 'Beginner', emoji: '📖' }
}

export async function getTexts(token: string, schoolId?: string, gradeLevelId?: string, campusId?: string): Promise<ApiResponse<ReadingText[]>> {
  const p = new URLSearchParams()
  if (schoolId) p.set('school_id', schoolId)
  if (gradeLevelId) p.set('grade_level_id', gradeLevelId)
  if (campusId) p.set('campus_id', campusId)
  const qs = p.toString() ? `?${p.toString()}` : ''
  const res = await fetch(`${API_URL}/speed-reading/texts${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return res.json()
}

export async function getText(id: string, token: string): Promise<ApiResponse<ReadingText>> {
  const res = await fetch(`${API_URL}/speed-reading/texts/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return res.json()
}

export async function createText(
  payload: { title: string; language: 'en' | 'ar'; content: string; grade_level_id?: string | null; quiz_questions?: Omit<QuizQuestion, 'id' | 'text_id'>[]; campus_id?: string | null },
  token: string
): Promise<ApiResponse<ReadingText>> {
  const res = await fetch(`${API_URL}/speed-reading/texts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  })
  return res.json()
}

export async function updateText(
  id: string,
  payload: { title?: string; language?: 'en' | 'ar'; content?: string; grade_level_id?: string | null; quiz_questions?: Omit<QuizQuestion, 'id' | 'text_id'>[] },
  token: string
): Promise<ApiResponse<ReadingText>> {
  const res = await fetch(`${API_URL}/speed-reading/texts/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  })
  return res.json()
}

export async function deleteText(id: string, token: string): Promise<ApiResponse> {
  const res = await fetch(`${API_URL}/speed-reading/texts/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  return res.json()
}

export async function submitLog(payload: SubmitLogPayload, token: string): Promise<ApiResponse<{ points_earned: number }>> {
  const res = await fetch(`${API_URL}/speed-reading/logs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  })
  return res.json()
}

export async function getLeaderboard(token: string, schoolId?: string): Promise<ApiResponse<LeaderboardEntry[]>> {
  const params = schoolId ? `?school_id=${schoolId}` : ''
  const res = await fetch(`${API_URL}/speed-reading/leaderboard${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return res.json()
}

export async function getMyStats(token: string): Promise<ApiResponse<StudentStats>> {
  const res = await fetch(`${API_URL}/speed-reading/stats/me`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return res.json()
}

export async function getDashboardStats(token: string, schoolId?: string): Promise<ApiResponse<DashboardStats>> {
  const params = schoolId ? `?school_id=${schoolId}` : ''
  const res = await fetch(`${API_URL}/speed-reading/dashboard-stats${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return res.json()
}

// ─── Session Log Review ───────────────────────────────────────────────────────

export async function getSessionLog(id: string, token: string): Promise<ApiResponse<SessionLog>> {
  const res = await fetch(`${API_URL}/speed-reading/logs/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return res.json()
}

export async function listSessionLogs(
  token: string,
  params?: { student_id?: string; text_id?: string; date_from?: string; date_to?: string; page?: number; limit?: number }
): Promise<PaginatedResponse<SessionLog>> {
  const p = new URLSearchParams()
  if (params?.student_id) p.set('student_id', params.student_id)
  if (params?.text_id) p.set('text_id', params.text_id)
  if (params?.date_from) p.set('date_from', params.date_from)
  if (params?.date_to) p.set('date_to', params.date_to)
  if (params?.page) p.set('page', String(params.page))
  if (params?.limit) p.set('limit', String(params.limit))
  const qs = p.toString() ? `?${p.toString()}` : ''
  const res = await fetch(`${API_URL}/speed-reading/logs${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return res.json()
}

export async function deleteSessionLog(id: string, token: string): Promise<ApiResponse> {
  const res = await fetch(`${API_URL}/speed-reading/logs/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  return res.json()
}

export async function getStudentLogs(
  token: string,
  params?: { page?: number; limit?: number }
): Promise<PaginatedResponse<SessionLog>> {
  const p = new URLSearchParams()
  if (params?.page) p.set('page', String(params.page))
  if (params?.limit) p.set('limit', String(params.limit))
  const qs = p.toString() ? `?${p.toString()}` : ''
  const res = await fetch(`${API_URL}/speed-reading/logs/student/me${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return res.json()
}
