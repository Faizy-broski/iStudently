import { Router } from 'express'
import * as ctrl from '../../controllers/hifzi/attendance.controller'
import { authenticate } from '../../middlewares/auth.middleware'
import { requireHifziEnabled } from '../../middlewares/hifzi-enabled.middleware'
import { requireTeacher, requireRole } from '../../middlewares/role.middleware'

const router = Router()
router.use(authenticate)
router.use(requireHifziEnabled)

router.post('/', requireTeacher, ctrl.markAttendance)
router.get('/', requireTeacher, ctrl.getAttendance)
router.post('/leave-requests', requireRole('parent', 'teacher', 'admin'), ctrl.createLeaveRequest)

export default router
