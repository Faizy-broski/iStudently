import { supabase } from '../config/supabase'

// ============================================================================
// TYPES
// ============================================================================

export type QuestionType = 'select' | 'multiple' | 'gap' | 'text' | 'textarea' | 'matching'

export type DifficultyLevel = 'easy' | 'medium' | 'hard'

export type QuizGenerationMode = 'manual' | 'blueprint'

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
  difficulty_level: DifficultyLevel
  created_at: string
  updated_at: string
  // joined
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
  // targeted assignment (empty array = whole section)
  assigned_student_ids?: string[]
  // multi-form blueprint
  generation_mode: QuizGenerationMode
  variant_count: number
  variants_generated_at?: string | null
  blueprint_easy: number
  blueprint_medium: number
  blueprint_hard: number
  // strict live scheduling
  start_time?: string | null
  lockout_minutes?: number | null
  created_at: string
  updated_at: string
  // joined
  assignment?: { title: string; points: number; due_date?: string; assigned_date?: string } | null
  course_period?: { title?: string } | null
  creator?: { first_name: string; last_name: string } | null
  question_count?: number
  student_count?: number
}

export interface QuizVariant {
  id: string
  quiz_id: string
  form_label: string
  created_at: string
}

export interface QuizStudentForm {
  id: string
  quiz_id: string
  student_id: string
  variant_id: string
  assigned_at: string
}

export interface QuizAccessState {
  unlocked: boolean
  locked_out: boolean
  start_time: string | null
  lockout_at: string | null
  now: string
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

export interface QuizConfig {
  id: string
  school_id: string
  campus_id?: string | null
  teacher_edit_own_only: boolean
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

// ============================================================================
// CATEGORIES
// ============================================================================

export const getCategories = async (schoolId: string, campusId?: string | null) => {
  let q = supabase
    .from('quiz_categories')
    .select('*')
    .eq('school_id', schoolId)
    .order('sort_order', { ascending: true })
    .order('title', { ascending: true })

  if (campusId) q = q.eq('campus_id', campusId)

  const { data, error } = await q
  if (error) throw error
  return data as QuizCategory[]
}

export const createCategory = async (dto: Omit<QuizCategory, 'id' | 'created_at' | 'updated_at'>) => {
  const { data, error } = await supabase.from('quiz_categories').insert(dto).select().single()
  if (error) throw error
  return data as QuizCategory
}

export const updateCategory = async (id: string, dto: Partial<Pick<QuizCategory, 'title' | 'sort_order'>>) => {
  const { data, error } = await supabase
    .from('quiz_categories')
    .update({ ...dto, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as QuizCategory
}

export const deleteCategory = async (id: string) => {
  const { error } = await supabase.from('quiz_categories').delete().eq('id', id)
  if (error) throw error
}

// ============================================================================
// QUESTIONS
// ============================================================================

export const getQuestions = async (
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
) => {
  let q = supabase
    .from('quiz_questions')
    .select(`
      *,
      category:quiz_categories(title),
      creator:profiles!quiz_questions_created_by_fkey(first_name, last_name)
    `)
    .eq('school_id', schoolId)
    .order('sort_order', { ascending: true })
    .order('title', { ascending: true })

  if (filters?.campusId) q = q.eq('campus_id', filters.campusId)
  if (filters?.categoryId) q = q.eq('category_id', filters.categoryId)
  if (filters?.createdBy) q = q.eq('created_by', filters.createdBy)
  if (filters?.gradeLevelId) q = q.eq('grade_level_id', filters.gradeLevelId)
  if (filters?.subjectId) q = q.eq('subject_id', filters.subjectId)
  if (filters?.difficulty) q = q.eq('difficulty_level', filters.difficulty)
  if (filters?.search) q = q.ilike('title', `%${filters.search}%`)

  const { data, error } = await q
  if (error) throw error
  return data as QuizQuestion[]
}

export const getQuestion = async (id: string) => {
  const { data, error } = await supabase
    .from('quiz_questions')
    .select(`
      *,
      category:quiz_categories(title),
      creator:profiles!quiz_questions_created_by_fkey(first_name, last_name)
    `)
    .eq('id', id)
    .single()
  if (error) throw error
  return data as QuizQuestion
}

export const createQuestion = async (
  dto: Omit<QuizQuestion, 'id' | 'created_at' | 'updated_at' | 'category' | 'creator'>
) => {
  const { data, error } = await supabase.from('quiz_questions').insert(dto).select().single()
  if (error) throw error
  return data as QuizQuestion
}

export const updateQuestion = async (
  id: string,
  dto: Partial<Pick<QuizQuestion, 'title' | 'type' | 'description' | 'answer' | 'sort_order' | 'category_id' | 'grade_level_id' | 'subject_id' | 'difficulty_level'>>
) => {
  const { data, error } = await supabase
    .from('quiz_questions')
    .update({ ...dto, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as QuizQuestion
}

export const deleteQuestion = async (id: string) => {
  const { error } = await supabase.from('quiz_questions').delete().eq('id', id)
  if (error) throw error
}

// ============================================================================
// QUIZZES
// ============================================================================

export const getQuizzes = async (
  schoolId: string,
  filters?: {
    campusId?: string | null
    coursePeriodId?: string
    academicYearId?: string
    createdBy?: string
    search?: string
  }
) => {
  let q = supabase
    .from('quizzes')
    .select(`
      *,
      assignment:gradebook_assignments(title, points, due_date, assigned_date),
      course_period:course_periods(id),
      creator:profiles!quizzes_created_by_fkey(first_name, last_name),
      quiz_question_map(id)
    `)
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false })

  if (filters?.campusId) q = q.eq('campus_id', filters.campusId)
  if (filters?.coursePeriodId) q = q.eq('course_period_id', filters.coursePeriodId)
  if (filters?.academicYearId) q = q.eq('academic_year_id', filters.academicYearId)
  if (filters?.createdBy) q = q.eq('created_by', filters.createdBy)
  if (filters?.search) q = q.ilike('title', `%${filters.search}%`)

  const { data, error } = await q
  if (error) throw error

  return (data || []).map((quiz: any) => ({
    ...quiz,
    question_count: quiz.quiz_question_map?.length ?? 0,
    quiz_question_map: undefined,
  })) as Quiz[]
}

export const getQuiz = async (id: string) => {
  const { data, error } = await supabase
    .from('quizzes')
    .select(`
      *,
      assignment:gradebook_assignments(title, points, due_date, assigned_date),
      course_period:course_periods(id),
      creator:profiles!quizzes_created_by_fkey(first_name, last_name)
    `)
    .eq('id', id)
    .single()
  if (error) throw error
  return data as Quiz
}

export const createQuiz = async (dto: Omit<Quiz, 'id' | 'created_at' | 'updated_at' | 'assignment' | 'course_period' | 'creator' | 'question_count' | 'student_count'>) => {
  const payload: any = { ...dto }

  // Resolve subject/grade from the selected course period when not supplied,
  // so blueprint generation + question auto-filter have them on the quiz row.
  if (payload.course_period_id && (!payload.subject_id || !payload.grade_level_id)) {
    const ctx = await getCoursePeriodContext(payload.course_period_id)
    payload.subject_id = payload.subject_id ?? ctx.subject_id
    payload.grade_level_id = payload.grade_level_id ?? ctx.grade_level_id
  }

  const { data, error } = await supabase.from('quizzes').insert(payload).select().single()
  if (error) throw error
  const quiz = data as Quiz

  // Blueprint quizzes: pre-generate the forms EAGERLY at publish time (never on
  // student fetch). On failure, roll back the just-created quiz so the teacher
  // sees the error instead of a half-created quiz.
  if (quiz.generation_mode === 'blueprint') {
    try {
      await generateQuizVariants(quiz.id)
    } catch (e) {
      await supabase.from('quizzes').delete().eq('id', quiz.id)
      throw e
    }
  }
  return quiz
}

export const updateQuiz = async (
  id: string,
  dto: Partial<Pick<Quiz,
    | 'title' | 'description' | 'assignment_id' | 'course_period_id' | 'academic_year_id'
    | 'show_correct_answers' | 'shuffle' | 'subject_id' | 'grade_level_id'
    | 'assigned_student_ids' | 'generation_mode' | 'variant_count'
    | 'blueprint_easy' | 'blueprint_medium' | 'blueprint_hard'
    | 'start_time' | 'lockout_minutes'
  >>
) => {
  const payload: any = { ...dto }

  if (payload.course_period_id && (!payload.subject_id || !payload.grade_level_id)) {
    const ctx = await getCoursePeriodContext(payload.course_period_id)
    payload.subject_id = payload.subject_id ?? ctx.subject_id
    payload.grade_level_id = payload.grade_level_id ?? ctx.grade_level_id
  }

  const { data, error } = await supabase
    .from('quizzes')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  const quiz = data as Quiz

  // Scheduling may have changed — drop the cached start/lockout for this quiz.
  quizStatusCache.delete(id)

  // Blueprint: (re)generate forms. If any student already got a form, the quiz
  // is locked and we must NOT regenerate under them.
  if (quiz.generation_mode === 'blueprint') {
    const { count } = await supabase
      .from('quiz_student_forms')
      .select('id', { count: 'exact', head: true })
      .eq('quiz_id', id)
    if (!count) {
      await generateQuizVariants(id, { force: true })
    }
  }
  return quiz
}

export const deleteQuiz = async (id: string) => {
  const { error } = await supabase.from('quizzes').delete().eq('id', id)
  if (error) throw error
}

// Copy a quiz to a new academic year (Premium: Copy Quiz from Last Year)
export const copyQuiz = async (sourceId: string, targetAcademicYearId: string, targetAssignmentId?: string) => {
  // Get source quiz
  const sourceQuiz = await getQuiz(sourceId)
  if (!sourceQuiz) throw new Error('Source quiz not found')

  // Get question map
  const { data: mapRows, error: mapErr } = await supabase
    .from('quiz_question_map')
    .select('*')
    .eq('quiz_id', sourceId)
  if (mapErr) throw mapErr

  // Create new quiz. A blueprint source regenerates fresh forms from the
  // current bank inside createQuiz; scheduling/targeting are not carried over.
  const newQuiz = await createQuiz({
    school_id: sourceQuiz.school_id,
    campus_id: sourceQuiz.campus_id,
    assignment_id: targetAssignmentId ?? null,
    course_period_id: sourceQuiz.course_period_id,
    created_by: sourceQuiz.created_by,
    academic_year_id: targetAcademicYearId,
    title: sourceQuiz.title + ' (Copy)',
    description: sourceQuiz.description,
    show_correct_answers: sourceQuiz.show_correct_answers,
    shuffle: sourceQuiz.shuffle,
    subject_id: sourceQuiz.subject_id,
    grade_level_id: sourceQuiz.grade_level_id,
    generation_mode: sourceQuiz.generation_mode,
    variant_count: sourceQuiz.variant_count,
    blueprint_easy: sourceQuiz.blueprint_easy,
    blueprint_medium: sourceQuiz.blueprint_medium,
    blueprint_hard: sourceQuiz.blueprint_hard,
    assigned_student_ids: [],
    start_time: null,
    lockout_minutes: null,
    variants_generated_at: null,
  })

  // Copy manual question mappings only (variant maps are regenerated above).
  const manualMaps = (mapRows || []).filter((m: any) => !m.variant_id)
  if (manualMaps.length > 0) {
    const newMaps = manualMaps.map(m => ({
      quiz_id: newQuiz.id,
      question_id: m.question_id,
      points: m.points,
      sort_order: m.sort_order,
    }))
    const { error: insertErr } = await supabase.from('quiz_question_map').insert(newMaps)
    if (insertErr) throw insertErr
  }

  return newQuiz
}

// ============================================================================
// QUIZ QUESTION MAP
// ============================================================================

export const getQuizQuestions = async (quizId: string) => {
  const { data, error } = await supabase
    .from('quiz_question_map')
    .select(`
      *,
      question:quiz_questions(
        id, title, type, description, answer, sort_order,
        category:quiz_categories(title)
      )
    `)
    .eq('quiz_id', quizId)
    .order('sort_order', { ascending: true })

  if (error) throw error
  return data as QuizQuestionMap[]
}

export const addQuestionToQuiz = async (quizId: string, questionId: string, points: number, sortOrder: number) => {
  const { data, error } = await supabase
    .from('quiz_question_map')
    .insert({ quiz_id: quizId, question_id: questionId, points, sort_order: sortOrder })
    .select()
    .single()
  if (error) throw error
  return data as QuizQuestionMap
}

export const updateQuizQuestion = async (mapId: string, dto: { points?: number; sort_order?: number }) => {
  const { data, error } = await supabase
    .from('quiz_question_map')
    .update(dto)
    .eq('id', mapId)
    .select()
    .single()
  if (error) throw error
  return data as QuizQuestionMap
}

export const removeQuestionFromQuiz = async (mapId: string) => {
  const { error } = await supabase.from('quiz_question_map').delete().eq('id', mapId)
  if (error) throw error
}

// ============================================================================
// STUDENT: SUBMIT QUIZ
// ============================================================================

export const getStudentQuizSubmission = async (quizId: string, studentId: string) => {
  // Get all question map IDs for this quiz
  const { data: maps, error: mapErr } = await supabase
    .from('quiz_question_map')
    .select(`
      id, quiz_id, question_id, points, sort_order,
      question:quiz_questions(id, title, type, description, answer)
    `)
    .eq('quiz_id', quizId)
    .order('sort_order', { ascending: true })
  if (mapErr) throw mapErr

  const mapIds = (maps || []).map(m => m.id)

  // Get existing answers
  const { data: answers, error: ansErr } = await supabase
    .from('quiz_answers')
    .select('*')
    .eq('student_id', studentId)
    .in('quiz_question_map_id', mapIds.length ? mapIds : ['__none__'])
  if (ansErr) throw ansErr

  const answerMap: Record<string, QuizAnswer> = {}
  ;(answers || []).forEach(a => { answerMap[a.quiz_question_map_id] = a })

  return { maps: maps || [], answerMap }
}

export const submitQuiz = async (
  quizId: string,
  studentId: string,
  answers: Array<{ quiz_question_map_id: string; answer: string }>
) => {
  // Verify maps belong to this quiz
  const { data: validMaps } = await supabase
    .from('quiz_question_map')
    .select('id, question_id, points, question:quiz_questions(type, answer)')
    .eq('quiz_id', quizId)

  const validMapIds = new Set((validMaps || []).map(m => m.id))

  const upsertRows = answers
    .filter(a => validMapIds.has(a.quiz_question_map_id))
    .map(a => {
      const mapRow = (validMaps || []).find(m => m.id === a.quiz_question_map_id)
      const autoPoints = mapRow ? autoGrade(mapRow.question as any, a.answer, mapRow.points) : null
      return {
        quiz_question_map_id: a.quiz_question_map_id,
        student_id: studentId,
        answer: a.answer,
        points: autoPoints,
        updated_at: new Date().toISOString(),
      }
    })

  if (upsertRows.length === 0) return []

  const { data, error } = await supabase
    .from('quiz_answers')
    .upsert(upsertRows, { onConflict: 'quiz_question_map_id,student_id' })
    .select()

  if (error) throw error

  // Update gradebook grade if assignment_id exists
  await updateGradebookFromQuiz(quizId, studentId)

  return data as QuizAnswer[]
}

// Grade a single answer (teacher override)
export const gradeAnswer = async (answerId: string, points: number) => {
  const { data, error } = await supabase
    .from('quiz_answers')
    .update({ points, updated_at: new Date().toISOString() })
    .eq('id', answerId)
    .select(`*, quiz_question_map:quiz_question_map(quiz_id, question:quiz_questions(type))`)
    .single()
  if (error) throw error

  // Re-sync gradebook
  const mapRow = data.quiz_question_map as any
  if (mapRow?.quiz_id) {
    await updateGradebookFromQuiz(mapRow.quiz_id, data.student_id)
  }
  return data as QuizAnswer
}

// ============================================================================
// AUTO-GRADING HELPER
// ============================================================================

function autoGrade(
  question: { type: QuestionType; answer: string | null },
  studentAnswer: string,
  totalPoints: number
): number | null {
  if (!question) return null

  switch (question.type) {
    case 'textarea':
      return null // Manual grading required

    case 'text': {
      if (!question.answer) return null
      const correct = question.answer.trim().toLowerCase() === studentAnswer.trim().toLowerCase()
      return correct ? totalPoints : 0
    }

    case 'select': {
      // Options stored as newline-separated, correct option prefixed with *
      if (!question.answer) return null
      const options = question.answer.split('\n').map(o => o.trim()).filter(Boolean)
      const idx = parseInt(studentAnswer, 10)
      if (isNaN(idx) || idx < 0 || idx >= options.length) return 0
      return options[idx]?.startsWith('*') ? totalPoints : 0
    }

    case 'multiple': {
      if (!question.answer) return null
      const options = question.answer.split('\n').map(o => o.trim()).filter(Boolean)
      const correctOptions = options
        .map((o, i) => ({ o, i }))
        .filter(({ o }) => o.startsWith('*'))
        .map(({ i }) => i)

      const chosen = studentAnswer
        .split('||')
        .map(s => s.trim())
        .filter(Boolean)
        .map(Number)
        .filter(n => !isNaN(n))

      const allCorrect =
        chosen.length === correctOptions.length &&
        correctOptions.every(ci => chosen.includes(ci)) &&
        chosen.every(ci => correctOptions.includes(ci))

      return allCorrect ? totalPoints : 0
    }

    case 'gap': {
      if (!question.answer) return null
      // Expected: "The sky is __blue__.\nThe grass is __green__."
      // Student answer stored as: "blue||green" (gap values joined by ||)
      const expectedGaps = extractGaps(question.answer)
      const studentGaps = studentAnswer.split('||')

      if (expectedGaps.length === 0) return null

      const correctCount = expectedGaps.reduce((acc, expected, i) => {
        const student = (studentGaps[i] || '').trim().toLowerCase()
        return acc + (student === expected.trim().toLowerCase() ? 1 : 0)
      }, 0)

      return Math.round((correctCount / expectedGaps.length) * totalPoints)
    }

    case 'matching': {
      // Expected: "Paris::France\nTokyo::Japan" (one Left::Right pair per line)
      // Student answer stored as: "2||0||1" — canonical right-index chosen for each left item, by position
      const pairs = extractMatchingPairs(question.answer)
      if (pairs.length === 0) return null

      const chosen = studentAnswer.split('||').map(s => parseInt(s.trim(), 10))

      const correctCount = pairs.reduce((acc, _, i) => acc + (chosen[i] === i ? 1 : 0), 0)

      return Math.round((correctCount / pairs.length) * totalPoints)
    }

    default:
      return null
  }
}

function extractMatchingPairs(text: string | null): Array<{ left: string; right: string }> {
  if (!text) return []
  return text
    .split('\n')
    .map(line => line.split('::'))
    .filter((parts): parts is [string, string] => parts.length === 2)
    .map(([left, right]) => ({ left: left.trim(), right: right.trim() }))
}

function extractGaps(text: string): string[] {
  const gaps: string[] = []
  const regex = /__(.+?)__/g
  let match
  while ((match = regex.exec(text)) !== null) {
    gaps.push(match[1])
  }
  return gaps
}

// ============================================================================
// GRADEBOOK SYNC
// ============================================================================

async function updateGradebookFromQuiz(quizId: string, studentId: string) {
  try {
    // Get quiz assignment + course period
    const { data: quiz } = await supabase
      .from('quizzes')
      .select('assignment_id, course_period_id, school_id, campus_id')
      .eq('id', quizId)
      .single()

    if (!quiz?.assignment_id) return

    // Sum all points earned by student in this quiz
    const { data: maps } = await supabase
      .from('quiz_question_map')
      .select('id')
      .eq('quiz_id', quizId)

    const mapIds = (maps || []).map(m => m.id)
    if (!mapIds.length) return

    const { data: answers } = await supabase
      .from('quiz_answers')
      .select('points')
      .eq('student_id', studentId)
      .in('quiz_question_map_id', mapIds)

    const totalEarned = (answers || []).reduce(
      (sum, a) => sum + (a.points != null ? Number(a.points) : 0),
      0
    )

    // Check if any ungraded answers remain
    const hasUngraded = (answers || []).some(a => a.points === null)
    if (hasUngraded) return // Wait until all graded

    // Get student record
    const { data: student } = await supabase
      .from('students')
      .select('id')
      .eq('id', studentId)
      .single()
    if (!student) return

    // Upsert gradebook grade
    await supabase
      .from('gradebook_grades')
      .upsert(
        {
          school_id: quiz.school_id,
          campus_id: quiz.campus_id,
          assignment_id: quiz.assignment_id,
          student_id: studentId,
          course_period_id: quiz.course_period_id,
          points: totalEarned,
          graded_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'assignment_id,student_id' }
      )
  } catch {
    // Non-fatal: gradebook sync failure
  }
}

// ============================================================================
// STUDENT QUIZ LIST
// Returns quizzes available to a student based on their section's course periods
// ============================================================================

export const getStudentQuizzes = async (studentId: string) => {
  // Get student's section and school
  const { data: student } = await supabase
    .from('students')
    .select('section_id, school_id')
    .eq('id', studentId)
    .single()

  const selectCols = `
      id, title, description, show_correct_answers, shuffle,
      created_at, course_period_id, assignment_id, academic_year_id,
      subject_id, grade_level_id, assigned_student_ids,
      generation_mode, variant_count, start_time, lockout_minutes,
      assignment:gradebook_assignments(id, title, points, due_date, assigned_date)
    `

  // (1) Quizzes for the student's section's course periods
  let sectionQuizzes: any[] = []
  if (student?.section_id) {
    const { data: cps } = await supabase
      .from('course_periods')
      .select('id')
      .eq('section_id', student.section_id)
    const cpIds = (cps || []).map(cp => cp.id)
    if (cpIds.length > 0) {
      const { data, error } = await supabase
        .from('quizzes')
        .select(selectCols)
        .in('course_period_id', cpIds)
        .order('created_at', { ascending: false })
      if (error) throw error
      // Targeting: a section quiz assigned to specific students is only visible
      // to those students; empty assigned_student_ids = whole section.
      sectionQuizzes = (data || []).filter((q: any) =>
        !q.assigned_student_ids?.length || q.assigned_student_ids.includes(studentId)
      )
    }
  }

  // (2) Quizzes explicitly targeted to this student (even outside their section)
  const { data: targeted } = await supabase
    .from('quizzes')
    .select(selectCols)
    .contains('assigned_student_ids', [studentId])
    .order('created_at', { ascending: false })

  // Merge + dedupe
  const byId = new Map<string, any>()
  for (const q of [...sectionQuizzes, ...(targeted || [])]) byId.set(q.id, q)
  const quizzes = Array.from(byId.values())
  if (quizzes.length === 0) return []

  // For each quiz, check if student has submitted
  const quizIds = quizzes.map(q => q.id)
  let submissionMap = new Map<string, boolean>()

  if (quizIds.length > 0) {
    // Get quiz_question_map ids for all quizzes
    const { data: maps } = await supabase
      .from('quiz_question_map')
      .select('id, quiz_id')
      .in('quiz_id', quizIds)

    const mapIds = (maps || []).map(m => m.id)

    if (mapIds.length > 0) {
      const { data: answers } = await supabase
        .from('quiz_answers')
        .select('quiz_question_map_id, quiz_question_map:quiz_question_map(quiz_id)')
        .eq('student_id', studentId)
        .in('quiz_question_map_id', mapIds)

      ;(answers || []).forEach((a: any) => {
        const qid = a.quiz_question_map?.quiz_id
        if (qid) submissionMap.set(qid, true)
      })
    }
  }

  return (quizzes || []).map(q => ({
    ...q,
    submitted: submissionMap.has(q.id),
    question_count: undefined,
  }))
}

// ============================================================================
// COURSE-PERIOD CONTEXT (resolve subject/grade/section for a course period)
// ============================================================================

export const getCoursePeriodContext = async (
  coursePeriodId: string
): Promise<{ subject_id: string | null; grade_level_id: string | null; section_id: string | null }> => {
  const { data, error } = await supabase
    .from('course_periods')
    .select('section_id, course:courses(subject_id), section:sections(grade_level_id)')
    .eq('id', coursePeriodId)
    .single()
  if (error) throw error
  const course = (data as any)?.course
  const section = (data as any)?.section
  return {
    subject_id: course?.subject_id ?? null,
    grade_level_id: section?.grade_level_id ?? null,
    section_id: (data as any)?.section_id ?? null,
  }
}

// ============================================================================
// MULTI-FORM (BLUEPRINT) VARIANT GENERATION
// Runs EAGERLY at teacher publish time (createQuiz/updateQuiz) — never on a
// student request, to avoid a thundering-herd of concurrent generations.
// ============================================================================

const shuffleArray = <T,>(arr: T[]): T[] => {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const FORM_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']

export const generateQuizVariants = async (
  quizId: string,
  opts?: { force?: boolean }
): Promise<QuizVariant[]> => {
  const quiz = await getQuiz(quizId)
  if (quiz.generation_mode !== 'blueprint') return []

  // Idempotent guard — if forms already exist, no-op unless forced.
  const { data: existing } = await supabase.from('quiz_variants').select('id').eq('quiz_id', quizId)
  if (existing && existing.length > 0) {
    if (!opts?.force) return existing as QuizVariant[]
    // force: clear existing forms (cascade removes their question maps + student assignments)
    await supabase.from('quiz_variants').delete().eq('quiz_id', quizId)
  }

  const tiers: Array<{ difficulty: DifficultyLevel; count: number }> = [
    { difficulty: 'easy', count: quiz.blueprint_easy || 0 },
    { difficulty: 'medium', count: quiz.blueprint_medium || 0 },
    { difficulty: 'hard', count: quiz.blueprint_hard || 0 },
  ]
  const variantCount = Math.max(1, quiz.variant_count || 1)

  // Load + validate the centralized, campus-scoped pool for each difficulty tier.
  const pools: Partial<Record<DifficultyLevel, QuizQuestion[]>> = {}
  for (const tier of tiers) {
    if (tier.count <= 0) continue
    const pool = await getQuestions(quiz.school_id, {
      campusId: quiz.campus_id ?? undefined,
      subjectId: quiz.subject_id ?? undefined,
      gradeLevelId: quiz.grade_level_id ?? undefined,
      difficulty: tier.difficulty,
    })
    if (pool.length < tier.count) {
      throw new Error(
        `Not enough '${tier.difficulty}' questions in the bank (need ${tier.count}, found ${pool.length}) for this subject/grade.`
      )
    }
    pools[tier.difficulty] = shuffleArray(pool)
  }

  const created: QuizVariant[] = []
  for (let v = 0; v < variantCount; v++) {
    const { data: variant, error: vErr } = await supabase
      .from('quiz_variants')
      .insert({ quiz_id: quizId, form_label: FORM_LABELS[v] ?? String(v + 1) })
      .select()
      .single()
    if (vErr) throw vErr

    const mapRows: any[] = []
    let sort = 0
    for (const tier of tiers) {
      if (tier.count <= 0) continue
      const pool = pools[tier.difficulty]!
      for (let i = 0; i < tier.count; i++) {
        // Disjoint slice per variant; wrap only if the pool is too small for
        // fully-distinct forms (documented constraint).
        const picked = pool[(v * tier.count + i) % pool.length]
        mapRows.push({
          quiz_id: quizId,
          question_id: picked.id,
          variant_id: variant.id,
          points: 10,
          sort_order: sort++,
        })
      }
    }
    if (mapRows.length) {
      const { error: mErr } = await supabase.from('quiz_question_map').insert(mapRows)
      if (mErr) throw mErr
    }
    created.push(variant as QuizVariant)
  }

  await supabase
    .from('quizzes')
    .update({ variants_generated_at: new Date().toISOString() })
    .eq('id', quizId)

  return created
}

// ============================================================================
// STUDENT: FORM ASSIGNMENT + START (multi-form aware)
// ============================================================================

const assignStudentForm = async (quizId: string, studentId: string): Promise<string> => {
  const { data: existing } = await supabase
    .from('quiz_student_forms')
    .select('variant_id')
    .eq('quiz_id', quizId)
    .eq('student_id', studentId)
    .maybeSingle()
  if (existing) return existing.variant_id

  const { data: variants } = await supabase.from('quiz_variants').select('id').eq('quiz_id', quizId)
  if (!variants || variants.length === 0) throw new Error('No exam forms available for this quiz.')

  const chosen = variants[Math.floor(Math.random() * variants.length)].id
  const { data: inserted, error } = await supabase
    .from('quiz_student_forms')
    .insert({ quiz_id: quizId, student_id: studentId, variant_id: chosen })
    .select('variant_id')
    .single()
  if (error) {
    // Concurrent first-click race — the UNIQUE(quiz_id, student_id) constraint
    // rejected the duplicate; read back the winner's assignment.
    const { data: again } = await supabase
      .from('quiz_student_forms')
      .select('variant_id')
      .eq('quiz_id', quizId)
      .eq('student_id', studentId)
      .maybeSingle()
    if (again) return again.variant_id
    throw error
  }
  return inserted.variant_id
}

const questionMapSelect = `
  *,
  question:quiz_questions(
    id, title, type, description, answer, sort_order,
    category:quiz_categories(title)
  )
`

// Returns the questions for the student's form (manual = shared set, variant_id
// NULL; blueprint = the student's randomly-assigned form). Assumes blueprint
// variants are already generated (publish-time), never generates here.
export const getStudentQuizForm = async (quizId: string, studentId: string): Promise<QuizQuestionMap[]> => {
  const quiz = await getQuiz(quizId)

  if (quiz.generation_mode !== 'blueprint') {
    const { data, error } = await supabase
      .from('quiz_question_map')
      .select(questionMapSelect)
      .eq('quiz_id', quizId)
      .is('variant_id', null)
      .order('sort_order', { ascending: true })
    if (error) throw error
    return data as QuizQuestionMap[]
  }

  if (!quiz.variants_generated_at) {
    throw new Error('This quiz has not been published yet.')
  }
  const variantId = await assignStudentForm(quizId, studentId)
  const { data, error } = await supabase
    .from('quiz_question_map')
    .select(questionMapSelect)
    .eq('quiz_id', quizId)
    .eq('variant_id', variantId)
    .order('sort_order', { ascending: true })
  if (error) throw error
  return data as QuizQuestionMap[]
}

// Resolve the question-map ids that make up a given student's attempt
// (variant-aware). For a blueprint quiz with no prior form, assigns one so an
// absent student still has a concrete set of questions to zero out.
const getStudentMapIds = async (quiz: Quiz, studentId: string): Promise<string[]> => {
  if (quiz.generation_mode !== 'blueprint') {
    const { data } = await supabase
      .from('quiz_question_map')
      .select('id')
      .eq('quiz_id', quiz.id)
      .is('variant_id', null)
    return (data || []).map(m => m.id)
  }
  if (!quiz.variants_generated_at) return []
  const variantId = await assignStudentForm(quiz.id, studentId)
  const { data } = await supabase
    .from('quiz_question_map')
    .select('id')
    .eq('quiz_id', quiz.id)
    .eq('variant_id', variantId)
  return (data || []).map(m => m.id)
}

// ============================================================================
// STRICT LIVE SCHEDULING — access state, cheap status poll, absent enforcement
// ============================================================================

export const getQuizAccessState = (
  quiz: Pick<Quiz, 'start_time' | 'lockout_minutes'>,
  now: Date = new Date()
): QuizAccessState => {
  const start = quiz.start_time ? new Date(quiz.start_time) : null
  const unlocked = !start || now >= start
  let lockoutAt: Date | null = null
  if (start && quiz.lockout_minutes != null) {
    lockoutAt = new Date(start.getTime() + quiz.lockout_minutes * 60000)
  }
  const locked_out = !!lockoutAt && now > lockoutAt
  return {
    unlocked,
    locked_out,
    start_time: quiz.start_time ?? null,
    lockout_at: lockoutAt ? lockoutAt.toISOString() : null,
    now: now.toISOString(),
  }
}

// Deliberately minimal, cached poll target: one indexed single-row read, no
// joins/eligibility/variant work, so hundreds of pollers collapse to one DB hit
// per TTL window.
const quizStatusCache = new Map<string, { start_time: string | null; lockout_minutes: number | null; cachedAt: number }>()
const QUIZ_STATUS_TTL_MS = 30000

export const getStudentQuizStatus = async (quizId: string): Promise<QuizAccessState> => {
  const cached = quizStatusCache.get(quizId)
  let start_time: string | null
  let lockout_minutes: number | null
  if (cached && Date.now() - cached.cachedAt < QUIZ_STATUS_TTL_MS) {
    start_time = cached.start_time
    lockout_minutes = cached.lockout_minutes
  } else {
    const { data, error } = await supabase
      .from('quizzes')
      .select('start_time, lockout_minutes')
      .eq('id', quizId)
      .single()
    if (error) throw error
    start_time = data.start_time
    lockout_minutes = data.lockout_minutes
    quizStatusCache.set(quizId, { start_time, lockout_minutes, cachedAt: Date.now() })
  }
  return getQuizAccessState({ start_time, lockout_minutes }, new Date())
}

// Records a zero-score, absent-flagged answer per question for a student who
// missed the lockout window. Skips students who actually participated.
export const markStudentAbsent = async (quizId: string, studentId: string): Promise<void> => {
  const quiz = await getQuiz(quizId)
  const mapIds = await getStudentMapIds(quiz, studentId)
  if (mapIds.length === 0) return

  const { data: existingAns } = await supabase
    .from('quiz_answers')
    .select('quiz_question_map_id, is_absent')
    .eq('student_id', studentId)
    .in('quiz_question_map_id', mapIds)
  if ((existingAns || []).some(a => !a.is_absent)) return // actually participated

  const rows = mapIds.map(id => ({
    quiz_question_map_id: id,
    student_id: studentId,
    answer: '',
    points: 0,
    is_absent: true,
    updated_at: new Date().toISOString(),
  }))
  const { error } = await supabase
    .from('quiz_answers')
    .upsert(rows, { onConflict: 'quiz_question_map_id,student_id' })
  if (error) throw error

  await updateGradebookFromQuiz(quizId, studentId)
}

const getQuizRosterStudentIds = async (quiz: Quiz): Promise<string[]> => {
  if (quiz.assigned_student_ids && quiz.assigned_student_ids.length > 0) {
    return quiz.assigned_student_ids
  }
  if (!quiz.course_period_id) return []
  const ctx = await getCoursePeriodContext(quiz.course_period_id)
  if (!ctx.section_id) return []
  const { data } = await supabase.from('students').select('id').eq('section_id', ctx.section_id)
  return (data || []).map(s => s.id)
}

// Server-authoritative absence enforcement: does not depend on the student ever
// opening the app. Called by the cron sweep and the teacher "Close & Sync" action.
export const sweepQuizAbsentees = async (quizId: string): Promise<{ marked: number }> => {
  const quiz = await getQuiz(quizId)
  const roster = await getQuizRosterStudentIds(quiz)
  if (roster.length === 0) return { marked: 0 }

  const { data: maps } = await supabase.from('quiz_question_map').select('id').eq('quiz_id', quizId)
  const mapIds = (maps || []).map(m => m.id)
  let answered = new Set<string>()
  if (mapIds.length > 0) {
    const { data: ans } = await supabase
      .from('quiz_answers')
      .select('student_id')
      .in('quiz_question_map_id', mapIds)
    answered = new Set((ans || []).map(a => a.student_id))
  }

  let marked = 0
  for (const sid of roster) {
    if (!answered.has(sid)) {
      await markStudentAbsent(quizId, sid)
      marked++
    }
  }
  return { marked }
}

// Cron helper: sweep every quiz whose lockout window has passed.
export const sweepAllExpiredQuizzes = async (): Promise<void> => {
  const nowIso = new Date().toISOString()
  const { data: quizzes } = await supabase
    .from('quizzes')
    .select('id, start_time, lockout_minutes')
    .not('start_time', 'is', null)
    .not('lockout_minutes', 'is', null)
  for (const q of quizzes || []) {
    const lockoutAt = new Date(new Date(q.start_time as string).getTime() + (q.lockout_minutes as number) * 60000)
    if (lockoutAt.toISOString() < nowIso) {
      try {
        await sweepQuizAbsentees(q.id)
      } catch {
        // non-fatal; continue with the rest
      }
    }
  }
}

// ============================================================================
// ANSWER BREAKDOWN (Premium)
// ============================================================================

export const getAnswerBreakdown = async (quizId: string): Promise<AnswerBreakdownRow[]> => {
  const { data: maps, error } = await supabase
    .from('quiz_question_map')
    .select(`
      id, points,
      question:quiz_questions(id, title, type, answer)
    `)
    .eq('quiz_id', quizId)
    .order('sort_order', { ascending: true })

  if (error) throw error

  const results: AnswerBreakdownRow[] = []

  for (const map of maps || []) {
    const { data: answers } = await supabase
      .from('quiz_answers')
      .select('answer, points')
      .eq('quiz_question_map_id', map.id)

    const total = answers?.length ?? 0
    const graded = answers?.filter(a => a.points != null) ?? []
    const correct = graded.filter(a => Number(a.points) >= Number(map.points)).length
    const avgPoints =
      graded.length > 0
        ? graded.reduce((sum, a) => sum + Number(a.points), 0) / graded.length
        : 0

    const q = map.question as any
    results.push({
      question_id: q?.id,
      question_title: q?.title,
      question_type: q?.type,
      map_id: map.id,
      total_answers: total,
      correct_answers: correct,
      correct_pct: total > 0 ? Math.round((correct / total) * 100) : 0,
      total_points: Number(map.points),
      avg_points: Math.round(avgPoints * 10) / 10,
    })
  }

  return results
}

// ============================================================================
// QUIZ CONFIG (Premium)
// ============================================================================

export const getQuizConfig = async (schoolId: string): Promise<QuizConfig | null> => {
  const { data, error } = await supabase
    .from('quiz_config')
    .select('*')
    .eq('school_id', schoolId)
    .maybeSingle()
  if (error) throw error
  return data as QuizConfig | null
}

export const upsertQuizConfig = async (dto: Omit<QuizConfig, 'id' | 'created_at' | 'updated_at'>) => {
  const { data, error } = await supabase
    .from('quiz_config')
    .upsert({ ...dto, updated_at: new Date().toISOString() }, { onConflict: 'school_id' })
    .select()
    .single()
  if (error) throw error
  return data as QuizConfig
}

// ============================================================================
// HELPERS
// ============================================================================

export const getAssignmentsForQuiz = async (
  schoolId: string,
  campusId?: string | null,
  coursePeriodId?: string
) => {
  let q = supabase
    .from('gradebook_assignments')
    .select('id, title, points, due_date, assigned_date, course_period_id, assignment_type_id')
    .eq('school_id', schoolId)
    .order('due_date', { ascending: false })

  if (campusId) q = q.eq('campus_id', campusId)
  if (coursePeriodId) q = q.eq('course_period_id', coursePeriodId)

  const { data, error } = await q
  if (error) throw error
  return data || []
}

export const getCoursePeriods = async (schoolId: string, campusId?: string | null) => {
  let q = supabase
    .from('course_periods')
    .select('id, course_id, courses(title)')
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false })

  if (campusId) q = q.eq('campus_id', campusId)

  const { data, error } = await q
  if (error) throw error
  return data || []
}
