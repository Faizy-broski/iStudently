import { Router } from 'express'
import * as ctrl from '../controllers/inspector-broadcast.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireInspector, requireRole } from '../middlewares/role.middleware'

const router = Router()
router.use(authenticate)

router.get('/mine', requireInspector, ctrl.listMyBroadcasts)
router.post('/', requireInspector, ctrl.createBroadcast)
router.get('/school/:schoolId', requireRole('teacher', 'admin', 'inspector'), ctrl.listBroadcastsForSchool)
router.delete('/:id', requireRole('inspector', 'super_admin'), ctrl.deleteBroadcast)

export default router
