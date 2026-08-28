import { Router } from 'express'
import * as ctrl from '../controllers/inspection-analytics.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireInspector, requireAdmin } from '../middlewares/role.middleware'

const router = Router()
router.use(authenticate)

router.get('/inspector', requireInspector, ctrl.getInspectorDashboardStats)
router.get('/school/:schoolId', requireAdmin, ctrl.getSchoolDashboardStats)

export default router
