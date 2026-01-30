import express from 'express'
import * as examsController from '../controllers/exams.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireTeacher } from '../middlewares/role.middleware'

const router = express.Router()

// All routes require authentication
router.use(authenticate)

// ============================================================================
// EXAM TYPE ROUTES
// ============================================================================

router.get('/types', examsController.getExamTypes)

// ============================================================================
// EXAM ROUTES
// ============================================================================

router.get('/teacher', requireTeacher, examsController.getTeacherExams)
router.post('/', requireTeacher, examsController.createExam)
router.put('/:id', requireTeacher, examsController.updateExam)
router.delete('/:id', requireTeacher, examsController.deleteExam)

// ============================================================================
// EXAM RESULTS ROUTES
// ============================================================================

router.get('/:id/results', examsController.getExamResults)
router.post('/results/record', requireTeacher, examsController.recordMarks)

export default router
