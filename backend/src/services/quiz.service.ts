import { supabase } from '../config/supabase'

// ============================================================================
// TYPES
// ============================================================================

export type QuestionType = 'select' | 'multiple' | 'gap' | 'text' | 'textarea'

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
  created_at: string
  updated_at: string
  // joined
  assignment?: { title: string; points: number; due_date?: string; assigned_date?: string } | null
  course_period?: { title?: string } | null
  creator?: { first_name: string; last_name: string } | null
  question_count?: number
  student_count?: number
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
  filters?: { campusId?: string | null; categoryId?: string; search?: string; createdBy?: string }
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
  dto: Partial<Pick<QuizQuestion, 'title' | 'type' | 'description' | 'answer' | 'sort_order' | 'category_id'>>
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
  const { data, error } = await supabase.from('quizzes').insert(dto).select().single()
  if (error) throw error
  return data as Quiz
}

export const updateQuiz = async (
  id: string,
  dto: Partial<Pick<Quiz, 'title' | 'description' | 'assignment_id' | 'course_period_id' | 'academic_year_id' | 'show_correct_answers' | 'shuffle'>>
) => {
  const { data, error } = await supabase
    .from('quizzes')
    .update({ ...dto, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as Quiz
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

  // Create new quiz
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
  })

  // Copy question mappings
  if (mapRows && mapRows.length > 0) {
    const newMaps = mapRows.map(m => ({
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

    default:
      return null
  }
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

  if (!student?.section_id) return []

  // Get course periods for this section
  const { data: cps } = await supabase
    .from('course_periods')
    .select('id')
    .eq('section_id', student.section_id)

  const cpIds = (cps || []).map(cp => cp.id)
  if (cpIds.length === 0) return []

  // Get quizzes linked to those course periods
  const { data: quizzes, error } = await supabase
    .from('quizzes')
    .select(`
      id, title, description, show_correct_answers, shuffle,
      created_at, course_period_id, assignment_id, academic_year_id,
      assignment:gradebook_assignments(id, title, points, due_date, assigned_date)
    `)
    .in('course_period_id', cpIds)
    .order('created_at', { ascending: false })

  if (error) throw error

  // For each quiz, check if student has submitted
  const quizIds = (quizzes || []).map(q => q.id)
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
