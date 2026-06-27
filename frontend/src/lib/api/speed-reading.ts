import { API_URL } from '@/config/api'

export interface ReadingText {
  id: string
  school_id: string
  title: string
  language: 'en' | 'ar'
  content: string
  word_count: number
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
  created_at: string
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

export async function getTexts(token: string, schoolId?: string): Promise<ApiResponse<ReadingText[]>> {
  const params = schoolId ? `?school_id=${schoolId}` : ''
  const res = await fetch(`${API_URL}/speed-reading/texts${params}`, {
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
  payload: { title: string; language: 'en' | 'ar'; content: string; quiz_questions?: Omit<QuizQuestion, 'id' | 'text_id'>[] },
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
  payload: { title?: string; language?: 'en' | 'ar'; content?: string; quiz_questions?: Omit<QuizQuestion, 'id' | 'text_id'>[] },
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
