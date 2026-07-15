import { getAuthToken } from './schools'
import { handleSessionExpiry } from '@/context/AuthContext'
import { API_URL } from '@/config/api'
import { getImpersonationHeaders } from './abortable-fetch'

interface ApiResponse<T = unknown> {
  data: T | null
  error: string | null
}

// ============================================================================
// TYPES
// ============================================================================

export type QuestionType = 'select' | 'multiple' | 'gap' | 'text' | 'textarea' | 'matching'

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  select: 'Select One (Radio)',
  multiple: 'Select Multiple (Checkboxes)',
  gap: 'Gap Fill',
  text: 'Short Text',
  textarea: 'Long Text (Essay)',
  matching: 'Drag & Drop Matching',
}

export type DifficultyLevel = 'easy' | 'medium' | 'hard'

export type QuizGenerationMode = 'manual' | 'blueprint'

export const DIFFICULTY_LABELS: Record<DifficultyLevel, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
}

export interface QuizCategory {
  id: string
  school_id: string
  campus_id?: string | null
  title: string
  sort_order: number
  created_at: string
  updated_at: string
}

export interface QuizQuestion {
  id: string
  school_id: string
  campus_id?: string | null
  category_id?: string | null
  created_by?: string | null
  title: string
  type: QuestionType
  description?: string | null
  answer?: string | null
  sort_order: number
  grade_level_id?: string | null
  subject_id?: string | null
  difficulty_level?: DifficultyLevel
  created_at: string
  updated_at: string
  category?: { title: string } | null
  creator?: { first_name: string; last_name: string } | null
}

export interface Quiz {
  id: string
  school_id: string
  campus_id?: string | null
  assignment_id?: string | null
  course_period_id?: string | null
  created_by?: string | null
  academic_year_id?: string | null
  title: string
  description?: string | null
  show_correct_answers: boolean
  shuffle: boolean
  // categorization / auto-filter + blueprint source
  subject_id?: string | null
  grade_level_id?: string | null
  // targeted assignment (empty = whole section)
  assigned_student_ids?: string[]
  // multi-form blueprint
  generation_mode?: QuizGenerationMode
  variant_count?: number
  variants_generated_at?: string | null
  blueprint_easy?: number
  blueprint_medium?: number
  blueprint_hard?: number
  // strict live scheduling
  start_time?: string | null
  lockout_minutes?: number | null
  created_at: string
  updated_at: string
  assignment?: { title: string; points: number; due_date?: string; assigned_date?: string } | null
  course_period?: { id: string } | null
  creator?: { first_name: string; last_name: string } | null
  question_count?: number
}

export interface QuizAccessState {
  unlocked: boolean
  locked_out: boolean
  start_time: string | null
  lockout_at: string | null
  now: string
}

export interface CoursePeriodContext {
  subject_id: string | null
  grade_level_id: string | null
  section_id: string | null
}

export interface QuizQuestionMap {
  id: string
  quiz_id: string
  question_id: string
  points: number
  sort_order: number
  created_at: string
  question?: QuizQuestion | null
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

export interface AnswerBreakdownRow {
  question_id: string
  question_title: string
  question_type: QuestionType
  map_id: string
  total_answers: number
  correct_answers: number
  correct_pct: number
  total_points: number
  avg_points: number
}

export interface QuizConfig {
  id: string
  school_id: string
  campus_id?: string | null
  teacher_edit_own_only: boolean
  created_at: string
  updated_at: string
}

export interface GradebookAssignment {
  id: string
  title: string
  points: number
  due_date?: string | null
  assigned_date?: string | null
  course_period_id: string
  assignment_type_id: string
}

// ============================================================================
// HELPERS
// ============================================================================

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  try {
    const token = await getAuthToken()
    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...getImpersonationHeaders(),
        ...(options.headers || {}),
      },
    })
    if (res.status === 401) {
      handleSessionExpiry()
      return { data: null, error: 'Session expired' }
    }
    const json = await res.json()
    if (!res.ok) return { data: null, error: json.error || 'Request failed' }
    return json
  } catch (e: any) {
    return { data: null, error: e.message }
  }
}

function qs(params: Record<string, string | undefined | null>): string {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== '') p.set(k, v)
  }
  const s = p.toString()
  return s ? `?${s}` : ''
}

// ============================================================================
// CATEGORIES
// ============================================================================

export const getCategories = (schoolId: string, campusId?: string | null) =>
  apiFetch<QuizCategory[]>(`/quiz/categories${qs({ school_id: schoolId, campus_id: campusId })}`)

export const createCategory = (data: Omit<QuizCategory, 'id' | 'created_at' | 'updated_at'>) =>
  apiFetch<QuizCategory>('/quiz/categories', { method: 'POST', body: JSON.stringify(data) })

export const updateCategory = (id: string, data: Partial<Pick<QuizCategory, 'title' | 'sort_order'>>) =>
  apiFetch<QuizCategory>(`/quiz/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) })

export const deleteCategory = (id: string) =>
  apiFetch<null>(`/quiz/categories/${id}`, { method: 'DELETE' })

// ============================================================================
// QUESTIONS
// ============================================================================

export const getQuestions = (
  schoolId: string,
  filters?: {
    campusId?: string | null
    categoryId?: string
    search?: string
    createdBy?: string
    gradeLevelId?: string
    subjectId?: string
    difficulty?: DifficultyLevel
  }
) =>
  apiFetch<QuizQuestion[]>(
    `/quiz/questions${qs({
      school_id: schoolId,
      campus_id: filters?.campusId,
      category_id: filters?.categoryId,
      search: filters?.search,
      created_by: filters?.createdBy,
      grade_level_id: filters?.gradeLevelId,
      subject_id: filters?.subjectId,
      difficulty: filters?.difficulty,
    })}`
  )

export const getQuestion = (id: string) => apiFetch<QuizQuestion>(`/quiz/questions/${id}`)

export const createQuestion = (data: Omit<QuizQuestion, 'id' | 'created_at' | 'updated_at' | 'category' | 'creator'>) =>
  apiFetch<QuizQuestion>('/quiz/questions', { method: 'POST', body: JSON.stringify(data) })

export const updateQuestion = (
  id: string,
  data: Partial<Pick<QuizQuestion, 'title' | 'type' | 'description' | 'answer' | 'sort_order' | 'category_id' | 'grade_level_id' | 'subject_id' | 'difficulty_level'>>
) =>
  apiFetch<QuizQuestion>(`/quiz/questions/${id}`, { method: 'PUT', body: JSON.stringify(data) })

export const deleteQuestion = (id: string) =>
  apiFetch<null>(`/quiz/questions/${id}`, { method: 'DELETE' })

// ============================================================================
// QUIZZES
// ============================================================================

export const getQuizzes = (
  schoolId: string,
  filters?: { campusId?: string | null; coursePeriodId?: string; academicYearId?: string; createdBy?: string; search?: string }
) =>
  apiFetch<Quiz[]>(
    `/quiz${qs({ school_id: schoolId, campus_id: filters?.campusId, course_period_id: filters?.coursePeriodId, academic_year_id: filters?.academicYearId, created_by: filters?.createdBy, search: filters?.search })}`
  )

export const getQuiz = (id: string) => apiFetch<Quiz>(`/quiz/${id}`)

export const createQuiz = (data: Omit<Quiz, 'id' | 'created_at' | 'updated_at' | 'assignment' | 'course_period' | 'creator' | 'question_count'>) =>
  apiFetch<Quiz>('/quiz', { method: 'POST', body: JSON.stringify(data) })

export const updateQuiz = (
  id: string,
  data: Partial<Pick<Quiz,
    | 'title' | 'description' | 'assignment_id' | 'course_period_id' | 'academic_year_id'
    | 'show_correct_answers' | 'shuffle' | 'subject_id' | 'grade_level_id'
    | 'assigned_student_ids' | 'generation_mode' | 'variant_count'
    | 'blueprint_easy' | 'blueprint_medium' | 'blueprint_hard'
    | 'start_time' | 'lockout_minutes'
  >>
) =>
  apiFetch<Quiz>(`/quiz/${id}`, { method: 'PUT', body: JSON.stringify(data) })

export const deleteQuiz = (id: string) => apiFetch<null>(`/quiz/${id}`, { method: 'DELETE' })

export const closeQuizAndSyncAbsentees = (quizId: string) =>
  apiFetch<{ marked: number }>(`/quiz/${quizId}/close`, { method: 'POST' })

export const copyQuiz = (id: string, targetAcademicYearId: string, targetAssignmentId?: string) =>
  apiFetch<Quiz>(`/quiz/${id}/copy`, {
    method: 'POST',
    body: JSON.stringify({ target_academic_year_id: targetAcademicYearId, target_assignment_id: targetAssignmentId }),
  })

// ============================================================================
// QUIZ QUESTION MAP
// ============================================================================

export const getQuizQuestions = (quizId: string) =>
  apiFetch<QuizQuestionMap[]>(`/quiz/${quizId}/questions`)

export const addQuestionToQuiz = (quizId: string, questionId: string, points: number, sortOrder: number) =>
  apiFetch<QuizQuestionMap>(`/quiz/${quizId}/questions`, {
    method: 'POST',
    body: JSON.stringify({ question_id: questionId, points, sort_order: sortOrder }),
  })

export const updateQuizQuestion = (quizId: string, mapId: string, data: { points?: number; sort_order?: number }) =>
  apiFetch<QuizQuestionMap>(`/quiz/${quizId}/questions/${mapId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })

export const removeQuestionFromQuiz = (quizId: string, mapId: string) =>
  apiFetch<null>(`/quiz/${quizId}/questions/${mapId}`, { method: 'DELETE' })

// ============================================================================
// STUDENT SUBMISSION
// ============================================================================

export const getStudentSubmission = (quizId: string, studentId: string) =>
  apiFetch<{ maps: QuizQuestionMap[]; answerMap: Record<string, QuizAnswer> }>(
    `/quiz/${quizId}/submissions/${studentId}`
  )

export const submitQuiz = (quizId: string, studentId: string, answers: Array<{ quiz_question_map_id: string; answer: string }>) =>
  apiFetch<QuizAnswer[]>(`/quiz/${quizId}/submit`, {
    method: 'POST',
    body: JSON.stringify({ student_id: studentId, answers }),
  })

export const gradeAnswer = (answerId: string, points: number) =>
  apiFetch<QuizAnswer>(`/quiz/answers/${answerId}/grade`, {
    method: 'PUT',
    body: JSON.stringify({ points }),
  })

// ============================================================================
// ANSWER BREAKDOWN (Premium)
// ============================================================================

export const getAnswerBreakdown = (quizId: string) =>
  apiFetch<AnswerBreakdownRow[]>(`/quiz/${quizId}/answer-breakdown`)

// ============================================================================
// CONFIG (Premium)
// ============================================================================

export const getQuizConfig = (schoolId: string) =>
  apiFetch<QuizConfig | null>(`/quiz/config${qs({ school_id: schoolId })}`)

export const upsertQuizConfig = (data: Omit<QuizConfig, 'id' | 'created_at' | 'updated_at'>) =>
  apiFetch<QuizConfig>('/quiz/config', { method: 'PUT', body: JSON.stringify(data) })

// ============================================================================
// HELPERS
// ============================================================================

export const getAssignmentsForQuiz = (schoolId: string, campusId?: string | null, coursePeriodId?: string) =>
  apiFetch<GradebookAssignment[]>(
    `/quiz/helpers/assignments${qs({ school_id: schoolId, campus_id: campusId, course_period_id: coursePeriodId })}`
  )

export const getCoursePeriodsForQuiz = (schoolId: string, campusId?: string | null) =>
  apiFetch<Array<{ id: string; courses?: { title: string } }>>(
    `/quiz/helpers/course-periods${qs({ school_id: schoolId, campus_id: campusId })}`
  )

export const getCoursePeriodContext = (coursePeriodId: string) =>
  apiFetch<CoursePeriodContext>(
    `/quiz/helpers/course-period-context${qs({ course_period_id: coursePeriodId })}`
  )

// ============================================================================
// STUDENT: START (multi-form aware) + SCHEDULING STATUS
// ============================================================================

// Returns the student's form questions. On 423 (locked/not-yet-open), the
// response carries { locked_out } or { unlocked:false, start_time } in `error`.
export const getStudentQuizForm = (quizId: string) =>
  apiFetch<QuizQuestionMap[]>(`/quiz/student/${quizId}/questions`)

export const getStudentQuizStatus = (quizId: string) =>
  apiFetch<QuizAccessState>(`/quiz/student/${quizId}/status`)
