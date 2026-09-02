import { Router } from 'express'
import * as ctrl from '../../controllers/hifzi/compliance.controller'
import { authenticate } from '../../middlewares/auth.middleware'
import { requireHifziEnabled } from '../../middlewares/hifzi-enabled.middleware'
import { requireAdmin, requireInspector, requireRole } from '../../middlewares/role.middleware'

const router = Router()
router.use(authenticate)

// The inspector dashboard is cross-school by design (an inspector's grants
// span many schools' Hifzi modules) — it must NOT sit behind
// requireHifziEnabled, which resolves req.profile.school_id as if there
// were one single school context, exactly like quran/reference.routes.ts
// stays ungated for the same "not one tenant" reason.
router.get('/dashboard', requireInspector, ctrl.getInspectorDashboard)

router.get('/dashboard/school/:schoolId', requireHifziEnabled, requireAdmin, ctrl.getSchoolDashboard)
router.get('/milestones', requireHifziEnabled, requireRole('student', 'parent', 'teacher', 'admin'), ctrl.getMilestonesForStudent)

export default router
