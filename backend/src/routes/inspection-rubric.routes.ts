import { Router } from 'express'
import * as ctrl from '../controllers/inspection-rubric.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireAdmin, requireRole } from '../middlewares/role.middleware'

const router = Router()
router.use(authenticate)

// Read: admin, super_admin, and inspector (needed for the observe screen)
router.get('/active', requireRole('admin', 'super_admin', 'inspector'), ctrl.getActiveRubric)

// Admin-only management
router.post('/ensure-default', requireAdmin, ctrl.ensureDefaultTemplate)
router.post('/templates/:templateId/categories', requireAdmin, ctrl.createCategory)
router.put('/categories/:id', requireAdmin, ctrl.updateCategory)
router.delete('/categories/:id', requireAdmin, ctrl.deleteCategory)
router.post('/categories/:categoryId/criteria', requireAdmin, ctrl.createCriterion)
router.put('/criteria/:id', requireAdmin, ctrl.updateCriterion)
router.delete('/criteria/:id', requireAdmin, ctrl.deleteCriterion)

export default router
