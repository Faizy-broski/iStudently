// Student quiz flow, ported from frontend/src/lib/api/quiz.ts (types copied). Teacher/admin quiz
// authoring stays on the web for now. The quiz routes reply { data, error } (no `success` field).
//
// Answers are hidden server-side until the student has submitted and the quiz shows answers
// (backend/src/services/quiz-student-view.ts): options come without "*" markers, matching rights are
// shuffled per student (submit the displayed indices; the server maps them back), gap text has
// blanks as ____, anatomy questions carry only the organ. One submission per student (409 after).
import type { ApiClient } from '../client'

export type QuestionType = 'select' | 'multiple' | 'gap' | 'text' | 'textarea' | 'matching' | 'anatomy_label'

export interface QuizQuestionForStudent {
  id: string
  title: string
  type: QuestionType
  description?: string | null
  /** Options (select/multiple), "left::right" lines (matching), text with ____ (gap). No answers before reveal. */
  answer?: string | null
  correct_answer?: unknown
  image_url?: string | null
  sort_order: number
  category?: { title: string } | null
}

export interface QuizQuestionMap {
  id: string
  quiz_id: string
  question_id: string
  points: number
  sort_order: number
  created_at: string
  question?: QuizQuestionForStudent | null
}

export interface QuizAccessState {
  unlocked: boolean
  locked_out: boolean
  start_time: string | null
  lockout_at: string | null
  now: string
}

export interface QuizAnswer {
  id: string
  quiz_question_map_id: string
  student_id: string
  answer?: string | null
  points?: number | null
  created_at: string
  updated_at: string
}

/** Row from GET /quiz/student/quizzes (backend quiz.service getStudentQuizzes). */
export interface StudentQuizListItem {
  id: string
  title: string
  description?: string | null
  show_correct_answers: boolean
  shuffle: boolean
  created_at: string
  course_period_id?: string | null
  assignment_id?: string | null
  academic_year_id?: string | null
  subject_id?: string | null
  grade_level_id?: string | null
  assigned_student_ids?: string[]
  generation_mode?: string
  variant_count?: number
  start_time?: string | null
  lockout_minutes?: number | null
  assignment?: { id: string; title: string; points: number; due_date?: string; assigned_date?: string } | null
  /** The student has already submitted. */
  submitted?: boolean
}

export function quizApi(api: ApiClient) {
  const base = '/quiz'
  const id = (v: string) => encodeURIComponent(v)
  return {
    /** The signed-in student's quizzes (identity from the token). */
    getStudentQuizzes: () => api.get<StudentQuizListItem[]>(`${base}/student/quizzes`),
    /** Starts the quiz: 423 with error "not_unlocked" / "locked_out" outside the time window. */
    getStudentQuizForm: (quizId: string) => api.get<QuizQuestionMap[]>(`${base}/student/${id(quizId)}/questions`),
    /** Cheap poll for the countdown. */
    getStudentQuizStatus: (quizId: string) => api.get<QuizAccessState>(`${base}/student/${id(quizId)}/status`),
    /** studentId must be the signed-in student's own id (enforced by the backend). */
    getSubmission: (quizId: string, studentId: string) =>
      api.get<{ maps: QuizQuestionMap[]; answerMap: Record<string, QuizAnswer> }>(
        `${base}/${id(quizId)}/submissions/${id(studentId)}`,
      ),
    /** The backend takes the student from the token; no student_id needed. 409 if already submitted. */
    submit: (quizId: string, answers: { quiz_question_map_id: string; answer: string }[]) =>
      api.post<QuizAnswer[]>(`${base}/${id(quizId)}/submit`, { answers }),
  }
}

export type QuizApi = ReturnType<typeof quizApi>
