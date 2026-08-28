import { Router } from 'express'
import * as ctrl from '../controllers/inspection-visit.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireInspector, requireAdmin, requireTeacher, requireRole } from '../middlewares/role.middleware'

const router = Router()
router.use(authenticate)

// NOTE: literal-segment routes (mine, teacher/mine, school/:schoolId) are
// registered before the generic '/:id' routes below — Express matches in
// registration order, so '/:id' would otherwise swallow '/mine' etc.

// Inspector
router.get('/mine', requireInspector, ctrl.listMyVisits)
router.post('/', requireInspector, ctrl.createVisit)

// Teacher: visits that include them
router.get('/teacher/mine', requireTeacher, ctrl.listVisitsForTeacher)

// Admin: visits scheduled at a campus they can access
router.get('/school/:schoolId', requireAdmin, ctrl.listVisitsForSchool)

// Shared (route-level role check here; per-visit campus/ownership
// authorization is enforced in the service layer on top of this)
router.get('/:id', requireRole('inspector', 'admin'), ctrl.getVisit)
router.post('/:id/confirm', requireAdmin, ctrl.confirmVisit)
router.post('/:id/check-in', requireInspector, ctrl.checkInVisit)
router.post('/:id/complete', requireInspector, ctrl.completeVisit)
router.post('/:id/cancel', requireRole('inspector', 'admin'), ctrl.cancelVisit)
router.post('/:id/reschedule', requireInspector, ctrl.rescheduleVisit)
router.put('/:id/teachers', requireInspector, ctrl.setVisitTeachers)

export default router
