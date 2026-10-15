// Past marking periods and a student's grades in them (backend: history-marking-periods.routes.ts,
// historical-grades.routes.ts; web: /admin/grades/history-marking-periods, /admin/grades/historical-grades).
import type { ApiClient } from '../../client'
import { qs } from '../../query'

export type HistoryMPType = 'year' | 'semester' | 'quarter'
export const HISTORY_MP_TYPES: HistoryMPType[] = ['year', 'semester', 'quarter']

export interface HistoryMarkingPeriod {
  id: string
  campus_id?: string | null
  mp_type: HistoryMPType
  name: string
  short_name?: string | null
  post_end_date?: string | null
  school_year: string
}

export type HistoryMarkingPeriodInput = Pick<HistoryMarkingPeriod, 'mp_type' | 'name' | 'short_name' | 'post_end_date' | 'school_year'>

export interface HistoricalGradeMP {
  mp_id: string
  mp_name: string
  posted: string
  school_year: string
  grade_level?: string | null
  weighted_gpa: number
  weighted_cum: number
  unweighted_gpa: number
  unweighted_cum: number
}

export interface HistoricalGradeEntry {
  id: string
  course_period_id?: string | null
  course_title: string
  grade_letter?: string | null
  grade_percent?: number | null
  gp_scale?: number | null
  unweighted_gp?: number | null
  credit_attempted?: number | null
  credit_earned?: number | null
  comment?: string | null
  class_rank?: number | null
}

export type HistoricalGradeInput = Omit<HistoricalGradeEntry, 'id'>

/** School years "YYYY-YYYY+1" from two years ahead back twenty years (web: getSchoolYearOptions). */
export function historySchoolYears(now = new Date().getFullYear()): string[] {
  const out: string[] = []
  for (let y = now + 2; y >= now - 20; y--) out.push(`${y}-${y + 1}`)
  return out
}

export function adminHistoricalGradesApi(api: ApiClient) {
  const id = (v: string) => encodeURIComponent(v)
  return {
    historyMarkingPeriods: (campusId?: string | null) => api.get<HistoryMarkingPeriod[]>(`/history-marking-periods${qs({ campus_id: campusId ?? undefined })}`),
    createHistoryMarkingPeriod: (input: HistoryMarkingPeriodInput, campusId?: string | null) =>
      api.post<HistoryMarkingPeriod>('/history-marking-periods', { ...input, campus_id: campusId ?? null }),
    updateHistoryMarkingPeriod: (mpId: string, input: Partial<HistoryMarkingPeriodInput>) => api.put<HistoryMarkingPeriod>(`/history-marking-periods/${id(mpId)}`, input),
    deleteHistoryMarkingPeriod: (mpId: string) => api.del<void>(`/history-marking-periods/${id(mpId)}`),

    studentMarkingPeriods: (studentId: string) => api.get<HistoricalGradeMP[]>(`/historical-grades/student/${id(studentId)}/marking-periods`),
    addStudentMarkingPeriod: (studentId: string, mpId: string, gradeLevel?: string | null) =>
      api.post<unknown>(`/historical-grades/student/${id(studentId)}/marking-periods`, { marking_period_id: mpId, grade_level: gradeLevel || null }),
    updateStudentMarkingPeriod: (studentId: string, mpId: string, gradeLevel: string | null) =>
      api.put<unknown>(`/historical-grades/student/${id(studentId)}/marking-periods/${id(mpId)}`, { grade_level: gradeLevel }),
    removeStudentMarkingPeriod: (studentId: string, mpId: string) => api.del<void>(`/historical-grades/student/${id(studentId)}/marking-periods/${id(mpId)}`),

    historicalGrades: (studentId: string, mpId: string) => api.get<HistoricalGradeEntry[]>(`/historical-grades/student/${id(studentId)}${qs({ marking_period_id: mpId })}`),
    createHistoricalGrade: (studentId: string, mpId: string, input: HistoricalGradeInput) =>
      api.post<HistoricalGradeEntry>(`/historical-grades/student/${id(studentId)}`, { ...input, marking_period_id: mpId }),
    updateHistoricalGrade: (gradeId: string, input: Partial<HistoricalGradeInput>) => api.put<HistoricalGradeEntry>(`/historical-grades/${id(gradeId)}`, input),
    deleteHistoricalGrade: (gradeId: string) => api.del<void>(`/historical-grades/${id(gradeId)}`),
  }
}
