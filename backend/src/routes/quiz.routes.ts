import { Router } from 'express'
import * as ctrl from '../controllers/quiz.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireAdmin, requireTeacher } from '../middlewares/role.middleware'

const router = Router()
router.use(authenticate)

// Student quiz list — authenticated students only (no teacher role required)
router.get('/student/quizzes', ctrl.getStudentQuizzes)

// Helpers (read-only, teachers can access)
router.get('/helpers/assignments', requireTeacher, ctrl.getAssignments)
router.get('/helpers/course-periods', requireTeacher, ctrl.getCoursePeriods)

// Categories (teachers can manage their own categories)
router.get('/categories', requireTeacher, ctrl.getCategories)
router.post('/categories', requireTeacher, ctrl.createCategory)
router.put('/categories/:id', requireTeacher, ctrl.updateCategory)
router.delete('/categories/:id', requireAdmin, ctrl.deleteCategory)

// Questions
router.get('/questions', requireTeacher, ctrl.getQuestions)
router.get('/questions/:id', requireTeacher, ctrl.getQuestion)
router.post('/questions', requireTeacher, ctrl.createQuestion)
router.put('/questions/:id', requireTeacher, ctrl.updateQuestion)
router.delete('/questions/:id', requireTeacher, ctrl.deleteQuestion)

// Quizzes
router.get('/', requireTeacher, ctrl.getQuizzes)
router.get('/:id', requireTeacher, ctrl.getQuiz)
router.post('/', requireTeacher, ctrl.createQuiz)
router.put('/:id', requireTeacher, ctrl.updateQuiz)
router.delete('/:id', requireTeacher, ctrl.deleteQuiz)
router.post('/:id/copy', requireTeacher, ctrl.copyQuiz)                         // Premium

// Quiz Questions (map)
router.get('/:quizId/questions', requireTeacher, ctrl.getQuizQuestions)
router.post('/:quizId/questions', requireTeacher, ctrl.addQuestionToQuiz)
router.put('/:quizId/questions/:mapId', requireTeacher, ctrl.updateQuizQuestion)
router.delete('/:quizId/questions/:mapId', requireTeacher, ctrl.removeQuestionFromQuiz)

// Student submission — any authenticated user can submit or view their own
router.get('/:quizId/submissions/:studentId', ctrl.getStudentSubmission)
router.post('/:quizId/submit', ctrl.submitQuiz)
router.put('/answers/:answerId/grade', requireTeacher, ctrl.gradeAnswer)

// Answer Breakdown (Premium)
router.get('/:quizId/answer-breakdown', requireTeacher, ctrl.getAnswerBreakdown)

// Config (Premium)
router.get('/config', requireAdmin, ctrl.getQuizConfig)
router.put('/config', requireAdmin, ctrl.upsertQuizConfig)

export default router
