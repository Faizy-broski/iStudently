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
router.get('/:id', requireTeacher, ctrl.getCircle)
router.patch('/:id', requireAdmin, ctrl.updateCircle)
router.post('/:id/teachers', requireAdmin, ctrl.addTeacher)
router.delete('/:id/teachers/:teacherProfileId', requireAdmin, ctrl.removeTeacher)
router.post('/:id/schedules', requireAdmin, ctrl.addSchedule)
router.get('/:id/schedule-conflicts', requireAdmin, ctrl.getScheduleConflicts)

export default router
