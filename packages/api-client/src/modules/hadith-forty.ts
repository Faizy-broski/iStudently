// Hadith Forty (plugin): the 42 hadiths, the caller's own memorization progress (spaced review,
// repetitions, favorites, notes, quiz) and the class summary for staff. Same endpoints as
// frontend/src/lib/api/hadith-forty.ts; routers: hadith-forty/{progress,quiz,class,content}.routes.ts.
// Every call carries campus_id so the plugin gate reads the selected campus's settings.
import type { ApiClient } from '../client'
import { qs } from '../query'

export type HadithState = 'new' | 'learning' | 'mastered'
export type HadithCategory = 'aqidah' | 'ibadah' | 'akhlaq' | 'muamalat' | 'usrah' | 'ilm' | 'zuhd'

export interface HadithProgress {
  hadithNumber: number
  repetitions: number
  state: HadithState
  box: number
  dueOn: string | null
  lastReviewedOn: string | null
  isFavorite: boolean
  note: string
}

export interface HadithModuleState {
  progress: HadithProgress[]
  settings: { dailyGoal: number; sessionCap: number }
  stats: { mastered: number; learning: number; total: number; totalRepetitions: number; dueToday: number; masteryPercent: number }
  activity: { date: string; repetitions: number; goalMet: boolean }[]
  streak: number
  session: number[]
  today: string
}

export interface HadithContent {
  hadiths: { number: number; title: string; text: string; narratorId: string; source: string; category: HadithCategory }[]
  narrators: Record<string, { id: string; name: string; bio: string }>
  categories: HadithCategory[]
}

export interface HadithQuizQuestion {
  kind: 'fill-blank' | 'narrator' | 'topic' | 'source'
  body: string
  options: string[]
}

export interface HadithQuizGrade {
  score: number
  total: number
  passed: boolean
  correctness: boolean[]
  answerIndexes: number[]
}

export interface HadithClassRow {
  profileId: string
  firstName: string
  lastName: string
  mastered: number
  learning: number
  totalRepetitions: number
  dueToday: number
}

export function hadithFortyApi(api: ApiClient) {
  const c = (campusId?: string) => qs({ campus_id: campusId })
  return {
    content: (campusId?: string) => api.get<HadithContent>(`/hadith-forty/content${c(campusId)}`),
    state: (campusId?: string) => api.get<HadithModuleState>(`/hadith-forty/state${c(campusId)}`),
    repetition: (hadithNumber: number, campusId?: string) => api.post<HadithProgress>(`/hadith-forty/repetition${c(campusId)}`, { hadithNumber }),
    review: (hadithNumber: number, outcome: 'pass' | 'fail', campusId?: string) => api.post<HadithProgress>(`/hadith-forty/review${c(campusId)}`, { hadithNumber, outcome }),
    flags: (input: { hadithNumber: number; isFavorite?: boolean; state?: HadithState; note?: string }, campusId?: string) => api.post<HadithProgress>(`/hadith-forty/flags${c(campusId)}`, input),
    saveSettings: (input: { dailyGoal?: number; sessionCap?: number }, campusId?: string) => api.post<{ dailyGoal: number; sessionCap: number }>(`/hadith-forty/settings${c(campusId)}`, input),
    startQuiz: (hadithNumber: number, campusId?: string) =>
      api.post<{ attemptId: string; hadithNumber: number; questions: HadithQuizQuestion[] }>(`/hadith-forty/quiz/start${c(campusId)}`, { hadithNumber }),
    submitQuiz: (attemptId: string, answers: number[], campusId?: string) =>
      api.post<{ grade: HadithQuizGrade; progress: HadithProgress }>(`/hadith-forty/quiz/submit${c(campusId)}`, { attemptId, answers }),
    classSummary: (campusId?: string) => api.get<HadithClassRow[]>(`/hadith-forty/class/summary${c(campusId)}`),
  }
}
