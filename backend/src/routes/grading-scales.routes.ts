import express from 'express'
import * as gradingScalesController from '../controllers/grading-scales.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireAdmin } from '../middlewares/role.middleware'

const router = express.Router()

// All routes require authentication
router.use(authenticate)

// ============================================================================
// GRADING SCALES ROUTES
// ============================================================================

// GET /grading-scales          - List all scales for school (any authenticated user)
router.get('/', gradingScalesController.getScales)

// GET /grading-scales/default  - Get default scale for school
router.get('/default', gradingScalesController.getDefaultScale)

// GET /grading-scales/:id      - Get scale by ID with grades
router.get('/:id', gradingScalesController.getScaleById)

// POST /grading-scales         - Create new scale (admin only)
router.post('/', requireAdmin, gradingScalesController.createScale)

// POST /grading-scales/seed    - Seed default scale if none exists (admin only)
router.post('/seed', requireAdmin, gradingScalesController.seedDefaultScale)

// PUT /grading-scales/:id      - Update scale (admin only)
router.put('/:id', requireAdmin, gradingScalesController.updateScale)

// DELETE /grading-scales/:id   - Delete scale (admin only)
router.delete('/:id', requireAdmin, gradingScalesController.deleteScale)

// ============================================================================
// GRADING SCALE GRADES ROUTES (nested under scale)
// ============================================================================

// GET /grading-scales/:scaleId/grades               - List grade entries
router.get('/:scaleId/grades', gradingScalesController.getGrades)

// GET /grading-scales/:scaleId/calculate?percentage= - Calculate letter grade
router.get('/:scaleId/calculate', gradingScalesController.calculateLetterGrade)

// POST /grading-scales/:scaleId/grades              - Create single grade entry (admin)
router.post('/:scaleId/grades', requireAdmin, gradingScalesController.createGrade)

// POST /grading-scales/:scaleId/grades/bulk         - Bulk create grade entries (admin)
router.post('/:scaleId/grades/bulk', requireAdmin, gradingScalesController.bulkCreateGrades)

// PUT /grading-scales/:scaleId/grades/:gradeId      - Update grade entry (admin)
router.put('/:scaleId/grades/:gradeId', requireAdmin, gradingScalesController.updateGrade)

// DELETE /grading-scales/:scaleId/grades/:gradeId   - Delete grade entry (admin)
router.delete('/:scaleId/grades/:gradeId', requireAdmin, gradingScalesController.deleteGrade)

export default router
