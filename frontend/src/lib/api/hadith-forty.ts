import { API_URL } from '@/config/api'

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

export type MemorizationState = 'new' | 'learning' | 'mastered'
export type HadithCategory = 'aqidah' | 'ibadah' | 'akhlaq' | 'muamalat' | 'usrah' | 'ilm' | 'zuhd'

export interface HadithProgress {
  hadithNumber: number
  repetitions: number
  state: MemorizationState
  box: number
  dueOn: string | null
  lastReviewedOn: string | null
  isFavorite: boolean
  note: string
}

export interface ActivityPoint {
  date: string
  repetitions: number
  goalMet: boolean
}

export interface ModuleSettings {
  dailyGoal: number
  sessionCap: number
}

export interface ProgressStats {
  mastered: number
  learning: number
  total: number
  totalRepetitions: number
  dueToday: number
  masteryPercent: number
}

export interface ModuleState {
  progress: HadithProgress[]
  settings: ModuleSettings
  stats: ProgressStats
  activity: ActivityPoint[]
  streak: number
  session: number[]
  today: string
}

export type QuizQuestionKind = 'fill-blank' | 'narrator' | 'topic' | 'source'

export interface ClientQuizQuestion {
  kind: QuizQuestionKind
  body: string
  options: string[]
}

export interface QuizGrade {
  score: number
  total: number
  passed: boolean
  correctness: boolean[]
  answerIndexes: number[]
}

export interface ClassProgressRow {
  profileId: string
  firstName: string
  lastName: string
  mastered: number
  learning: number
  totalRepetitions: number
  dueToday: number
}

// requireHadithFortyEnabled resolves campus_id from req.query/body first, and
// only falls back to req.profile?.campus_id — which is null for admin/staff
// profiles not pinned to one campus. If the plugin was activated on a
// specific campus's school_settings row (not the org-wide one), every call
// must carry that campus_id explicitly or an admin gets a 403 even after
// activating it — the same bug already hit and fixed for Miqat/Qirtasi.
function withCampus(path: string, campusId?: string): string {
  if (!campusId) return path
  return `${path}${path.includes('?') ? '&' : '?'}campus_id=${campusId}`
}

async function authedFetch(path: string, token: string, init?: RequestInit): Promise<Response> {
  return fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(init?.headers || {}) },
  })
}

export interface Narrator {
  id: string
  name: string
  bio: string
}

export interface Hadith {
  number: number
  title: string
  text: string
  narratorId: string
  source: string
  category: HadithCategory
}

export interface ContentPayload {
  hadiths: Hadith[]
  narrators: Record<string, Narrator>
  categories: HadithCategory[]
}

export async function getContent(token: string, campusId?: string): Promise<ApiResponse<ContentPayload>> {
  const res = await authedFetch(withCampus('/hadith-forty/content', campusId), token)
  return res.json()
}

export async function getState(token: string, campusId?: string): Promise<ApiResponse<ModuleState>> {
  const res = await authedFetch(withCampus('/hadith-forty/state', campusId), token)
  return res.json()
}

export async function recordRepetition(hadithNumber: number, token: string, delta?: number, campusId?: string): Promise<ApiResponse<HadithProgress>> {
  const res = await authedFetch(withCampus('/hadith-forty/repetition', campusId), token, { method: 'POST', body: JSON.stringify({ hadithNumber, delta }) })
  return res.json()
}

export async function recordReview(hadithNumber: number, outcome: 'pass' | 'fail', token: string, campusId?: string): Promise<ApiResponse<HadithProgress>> {
  const res = await authedFetch(withCampus('/hadith-forty/review', campusId), token, { method: 'POST', body: JSON.stringify({ hadithNumber, outcome }) })
  return res.json()
}

export async function updateFlags(
  input: { hadithNumber: number; isFavorite?: boolean; state?: MemorizationState; note?: string },
  token: string,
  campusId?: string
): Promise<ApiResponse<HadithProgress>> {
  const res = await authedFetch(withCampus('/hadith-forty/flags', campusId), token, { method: 'POST', body: JSON.stringify(input) })
  return res.json()
}

export async function saveSettings(input: Partial<ModuleSettings>, token: string, campusId?: string): Promise<ApiResponse<ModuleSettings>> {
  const res = await authedFetch(withCampus('/hadith-forty/settings', campusId), token, { method: 'POST', body: JSON.stringify(input) })
  return res.json()
}

export interface StartedQuiz {
  attemptId: string
  hadithNumber: number
  questions: ClientQuizQuestion[]
}

export async function startQuiz(hadithNumber: number, token: string, campusId?: string): Promise<ApiResponse<StartedQuiz>> {
  const res = await authedFetch(withCampus('/hadith-forty/quiz/start', campusId), token, { method: 'POST', body: JSON.stringify({ hadithNumber }) })
  return res.json()
}

export async function submitQuiz(
  attemptId: string,
  answers: number[],
  token: string,
  campusId?: string
): Promise<ApiResponse<{ grade: QuizGrade; progress: HadithProgress }>> {
  const res = await authedFetch(withCampus('/hadith-forty/quiz/submit', campusId), token, { method: 'POST', body: JSON.stringify({ attemptId, answers }) })
  return res.json()
}

export async function getClassSummary(token: string, campusId?: string): Promise<ApiResponse<ClassProgressRow[]>> {
  const res = await authedFetch(withCampus('/hadith-forty/class/summary', campusId), token)
  return res.json()
}
