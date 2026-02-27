import { Request, Response } from 'express'
import * as svc from '../services/quiz.service'

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
    const { school_id, campus_id, category_id, search, created_by } = req.query as Record<string, string>
    if (!school_id) return err(res, { message: 'school_id required' }, 400)
    ok(res, await svc.getQuestions(school_id, { campusId: campus_id, categoryId: category_id, search, createdBy: created_by }))
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
