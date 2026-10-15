// Teacher Programs: an admin works a teacher's gradebook, final grades and anomalous grades on
// their behalf. Same endpoints as frontend/src/lib/api/grades.ts (getStudentsForGrades,
// getFinalGrades, saveFinalGrade, getGradebookMatrix, bulkEnterGrades, createGradebookAssignment,
// getAnomalousGradesAdvanced); routers: student, final-grades, gradebook.
import type { ApiClient } from '../../client'
import { qs } from '../../query'

export interface TpFinalGrade {
  id: string
  student_id: string
  course_period_id: string
  marking_period_id: string
  percent_grade?: number | null
  letter_grade?: string | null
  comment?: string | null
}

export interface GradebookMatrix {
  assignment_types: { id: string; title: string; final_grade_percent: number; sort_order: number }[]
  assignments: { id: string; title: string; points: number; due_date: string | null; assignment_type_id: string; is_active: boolean; is_extra_credit: boolean }[]
  students: { id: string; student_number: string; first_name: string; last_name: string }[]
  grades: { id: string; student_id: string; assignment_id: string; course_period_id: string; points: number | null; letter_grade: string | null; comment: string | null }[]
}

export interface AnomalousGradeRow {
  student_id: string
  student_name: string
  course_title: string
  assignment_title: string
  points_received: number
  points_possible: number
  anomaly_type: 'Missing' | 'Excused' | 'Negative' | 'Exceeds Max' | 'Extra Credit'
}

export function adminTeacherProgramsApi(api: ApiClient) {
  return {
    finalGrades: (coursePeriodId: string, markingPeriodId: string) => api.get<TpFinalGrade[]>(`/final-grades${qs({ course_period_id: coursePeriodId, marking_period_id: markingPeriodId })}`),
    saveFinalGrade: (input: { student_id: string; course_period_id: string; marking_period_id: string; percent_grade: number | null; letter_grade: string | null; comment: string | null; is_override: boolean }) =>
      api.post<TpFinalGrade>('/final-grades', input),
    /** Fill final grades from the gradebook average (web: InputFinalGrades "Get Gradebook Grades"). */
    importFromGradebook: (input: { course_period_id: string; marking_period_id: string; academic_year_id: string; override_existing: boolean }) =>
      api.post<unknown>('/final-grades/import-gradebook', input),
    gradebook: (coursePeriodId: string) => api.get<GradebookMatrix>(`/gradebook/view${qs({ course_period_id: coursePeriodId })}`),
    bulkEnterGrades: (input: { assignment_id: string; course_period_id: string; grades: { student_id: string; points: number | null }[] }) => api.post<unknown>('/gradebook/grades/bulk', input),
    createAssignment: (input: { title: string; course_period_id: string; assignment_type_id: string; points: number; due_date: string | null }) => api.post<unknown>('/gradebook/assignments', input),
    anomalous: (p: { staff_id: string; include_all_courses?: boolean; include_inactive?: boolean; missing?: boolean; negative?: boolean; exceed_max?: boolean; extra_credit?: boolean }) =>
      api.get<AnomalousGradeRow[]>(
        `/gradebook/anomalous${qs({
          staff_id: p.staff_id,
          include_all_courses: p.include_all_courses ? 'true' : undefined,
          include_inactive: p.include_inactive ? 'true' : undefined,
          missing: p.missing === undefined ? undefined : String(p.missing),
          negative: p.negative === undefined ? undefined : String(p.negative),
          exceed_max: p.exceed_max === undefined ? undefined : String(p.exceed_max),
          extra_credit: p.extra_credit === undefined ? undefined : String(p.extra_credit),
          advanced: 'true',
        })}`,
      ),
  }
}
