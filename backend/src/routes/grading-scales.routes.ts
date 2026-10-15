import express from 'express'
import * as gradingScalesController from '../controllers/grading-scales.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireAdmin } from '../middlewares/role.middleware'
import { supabase } from '../config/supabase'
import type { AuthRequest } from '../middlewares/auth.middleware'
import { campusIdsAllowed } from '../utils/campus-validation'

const router = express.Router()

// All routes require authentication
router.use(authenticate)

// Scales and their grade rows are addressed by id: they must belong to the caller's school family
// (was unchecked, so any school's admin could edit or delete another school's scale).
const notFound = (res: express.Response) => res.status(404).json({ success: false, error: 'Grading scale not found' })
async function scaleAllowed(req: express.Request, scaleId: string) {
  const profile = (req as AuthRequest).profile
  if (profile?.role === 'super_admin') return true
  const { data } = await supabase.from('grading_scales').select('school_id').eq('id', scaleId).maybeSingle()
  return !!data?.school_id && campusIdsAllowed(profile?.school_id, [data.school_id])
}
router.param('id', async (req, res, next, id: string) => ((await scaleAllowed(req, id)) ? next() : notFound(res)))
router.param('scaleId', async (req, res, next, id: string) => ((await scaleAllowed(req, id)) ? next() : notFound(res)))
router.param('gradeId', async (req, res, next, gradeId: string) => {
  const { data } = await supabase.from('grading_scale_grades').select('grading_scale_id').eq('id', gradeId).maybeSingle()
  return data && data.grading_scale_id === req.params.scaleId ? next() : notFound(res)
})

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

// POST /grading-scales/:scaleId/generate            - Auto-generate numeric scale (admin)
// Replaces all existing grade entries with a generated min–max–step numeric scale.
router.post('/:scaleId/generate', requireAdmin, gradingScalesController.generateGrades)

// PUT /grading-scales/:scaleId/grades/:gradeId      - Update grade entry (admin)
router.put('/:scaleId/grades/:gradeId', requireAdmin, gradingScalesController.updateGrade)

// DELETE /grading-scales/:scaleId/grades/:gradeId   - Delete grade entry (admin)
router.delete('/:scaleId/grades/:gradeId', requireAdmin, gradingScalesController.deleteGrade)

export default router
