import { Router } from 'express'
import * as ctrl from '../../controllers/hifzi/circles.controller'
import { authenticate } from '../../middlewares/auth.middleware'
import { requireHifziEnabled } from '../../middlewares/hifzi-enabled.middleware'
import { requireAdmin, requireTeacher } from '../../middlewares/role.middleware'

const router = Router()
router.use(authenticate)
router.use(requireHifziEnabled)

router.get('/', requireTeacher, ctrl.listCircles)
router.post('/', requireAdmin, ctrl.createCircle)

// Ministerial Decree 1205 compliance, Phase 4: /workload is a static segment
// that must be registered BEFORE the '/:id' dynamic route below — Express
// matches route registration order, so '/:id' would otherwise swallow
// 'GET /workload' by treating "workload" as the :id param.
router.get('/workload', requireAdmin, ctrl.getCircleWorkload)

router.get('/:id', requireTeacher, ctrl.getCircle)
router.patch('/:id', requireAdmin, ctrl.updateCircle)
router.post('/:id/teachers', requireAdmin, ctrl.addTeacher)
router.delete('/:id/teachers/:teacherProfileId', requireAdmin, ctrl.removeTeacher)
router.post('/:id/schedules', requireAdmin, ctrl.addSchedule)
router.get('/:id/schedule-conflicts', requireAdmin, ctrl.getScheduleConflicts)

// Ministerial Decree 1205 compliance, Phase 4 — bell-schedule opt-in.
router.patch('/:id/scheduling-mode', requireAdmin, ctrl.setSchedulingMode)
router.post('/:id/scheduling-mode/sync', requireAdmin, ctrl.syncSchedulingRequirement)

export default router
