// Speed Reading (plugin), admin side: dashboard stats, leaderboard, reading texts with quizzes,
// student session logs. Same endpoints as frontend/src/lib/api/speed-reading.ts; router:
// speed-reading.routes.ts. Like the web, the dashboard and leaderboard use the main school id and
// texts are listed/created for the selected campus.
import type { ApiClient } from '../../client'
import { qs } from '../../query'

export interface ReadingQuizQuestion {
  id?: string
  text_id?: string
  question: string
  option_a: string
  option_b: string
  option_c?: string | null
  option_d?: string | null
  correct_ans: 'a' | 'b' | 'c' | 'd'
}

export interface ReadingText {
  id: string
  school_id: string
  title: string
  language: 'en' | 'ar'
  content: string
  word_count: number
  grade_level_id?: string | null
  grade_level_name?: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  quiz_questions?: ReadingQuizQuestion[]
}

export interface ReadingTextInput {
  title: string
  language: 'en' | 'ar'
  content: string
  grade_level_id: string | null
  quiz_questions: Omit<ReadingQuizQuestion, 'id' | 'text_id'>[]
}

export interface ReadingLeaderboardEntry {
  student_id: string
  first_name: string
  last_name: string
  profile_photo_url?: string | null
  total_points: number
  best_wpm: number
  sessions: number
}

export interface ReadingWordResult {
  word: string
  status: 'correct' | 'incorrect' | 'unread'
}

export interface ReadingSessionLog {
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
  word_results: ReadingWordResult[] | null
  created_at: string
  text_title?: string | null
  student_name?: string | null
  text_content?: string | null
  text_language?: string | null
}

export interface ReadingDashboardStats {
  total_texts: number
  total_sessions: number
  top_wpm_this_week: number
}

/** Reader badge by best WPM (web: getBadge). */
export function readingBadge(bestWpm: number): { label: string; emoji: string } {
  if (bestWpm >= 150) return { label: 'Jahbaz Reader', emoji: '🏆' }
  if (bestWpm >= 100) return { label: 'Silver Reader', emoji: '🥈' }
  if (bestWpm >= 50) return { label: 'Bronze Reader', emoji: '🥉' }
  return { label: 'Beginner', emoji: '📖' }
}

export function adminSpeedReadingApi(api: ApiClient) {
  const id = (v: string) => encodeURIComponent(v)
  return {
    dashboard: (schoolId?: string) => api.get<ReadingDashboardStats>(`/speed-reading/dashboard-stats${qs({ school_id: schoolId })}`),
    leaderboard: (schoolId?: string) => api.get<ReadingLeaderboardEntry[]>(`/speed-reading/leaderboard${qs({ school_id: schoolId })}`),
    texts: (schoolId?: string, campusId?: string) => api.get<ReadingText[]>(`/speed-reading/texts${qs({ school_id: schoolId, campus_id: campusId })}`),
    text: (textId: string) => api.get<ReadingText>(`/speed-reading/texts/${id(textId)}`),
    createText: (input: ReadingTextInput, campusId?: string) => api.post<ReadingText>('/speed-reading/texts', { ...input, campus_id: campusId }),
    updateText: (textId: string, input: ReadingTextInput) => api.put<ReadingText>(`/speed-reading/texts/${id(textId)}`, input),
    deleteText: (textId: string) => api.del<void>(`/speed-reading/texts/${id(textId)}`),
    logs: (p: { page?: number; limit?: number; student_id?: string; text_id?: string; date_from?: string; date_to?: string } = {}) =>
      api.get<ReadingSessionLog[]>(`/speed-reading/logs${qs({ ...p, page: p.page ?? 1, limit: p.limit ?? 20 })}`),
    log: (logId: string) => api.get<ReadingSessionLog>(`/speed-reading/logs/${id(logId)}`),
    /** Student: own totals and recent sessions. */
    myStats: () => api.get<{ total_points: number; best_wpm: number; sessions: number }>('/speed-reading/stats/me'),
    /** Student: own sessions, paged. */
    myLogs: (page = 1, limit = 20) => api.get<ReadingSessionLog[]>(`/speed-reading/logs/student/me${qs({ page, limit })}`),
    /** Student: save a finished session. */
    submitLog: (body: { text_id: string; target_wpm: number; correct_words: number; incorrect_words: number; accuracy_percentage: number; comprehension_bonus: boolean; grading_mode: 'voice' | 'manual'; audio_url?: string; word_results?: ReadingWordResult[] }) =>
      api.post<{ points_earned: number }>('/speed-reading/logs', body),
    deleteLog: (logId: string) => api.del<void>(`/speed-reading/logs/${id(logId)}`),
  }
}
