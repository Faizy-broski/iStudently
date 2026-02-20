import express from 'express'
import * as finalGradesController from '../controllers/final-grades.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireTeacher, requireAdmin } from '../middlewares/role.middleware'

const router = express.Router()

// All routes require authentication
router.use(authenticate)

// ============================================================================
// FINAL GRADES
// ============================================================================

// GET /final-grades?course_period_id=&marking_period_id=
router.get('/', finalGradesController.getFinalGrades)

// GET /final-grades/student/:studentId?academic_year_id=
router.get('/student/:studentId', finalGradesController.getStudentFinalGrades)

// POST /final-grades (teacher - save single final grade)
router.post('/', requireTeacher, finalGradesController.saveFinalGrade)

// POST /final-grades/calculate (teacher - auto-calculate all for a course_period)
router.post('/calculate', requireTeacher, finalGradesController.calculateAndSaveFinalGrades)

// POST /final-grades/calculate-cascading (teacher - cascade QTR→SEM→FY)
router.post('/calculate-cascading', requireTeacher, finalGradesController.calculateCascadingGrades)

// ============================================================================
// TEACHER COMPLETION
// ============================================================================

// GET /final-grades/completion?school_id=&marking_period_id=&academic_year_id=
router.get('/completion', finalGradesController.getCompletionStatus)

// POST /final-grades/completion (teacher - mark grades as completed)
router.post('/completion', requireTeacher, finalGradesController.markCompleted)

// POST /final-grades/completion/undo (teacher - unmark completion)
router.post('/completion/undo', requireTeacher, finalGradesController.unmarkCompleted)

// ============================================================================
// GRADE BREAKDOWN / PROGRESS REPORT
// ============================================================================

// GET /final-grades/breakdown/:studentId?academic_year_id=&marking_period_id=
router.get('/breakdown/:studentId', finalGradesController.getGradeBreakdown)

// ============================================================================
// FINAL GRADE LISTS (batch generation for printing)
// ============================================================================

// POST /final-grades/generate
router.post('/generate', requireAdmin, finalGradesController.generateGradeLists)

export default router
