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

export default router
