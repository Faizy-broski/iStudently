import { Request, Response } from 'express'
import * as svc from '../services/quiz.service'
import * as chapterSvc from '../services/chapters.service'
import * as aiSvc from '../services/ai-question.service'

const ok = (res: Response, data: unknown) => res.json({ data, error: null })
const err = (res: Response, e: unknown, status = 500) =>
  res.status(status).json({ data: null, error: (e as Error).message || 'Server error' })

// ============================================================================
// CATEGORIES
// ============================================================================

export const getCategories = async (req: Request, res: Response) => {
  try {
    const { school_id, campus_id } = req.query as Record<string, string>
    if (!school_id) return err(res, { message: 'school_id required' }, 400)
    ok(res, await svc.getCategories(school_id, campus_id || null))
  } catch (e) { err(res, e) }
}

export const createCategory = async (req: Request, res: Response) => {
  try { ok(res, await svc.createCategory(req.body)) }
  catch (e) { err(res, e) }
}

export const updateCategory = async (req: Request, res: Response) => {
  try { ok(res, await svc.updateCategory(req.params.id, req.body)) }
  catch (e) { err(res, e) }
}

export const deleteCategory = async (req: Request, res: Response) => {
  try { await svc.deleteCategory(req.params.id); ok(res, null) }
  catch (e) { err(res, e) }
}

// ============================================================================
// QUESTIONS
// ============================================================================

export const getQuestions = async (req: Request, res: Response) => {
  try {
    const { school_id, campus_id, category_id, search, created_by, grade_level_id, subject_id, chapter_id, difficulty } = req.query as Record<string, string>
    if (!school_id) return err(res, { message: 'school_id required' }, 400)
    ok(res, await svc.getQuestions(school_id, {
      campusId: campus_id,
      categoryId: category_id,
      search,
      createdBy: created_by,
      gradeLevelId: grade_level_id,
      subjectId: subject_id,
      chapterId: chapter_id,
      difficulty: difficulty as svc.DifficultyLevel | undefined,
    }))
  } catch (e) { err(res, e) }
}

export const getQuestion = async (req: Request, res: Response) => {
  try { ok(res, await svc.getQuestion(req.params.id)) }
  catch (e) { err(res, e) }
}

export const createQuestion = async (req: Request, res: Response) => {
  try { ok(res, await svc.createQuestion(req.body)) }
  catch (e) { err(res, e) }
}

export const updateQuestion = async (req: Request, res: Response) => {
  try { ok(res, await svc.updateQuestion(req.params.id, req.body)) }
  catch (e) { err(res, e) }
}

export const deleteQuestion = async (req: Request, res: Response) => {
  try { await svc.deleteQuestion(req.params.id); ok(res, null) }
  catch (e) { err(res, e) }
}

// ============================================================================
// QUIZZES
// ============================================================================

export const getQuizzes = async (req: Request, res: Response) => {
  try {
    const { school_id, campus_id, course_period_id, academic_year_id, created_by, search } = req.query as Record<string, string>
    if (!school_id) return err(res, { message: 'school_id required' }, 400)
    ok(res, await svc.getQuizzes(school_id, { campusId: campus_id, coursePeriodId: course_period_id, academicYearId: academic_year_id, createdBy: created_by, search }))
  } catch (e) { err(res, e) }
}

export const getQuiz = async (req: Request, res: Response) => {
  try { ok(res, await svc.getQuiz(req.params.id)) }
  catch (e) { err(res, e) }
}

export const createQuiz = async (req: Request, res: Response) => {
  try { ok(res, await svc.createQuiz(req.body)) }
  catch (e) { err(res, e) }
}

export const updateQuiz = async (req: Request, res: Response) => {
  try { ok(res, await svc.updateQuiz(req.params.id, req.body)) }
  catch (e) { err(res, e) }
}

export const deleteQuiz = async (req: Request, res: Response) => {
  try { await svc.deleteQuiz(req.params.id); ok(res, null) }
  catch (e) { err(res, e) }
}

export const copyQuiz = async (req: Request, res: Response) => {
  try {
    const { target_academic_year_id, target_assignment_id } = req.body
    ok(res, await svc.copyQuiz(req.params.id, target_academic_year_id, target_assignment_id))
  } catch (e) { err(res, e) }
}

// ============================================================================
// QUIZ QUESTIONS (MAP)
// ============================================================================

export const getQuizQuestions = async (req: Request, res: Response) => {
  try { ok(res, await svc.getQuizQuestions(req.params.quizId)) }
  catch (e) { err(res, e) }
}

export const addQuestionToQuiz = async (req: Request, res: Response) => {
  try {
    const { question_id, points, sort_order } = req.body
    ok(res, await svc.addQuestionToQuiz(req.params.quizId, question_id, points ?? 10, sort_order ?? 0))
  } catch (e) { err(res, e) }
}

export const updateQuizQuestion = async (req: Request, res: Response) => {
  try { ok(res, await svc.updateQuizQuestion(req.params.mapId, req.body)) }
  catch (e) { err(res, e) }
}

export const removeQuestionFromQuiz = async (req: Request, res: Response) => {
  try { await svc.removeQuestionFromQuiz(req.params.mapId); ok(res, null) }
  catch (e) { err(res, e) }
}

// ============================================================================
// STUDENT QUIZ LIST
// ============================================================================

const resolveStudentId = (req: Request): string | undefined => {
  const authReq = req as any
  if (!authReq.profile) return undefined
  const role = typeof authReq.profile.role === 'string' ? authReq.profile.role.toLowerCase() : ''
  if (role !== 'student') return undefined
  return authReq.profile.student_id || authReq.profile.id
}

export const getStudentQuizzes = async (req: Request, res: Response) => {
  try {
    const studentId = resolveStudentId(req)
    if (!studentId) return err(res, { message: 'No student profile found' }, 403)
    ok(res, await svc.getStudentQuizzes(studentId))
  } catch (e) { err(res, e) }
}

// Student-facing start: enforces scheduling + targeting, returns the student's
// (possibly variant-specific) question set. Replaces the old teacher-gated
// GET /:quizId/questions that students were incorrectly hitting.
export const getStudentQuizForm = async (req: Request, res: Response) => {
  try {
    const studentId = resolveStudentId(req)
    if (!studentId) return err(res, { message: 'No student profile found' }, 403)
    const quizId = req.params.quizId
    const quiz = await svc.getQuiz(quizId)

    // Targeting: if the quiz is assigned to specific students, others can't enter.
    if (quiz.assigned_student_ids && quiz.assigned_student_ids.length > 0 && !quiz.assigned_student_ids.includes(studentId)) {
      return err(res, { message: 'You are not assigned to this quiz.' }, 403)
    }

    // Scheduling gate.
    const state = svc.getQuizAccessState(quiz, new Date())
    if (state.locked_out) {
      await svc.markStudentAbsent(quizId, studentId)
      return res.status(423).json({ data: null, error: 'locked_out', locked_out: true })
    }
    if (!state.unlocked) {
      return res.status(423).json({ data: null, error: 'not_unlocked', unlocked: false, start_time: state.start_time })
    }

    ok(res, await svc.getStudentQuizForm(quizId, studentId))
  } catch (e) { err(res, e) }
}

// Cheap poll target for the countdown UI (single cached read, no joins).
export const getStudentQuizStatus = async (req: Request, res: Response) => {
  try { ok(res, await svc.getStudentQuizStatus(req.params.quizId)) }
  catch (e) { err(res, e) }
}

// Teacher/admin: finalize absentees immediately when the window closes.
export const closeQuizAndSyncAbsentees = async (req: Request, res: Response) => {
  try { ok(res, await svc.sweepQuizAbsentees(req.params.quizId)) }
  catch (e) { err(res, e) }
}

// ============================================================================
// STUDENT SUBMISSION
// ============================================================================

export const getStudentSubmission = async (req: Request, res: Response) => {
  try {
    const { studentId } = req.params
    ok(res, await svc.getStudentQuizSubmission(req.params.quizId, studentId))
  } catch (e) { err(res, e) }
}

export const submitQuiz = async (req: Request, res: Response) => {
  try {
    const { student_id, answers } = req.body
    if (!student_id || !Array.isArray(answers)) return err(res, { message: 'student_id and answers required' }, 400)
    ok(res, await svc.submitQuiz(req.params.quizId, student_id, answers))
  } catch (e) { err(res, e) }
}

export const gradeAnswer = async (req: Request, res: Response) => {
  try {
    const { points } = req.body
    ok(res, await svc.gradeAnswer(req.params.answerId, Number(points)))
  } catch (e) { err(res, e) }
}

// ============================================================================
// ANSWER BREAKDOWN (Premium)
// ============================================================================

export const getAnswerBreakdown = async (req: Request, res: Response) => {
  try { ok(res, await svc.getAnswerBreakdown(req.params.quizId)) }
  catch (e) { err(res, e) }
}

// ============================================================================
// CONFIG (Premium)
// ============================================================================

export const getQuizConfig = async (req: Request, res: Response) => {
  try {
    const { school_id } = req.query as Record<string, string>
    if (!school_id) return err(res, { message: 'school_id required' }, 400)
    ok(res, await svc.getQuizConfig(school_id))
  } catch (e) { err(res, e) }
}

export const upsertQuizConfig = async (req: Request, res: Response) => {
  try { ok(res, await svc.upsertQuizConfig(req.body)) }
  catch (e) { err(res, e) }
}

// ============================================================================
// HELPERS
// ============================================================================

export const getAssignments = async (req: Request, res: Response) => {
  try {
    const { school_id, campus_id, course_period_id } = req.query as Record<string, string>
    if (!school_id) return err(res, { message: 'school_id required' }, 400)
    ok(res, await svc.getAssignmentsForQuiz(school_id, campus_id || null, course_period_id))
  } catch (e) { err(res, e) }
}

export const getCoursePeriods = async (req: Request, res: Response) => {
  try {
    const { school_id, campus_id } = req.query as Record<string, string>
    if (!school_id) return err(res, { message: 'school_id required' }, 400)
    ok(res, await svc.getCoursePeriods(school_id, campus_id || null))
  } catch (e) { err(res, e) }
}

// Resolve subject/grade/section for a course period (for quiz auto-filter + roster).
export const getCoursePeriodContext = async (req: Request, res: Response) => {
  try {
    const { course_period_id } = req.query as Record<string, string>
    if (!course_period_id) return err(res, { message: 'course_period_id required' }, 400)
    ok(res, await svc.getCoursePeriodContext(course_period_id))
  } catch (e) { err(res, e) }
}

// ============================================================================
// AI: EXTRACT + GENERATE + BULK CREATE
// ============================================================================

export const extractQuestions = async (req: Request, res: Response) => {
  try {
    const file = (req as any).file as Express.Multer.File | undefined
    if (!file) return err(res, { message: 'No file uploaded (field name must be "file")' }, 400)

    const { allowed_types, grade_level_id, subject_id, chapter_id } = req.body
    const allowedTypes = allowed_types
      ? (typeof allowed_types === 'string' ? JSON.parse(allowed_types) : allowed_types)
      : ['select', 'multiple', 'gap', 'text', 'textarea', 'matching']

    const drafts = await aiSvc.extractQuestionsFromDocument({
      fileBuffer: file.buffer,
      mimeType: file.mimetype,
      allowedTypes,
      gradeLevelId: grade_level_id || null,
      subjectId: subject_id || null,
      chapterId: chapter_id || null,
    })

    ok(res, drafts)
  } catch (e) { err(res, e) }
}

export const generateQuestionsAI = async (req: Request, res: Response) => {
  try {
    const {
      school_id, grade_level_id, subject_id, chapter_ids,
      count, allowed_types, prompt,
    } = req.body

    if (!school_id) return err(res, { message: 'school_id required' }, 400)
    if (!count || count < 1 || count > 50) return err(res, { message: 'count must be 1-50' }, 400)

    const allowedTypes = allowed_types && allowed_types.length > 0
      ? allowed_types
      : ['select', 'multiple', 'gap', 'text', 'textarea', 'matching']

    const drafts = await aiSvc.generateQuestions({
      schoolId: school_id,
      gradeLevelId: grade_level_id || null,
      subjectId: subject_id || null,
      chapterIds: chapter_ids || [],
      count,
      allowedTypes,
      prompt,
    })

    ok(res, drafts)
  } catch (e) { err(res, e) }
}

export const bulkCreateQuestions = async (req: Request, res: Response) => {
  try {
    const { questions } = req.body
    if (!Array.isArray(questions) || questions.length === 0) {
      return err(res, { message: 'questions array required' }, 400)
    }

    const results: svc.QuizQuestion[] = []
    // Process in batches of 3 (per project pattern)
    for (let i = 0; i < questions.length; i += 3) {
      const batch = questions.slice(i, i + 3)
      const created = await Promise.all(
        batch.map((q: any) => svc.createQuestion(q))
      )
      results.push(...created)
    }

    ok(res, results)
  } catch (e) { err(res, e) }
}

// ============================================================================
// CHAPTERS
// ============================================================================

export const getChapters = async (req: Request, res: Response) => {
  try {
    const { subject_id, school_id } = req.query as Record<string, string>
    if (!subject_id || !school_id) return err(res, { message: 'subject_id and school_id required' }, 400)
    ok(res, await chapterSvc.getChapters(subject_id, school_id))
  } catch (e) { err(res, e) }
}

export const createChapter = async (req: Request, res: Response) => {
  try { ok(res, await chapterSvc.createChapter(req.body)) }
  catch (e) { err(res, e) }
}

export const updateChapter = async (req: Request, res: Response) => {
  try { ok(res, await chapterSvc.updateChapter(req.params.id, req.body)) }
  catch (e) { err(res, e) }
}

export const deleteChapter = async (req: Request, res: Response) => {
  try { await chapterSvc.deleteChapter(req.params.id); ok(res, null) }
  catch (e) { err(res, e) }
}
