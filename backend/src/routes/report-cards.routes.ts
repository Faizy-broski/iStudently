import express from 'express'
import * as reportCardsController from '../controllers/report-cards.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireAdmin, requireTeacher } from '../middlewares/role.middleware'

const router = express.Router()

router.use(authenticate)

// ============================================================================
// COMMENT CATEGORIES (admin CRUD)
// ============================================================================

router.get('/categories', reportCardsController.getCategories)
router.post('/categories', requireAdmin, reportCardsController.createCategory)
router.put('/categories/:id', requireAdmin, reportCardsController.updateCategory)
router.delete('/categories/:id', requireAdmin, reportCardsController.deleteCategory)

// ============================================================================
// COMMENT TEMPLATES (admin CRUD)
// ============================================================================

router.get('/comments', reportCardsController.getComments)
router.post('/comments', requireAdmin, reportCardsController.createComment)
router.put('/comments/:id', requireAdmin, reportCardsController.updateComment)
router.delete('/comments/:id', requireAdmin, reportCardsController.deleteComment)

// ============================================================================
// COMMENT CODE SCALES & CODES (admin CRUD)
// ============================================================================

router.get('/code-scales', reportCardsController.getCodeScales)
router.post('/code-scales', requireAdmin, reportCardsController.createCodeScale)
router.delete('/code-scales/:id', requireAdmin, reportCardsController.deleteCodeScale)
router.post('/code-scales/:scaleId/codes', requireAdmin, reportCardsController.createCode)
router.delete('/codes/:id', requireAdmin, reportCardsController.deleteCode)

// ============================================================================
// STUDENT COMMENTS (teacher enters per-student)
// ============================================================================

router.get('/student/:studentId', reportCardsController.getStudentComments)
router.post('/student-comments', requireTeacher, reportCardsController.saveStudentComment)
router.delete('/student-comments/:id', requireTeacher, reportCardsController.deleteStudentComment)

// ============================================================================
// REPORT CARD GENERATION
// ============================================================================

// GET /report-cards/generate/:studentId?marking_period_id=&academic_year_id=
router.get('/generate/:studentId', reportCardsController.generateReportCard)

// POST /report-cards/generate — batch generate for multiple students
router.post('/generate', requireTeacher, reportCardsController.generateReportCards)

// ============================================================================
// TUTOR / HOMEROOM COMMENTS
// Global per-student comment per marking period (not course-specific).
// school_id scoped to effective campus_id for full tenant isolation.
// ============================================================================

// GET  /report-cards/tutor-comments/marking-periods?academic_year_id=&school_id=
router.get('/tutor-comments/marking-periods', reportCardsController.getEligibleMarkingPeriods)

// GET  /report-cards/tutor-comments/:studentId?marking_period_id=&academic_year_id=&campus_id=
router.get('/tutor-comments/:studentId', reportCardsController.getTutorComment)

// POST /report-cards/tutor-comments  (upsert — insert or update)
router.post('/tutor-comments', requireTeacher, reportCardsController.upsertTutorComment)

// DELETE /report-cards/tutor-comments/:id?campus_id=
router.delete('/tutor-comments/:id', requireTeacher, reportCardsController.deleteTutorComment)

export default router
