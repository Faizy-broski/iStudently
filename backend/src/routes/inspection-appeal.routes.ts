import { Router } from 'express'
import * as ctrl from '../controllers/inspection-appeal.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireTeacher, requireAdmin, requireRole } from '../middlewares/role.middleware'

const router = Router()
router.use(authenticate)

// Teacher
router.get('/mine', requireTeacher, ctrl.listAppealsForTeacher)
router.post('/', requireTeacher, ctrl.createAppeal)
router.post('/:id/withdraw', requireTeacher, ctrl.withdrawAppeal)

// Admin
router.get('/assigned-to-me', requireAdmin, ctrl.listAppealsAssignedToMe)
router.get('/school/:schoolId', requireAdmin, ctrl.listAppealsForSchool)
router.get('/school/:schoolId/escalation-targets', requireAdmin, ctrl.listEscalationTargets)
router.post('/:id/status', requireAdmin, ctrl.updateStatus)
router.post('/:id/escalate', requireAdmin, ctrl.escalateAppeal)

// Shared (route-level role check here; per-appeal campus/ownership
// authorization is enforced in the service layer on top of this)
router.get('/:id', requireRole('teacher', 'admin', 'inspector'), ctrl.getAppeal)
router.post('/:id/comments', requireRole('teacher', 'admin', 'inspector'), ctrl.addComment)

export default router
