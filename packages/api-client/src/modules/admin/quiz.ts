// Quiz / question bank (backend/src/routes/quiz.routes.ts).
// Endpoints use requireTeacher — admin and super_admin also satisfy this.
import type { ApiClient } from '../../client'
import { qs } from '../../query'
import type { UploadFile } from '../../types'

// ── Types ─────────────────────────────────────────────────────────────────────

export type AdminQuestionType = 'select' | 'multiple' | 'gap' | 'text' | 'textarea' | 'matching' | 'anatomy_label'
export type DifficultyLevel = 'easy' | 'medium' | 'hard'

export interface AdminQuizCategory {
  id: string
  school_id: string
  campus_id?: string | null
  title: string
  sort_order: number
}

export interface AdminQuizQuestion {
  id: string
  school_id: string
  campus_id?: string | null
  category_id?: string | null
  title: string
  type: AdminQuestionType
  description?: string | null
  answer?: string | null
  allocated_marks?: number | null
  difficulty_level?: DifficultyLevel | null
  grade_level_id?: string | null
  subject_id?: string | null
  chapter_id?: string | null
  image_url?: string | null
  correct_answer?: unknown
  blank_lines_count?: number | null
  sort_order: number
  created_at: string
  category?: { title: string } | null
  creator?: { first_name: string; last_name: string } | null
}

export interface AdminQuiz {
  id: string
  school_id: string
  campus_id?: string | null
  assignment_id?: string | null
  course_period_id?: string | null
  academic_year_id?: string | null
  title: string
  description?: string | null
  show_correct_answers: boolean
  shuffle: boolean
  subject_id?: string | null
  grade_level_id?: string | null
  generation_mode?: 'manual' | 'blueprint' | null
  variant_count?: number | null
  blueprint_easy?: number | null
  blueprint_medium?: number | null
  blueprint_hard?: number | null
  assigned_student_ids?: string[] | null
  start_time?: string | null
  lockout_minutes?: number | null
  created_at: string
  assignment?: { title: string; points: number; due_date?: string } | null
  course_period?: { id: string } | null
  creator?: { first_name: string; last_name: string } | null
  question_count?: number | null
}

export interface AdminQuizConfig {
  id: string
  school_id: string
  campus_id?: string | null
  teacher_edit_own_only: boolean
}

export interface AdminAnswerBreakdownRow {
  question_id: string
  question_title: string
  question_type: AdminQuestionType
  map_id: string
  total_answers: number
  correct_answers: number
  correct_pct: number
  total_points: number
  avg_points: number
}

export interface QuizListParams {
  campus_id?: string | null
  course_period_id?: string
  academic_year_id?: string
  /** Only quizzes made by this creator (the teacher page passes its staff id). */
  created_by?: string
  limit?: number
  offset?: number
}

export interface QuestionListParams {
  campus_id?: string | null
  school_id?: string
  category_id?: string
  subject_id?: string
  grade_level_id?: string
  chapter_id?: string
  difficulty?: DifficultyLevel
  search?: string
  created_by?: string
  limit?: number
  offset?: number
}

export interface CreateQuizInput {
  title: string
  description?: string | null
  assignment_id?: string | null
  course_period_id?: string | null
  academic_year_id?: string | null
  campus_id?: string | null
  show_correct_answers?: boolean
  shuffle?: boolean
  subject_id?: string | null
  grade_level_id?: string | null
  assigned_student_ids?: string[]
  generation_mode?: 'manual' | 'blueprint'
  variant_count?: number
  blueprint_easy?: number
  blueprint_medium?: number
  blueprint_hard?: number
  start_time?: string | null
  lockout_minutes?: number | null
  /** The teacher page records its staff id here (web: created_by: staffId). */
  created_by?: string | null
}

export interface QuestionInput {
  title: string
  type: AdminQuestionType
  description?: string | null
  answer?: string | null
  correct_answer?: unknown
  category_id?: string | null
  grade_level_id?: string | null
  subject_id?: string | null
  difficulty_level?: DifficultyLevel
  sort_order?: number
  campus_id?: string | null
}

export interface QuizQuestionMapRow {
  id: string
  quiz_id: string
  question_id: string
  points: number
  sort_order: number
  question?: AdminQuizQuestion | null
}

/** An AI-drafted question to review before saving (web: DraftQuestion). */
export interface DraftQuestion {
  title: string
  type: AdminQuestionType
  description: string
  answer: string
  difficulty_level: DifficultyLevel
}

export interface QuizAssignmentOption {
  id: string
  title: string
  points?: number | null
  due_date?: string | null
  course_period_id?: string | null
}

// ── Factory ────────────────────────────────────────────────────────────────────

export function adminQuizApi(api: ApiClient) {
  return {
    // ── Quizzes ───────────────────────────────────────────────────────────────
    quizzes: (params: QuizListParams & { search?: string }) => {
      const q = qs({ campus_id: params.campus_id ?? undefined, search: params.search || undefined, course_period_id: params.course_period_id, academic_year_id: params.academic_year_id, created_by: params.created_by, limit: params.limit !== undefined ? String(params.limit) : undefined, offset: params.offset !== undefined ? String(params.offset) : undefined })
      return api.get<AdminQuiz[]>(`/quiz${q}`)
    },
    quiz: (id: string) => api.get<AdminQuiz>(`/quiz/${id}`),
    createQuiz: (input: CreateQuizInput) => api.post<AdminQuiz>('/quiz', input),
    updateQuiz: (id: string, input: Partial<CreateQuizInput>) => api.put<AdminQuiz>(`/quiz/${id}`, input),
    deleteQuiz: (id: string) => api.del<void>(`/quiz/${id}`),
    copyQuiz: (id: string, targetAcademicYearId: string | null, targetAssignmentId?: string) =>
      api.post<AdminQuiz>(`/quiz/${id}/copy`, { target_academic_year_id: targetAcademicYearId, target_assignment_id: targetAssignmentId }),
    /** Mark roster students who never started as absent (0). */
    closeQuiz: (id: string) => api.post<{ marked: number }>(`/quiz/${id}/close`, {}),
    quizQuestions: (quizId: string) => api.get<QuizQuestionMapRow[]>(`/quiz/${quizId}/questions`),
    addQuestionToQuiz: (quizId: string, questionId: string, points: number, sortOrder: number) =>
      api.post<QuizQuestionMapRow>(`/quiz/${quizId}/questions`, { question_id: questionId, points, sort_order: sortOrder }),
    updateQuizQuestion: (quizId: string, mapId: string, input: { points?: number; sort_order?: number }) => api.put<QuizQuestionMapRow>(`/quiz/${quizId}/questions/${mapId}`, input),
    removeQuestionFromQuiz: (quizId: string, mapId: string) => api.del<void>(`/quiz/${quizId}/questions/${mapId}`),
    quizAssignments: (campusId?: string | null, coursePeriodId?: string) =>
      api.get<QuizAssignmentOption[]>(`/quiz/helpers/assignments${qs({ campus_id: campusId ?? undefined, course_period_id: coursePeriodId })}`),
    /** Course periods a quiz can be tied to (teacher quiz page "Class" picker). */
    coursePeriodsForQuiz: (schoolId: string, campusId?: string | null) =>
      api.get<{ id: string; courses?: { title: string } | null }[]>(`/quiz/helpers/course-periods${qs({ school_id: schoolId, campus_id: campusId ?? undefined })}`),
    coursePeriodContext: (coursePeriodId: string) =>
      api.get<{ subject_id: string | null; grade_level_id: string | null; section_id: string | null }>(`/quiz/helpers/course-period-context${qs({ course_period_id: coursePeriodId })}`),

    // ── Question bank ─────────────────────────────────────────────────────────
    questions: (params: QuestionListParams) => {
      const q = qs({ school_id: params.school_id, campus_id: params.campus_id ?? undefined, category_id: params.category_id, subject_id: params.subject_id, grade_level_id: params.grade_level_id, chapter_id: params.chapter_id, difficulty: params.difficulty, search: params.search, created_by: params.created_by, limit: params.limit !== undefined ? String(params.limit) : undefined, offset: params.offset !== undefined ? String(params.offset) : undefined })
      return api.get<AdminQuizQuestion[]>(`/quiz/questions${q}`)
    },
    question: (id: string) => api.get<AdminQuizQuestion>(`/quiz/questions/${id}`),
    chapters: (subjectId: string, schoolId?: string) => api.get<{ id: string; title: string; order_index: number; is_active: boolean }[]>(`/quiz/chapters${qs({ subject_id: subjectId, school_id: schoolId })}`),
    /** Draft questions from a PDF, DOCX or image with AI (can take up to two minutes). */
    extractQuestions: (file: UploadFile, opts: { allowedTypes: AdminQuestionType[]; gradeLevelId?: string; subjectId?: string; chapterId?: string }) => {
      const form = new FormData()
      form.append('file', file as Blob)
      form.append('allowed_types', JSON.stringify(opts.allowedTypes))
      if (opts.gradeLevelId) form.append('grade_level_id', opts.gradeLevelId)
      if (opts.subjectId) form.append('subject_id', opts.subjectId)
      if (opts.chapterId) form.append('chapter_id', opts.chapterId)
      return api.post<DraftQuestion[]>('/quiz/questions/extract', form, { timeout: 130_000 })
    },
    /** Draft `count` (1-50) questions with AI for a grade/subject/chapter and optional instructions. */
    generateQuestions: (input: { grade_level_id?: string | null; subject_id?: string | null; chapter_ids?: string[]; count: number; allowed_types: AdminQuestionType[]; prompt?: string }) =>
      api.post<DraftQuestion[]>('/quiz/questions/generate', input, { timeout: 130_000 }),
    bulkCreateQuestions: (questions: (QuestionInput & { chapter_id?: string | null })[]) => api.post<AdminQuizQuestion[]>('/quiz/questions/bulk', { questions }),
    createQuestion: (input: QuestionInput) => api.post<AdminQuizQuestion>('/quiz/questions', input),
    updateQuestion: (id: string, input: Partial<QuestionInput>) => api.put<AdminQuizQuestion>(`/quiz/questions/${id}`, input),
    deleteQuestion: (id: string) => api.del<void>(`/quiz/questions/${id}`),

    // ── Categories ────────────────────────────────────────────────────────────
    categories: (campusId?: string | null) =>
      api.get<AdminQuizCategory[]>(`/quiz/categories${qs({ campus_id: campusId ?? undefined })}`),
    createCategory: (input: { title: string; sort_order: number; campus_id?: string | null }) => api.post<AdminQuizCategory>('/quiz/categories', input),
    updateCategory: (id: string, input: { title: string; sort_order: number }) => api.put<AdminQuizCategory>(`/quiz/categories/${id}`, input),
    deleteCategory: (id: string) => api.del<void>(`/quiz/categories/${id}`),

    // ── Answer breakdown ──────────────────────────────────────────────────────
    answerBreakdown: (quizId: string) =>
      api.get<AdminAnswerBreakdownRow[]>(`/quiz/${quizId}/answer-breakdown`),

    // ── Config ────────────────────────────────────────────────────────────────
    config: (campusId?: string | null) =>
      api.get<AdminQuizConfig>(`/quiz/config${qs({ campus_id: campusId ?? undefined })}`),
    updateConfig: (input: { campus_id?: string; teacher_edit_own_only: boolean }) =>
      api.put<AdminQuizConfig>('/quiz/config', input),
  }
}
