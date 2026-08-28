import { Router } from 'express'
import * as ctrl from '../../controllers/fina/thread.controller'
import { authenticate } from '../../middlewares/auth.middleware'
import { finaEnforceScope } from '../../middlewares/fina-enforce-scope.middleware'
import { requireRole } from '../../middlewares/role.middleware'

const router = Router()
router.use(authenticate)
router.use(finaEnforceScope)

router.get('/', requireRole('teacher', 'parent', 'admin'), ctrl.listMyThreads)
router.get('/my-wards', requireRole('parent'), ctrl.listMyWardsForThreads)
router.get('/my-students', requireRole('teacher'), ctrl.listMyStudentsForThreads)
router.get('/contacts/:studentId', requireRole('teacher', 'parent'), ctrl.listContactsForStudent)
router.post('/', requireRole('teacher', 'parent'), ctrl.getOrCreateThread)
router.get('/:id/messages', ctrl.listMessages)
router.post('/:id/messages', ctrl.sendMessage)

export default router
