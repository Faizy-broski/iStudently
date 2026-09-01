import { Router } from 'express'
import * as ctrl from '../../controllers/hifzi/reports.controller'
import { authenticate } from '../../middlewares/auth.middleware'
import { requireHifziEnabled } from '../../middlewares/hifzi-enabled.middleware'
import { requireRole } from '../../middlewares/role.middleware'

const router = Router()
router.use(authenticate)
router.use(requireHifziEnabled)

// Self-scoping enforced in the controller via assertCanAccessStudent.
router.get('/students/:id/heatmap', requireRole('student', 'parent', 'teacher', 'admin'), ctrl.getHeatmap)
router.get('/students/:id/report-card.pdf', requireRole('student', 'parent', 'teacher', 'admin'), ctrl.getReportCard)

export default router
