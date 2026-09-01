import { Router } from 'express'
import * as ctrl from '../../controllers/hifzi/sessions.controller'
import { authenticate } from '../../middlewares/auth.middleware'
import { requireHifziEnabled } from '../../middlewares/hifzi-enabled.middleware'
import { requireTeacher, requireRole } from '../../middlewares/role.middleware'

const router = Router()
router.use(authenticate)
router.use(requireHifziEnabled)

router.post('/', requireTeacher, ctrl.createSession)
router.patch('/:id/correct', requireTeacher, ctrl.correctSession)
router.get('/', requireRole('student', 'parent', 'teacher', 'admin'), ctrl.listSessions)
router.get('/:id', requireRole('student', 'parent', 'teacher', 'admin'), ctrl.getSession)

export default router
