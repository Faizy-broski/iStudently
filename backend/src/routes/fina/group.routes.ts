import { Router } from 'express'
import * as ctrl from '../../controllers/fina/group.controller'
import { authenticate } from '../../middlewares/auth.middleware'
import { finaEnforceScope } from '../../middlewares/fina-enforce-scope.middleware'
import { requireRole } from '../../middlewares/role.middleware'

const router = Router()
router.use(authenticate)
router.use(finaEnforceScope)

router.get('/', ctrl.listGroups)
router.post('/', requireRole('teacher', 'admin', 'media_officer'), ctrl.createGroup)
router.get('/:id/members', ctrl.listGroupMembers)
router.post('/:id/join', ctrl.joinGroup)
router.post('/:id/leave', ctrl.leaveGroup)

export default router
