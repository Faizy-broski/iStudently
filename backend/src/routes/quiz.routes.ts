import { Router, Request, Response, NextFunction } from 'express'
import multer from 'multer'
import * as ctrl from '../controllers/quiz.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireAdmin, requireTeacher } from '../middlewares/role.middleware'
import { requireBodyRowsInSchoolFamily, requireRequestSchoolsInFamily, requireRowInSchoolFamily } from '../middlewares/row-school-scope.middleware'
import type { AuthRequest } from '../middlewares/auth.middleware'
import { supabase } from '../config/supabase'
import { campusIdsAllowed } from '../utils/campus-validation'

const router = Router()
router.use(authenticate)
// Handlers take school_id / campus_id from the query or body as given; keep them to the caller's school family.
router.use(requireRequestSchoolsInFamily)

// Every quiz, question, category, chapter, question-map row and answer given by id must belong to
// the caller's school family (before, any teacher could read or change another school's by id).
const quizRow = requireRowInSchoolFamily('quizzes')
const quizParam = requireRowInSchoolFamily('quizzes', 'quizId')
const questionRow = requireRowInSchoolFamily('quiz_questions')
const categoryRow = requireRowInSchoolFamily('quiz_categories')
const chapterRow = requireRowInSchoolFamily('chapters')
const mapRow = requireRowInSchoolFamily('quiz_question_map', 'mapId', 'quiz:quizzes(school_id)')
const bodyRefs = [
  requireBodyRowsInSchoolFamily('quiz_categories', 'category_id'),
  requireBodyRowsInSchoolFamily('chapters', 'chapter_id'),
  requireBodyRowsInSchoolFamily('course_periods', 'course_period_id'),
  requireBodyRowsInSchoolFamily('gradebook_assignments', 'assignment_id'),
  requireBodyRowsInSchoolFamily('students', 'assigned_student_ids'),
]
const bodyQuestion = requireBodyRowsInSchoolFamily('quiz_questions', 'question_id')
const bodyCopyTarget = requireBodyRowsInSchoolFamily('gradebook_assignments', 'target_assignment_id')
const bodyBulkQuestions = requireBodyRowsInSchoolFamily('quiz_categories', (b) => (Array.isArray(b?.questions) ? b.questions.map((q: any) => q?.category_id) : []))

/** quiz_answers → quiz_question_map → quizzes: two hops, so not covered by requireRowInSchoolFamily. */
const answerRow = async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.profile?.role === 'super_admin') return next()
  try {
    const { data } = await supabase.from('quiz_answers').select('map:quiz_question_map(quiz:quizzes(school_id))').eq('id', req.params.answerId).maybeSingle()
    const schoolId = (data as any)?.map?.quiz?.school_id as string | undefined
    if (!schoolId || !(await campusIdsAllowed(req.profile?.school_id, [schoolId]))) return res.status(404).json({ data: null, error: 'Not found' })
    next()
  } catch (e) {
    next(e)
  }
}

// File upload config (memory storage — same pattern as media-upload.routes.ts)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
})

// Extend timeout for AI endpoints (Claude calls can take 30–60s)
const extendTimeout = (req: Request, res: Response, next: NextFunction) => {
  req.setTimeout(120000)
  res.setTimeout(120000)
  next()
}

// Student quiz list — authenticated students only (no teacher role required)
router.get('/student/quizzes', ctrl.getStudentQuizzes)
router.get('/student/:quizId/questions', quizParam, ctrl.getStudentQuizForm)
router.get('/student/:quizId/status', quizParam, ctrl.getStudentQuizStatus)

// Helpers (read-only, teachers can access)
router.get('/helpers/assignments', requireTeacher, ctrl.getAssignments)
router.get('/helpers/course-periods', requireTeacher, ctrl.getCoursePeriods)
router.get('/helpers/course-period-context', requireTeacher, requireRowInSchoolFamily('course_periods', 'course_period_id', 'school_id', 'query'), ctrl.getCoursePeriodContext)

// Chapters
router.get('/chapters', requireTeacher, ctrl.getChapters)
router.post('/chapters', requireTeacher, ctrl.createChapter)
router.put('/chapters/:id', requireTeacher, chapterRow, ctrl.updateChapter)
router.delete('/chapters/:id', requireAdmin, chapterRow, ctrl.deleteChapter)

// Categories (teachers can manage their own categories)
router.get('/categories', requireTeacher, ctrl.getCategories)
router.post('/categories', requireTeacher, ctrl.createCategory)
router.put('/categories/:id', requireTeacher, categoryRow, ctrl.updateCategory)
router.delete('/categories/:id', requireAdmin, categoryRow, ctrl.deleteCategory)

// AI: Extract / Generate / Bulk
router.post('/questions/extract', requireTeacher, extendTimeout, upload.single('file'), ctrl.extractQuestions)
router.post('/questions/generate', requireTeacher, extendTimeout, ctrl.generateQuestionsAI)
router.post('/questions/bulk', requireTeacher, bodyBulkQuestions, ctrl.bulkCreateQuestions)

// Questions
router.get('/questions', requireTeacher, ctrl.getQuestions)
router.get('/questions/:id', requireTeacher, questionRow, ctrl.getQuestion)
router.post('/questions', requireTeacher, ...bodyRefs, ctrl.createQuestion)
router.put('/questions/:id', requireTeacher, questionRow, ...bodyRefs, ctrl.updateQuestion)
router.delete('/questions/:id', requireTeacher, questionRow, ctrl.deleteQuestion)

// Config (Premium). Declared before "/:id" so "config" is not taken as a quiz id.
router.get('/config', requireAdmin, ctrl.getQuizConfig)
router.put('/config', requireAdmin, ctrl.upsertQuizConfig)

// Quizzes
router.get('/', requireTeacher, ctrl.getQuizzes)
router.get('/:id', requireTeacher, quizRow, ctrl.getQuiz)
router.post('/', requireTeacher, ...bodyRefs, ctrl.createQuiz)
router.put('/:id', requireTeacher, quizRow, ...bodyRefs, ctrl.updateQuiz)
router.delete('/:id', requireTeacher, quizRow, ctrl.deleteQuiz)
router.post('/:id/copy', requireTeacher, quizRow, bodyCopyTarget, ctrl.copyQuiz)                         // Premium

// Quiz Questions (map)
router.get('/:quizId/questions', requireTeacher, quizParam, ctrl.getQuizQuestions)
router.post('/:quizId/questions', requireTeacher, quizParam, bodyQuestion, ctrl.addQuestionToQuiz)
router.put('/:quizId/questions/:mapId', requireTeacher, quizParam, mapRow, ctrl.updateQuizQuestion)
router.delete('/:quizId/questions/:mapId', requireTeacher, quizParam, mapRow, ctrl.removeQuestionFromQuiz)

// Student submission — any authenticated user can submit or view their own
router.get('/:quizId/submissions/:studentId', quizParam, ctrl.getStudentSubmission)
router.post('/:quizId/submit', quizParam, ctrl.submitQuiz)
router.put('/answers/:answerId/grade', requireTeacher, answerRow, ctrl.gradeAnswer)

// Teacher/admin: close a quiz and mark roster no-shows absent (0)
router.post('/:quizId/close', requireTeacher, quizParam, ctrl.closeQuizAndSyncAbsentees)

// Answer Breakdown (Premium)
router.get('/:quizId/answer-breakdown', requireTeacher, quizParam, ctrl.getAnswerBreakdown)

export default router
