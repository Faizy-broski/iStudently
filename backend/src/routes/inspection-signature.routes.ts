import { Router } from 'express'
import * as ctrl from '../controllers/inspection-signature.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireRole } from '../middlewares/role.middleware'

const router = Router()
router.use(authenticate)

// Per-report signer-role resolution (teacher/principal/inspector) is
// enforced in the service layer — deliberately excludes super_admin
// bypassing on someone else's behalf (see resolveSignerRole's comment).
router.post('/:reportId/sign', requireRole('teacher', 'admin', 'inspector'), ctrl.signReport)

export default router
