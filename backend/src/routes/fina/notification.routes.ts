import { Router } from 'express'
import * as ctrl from '../../controllers/fina/notification.controller'
import { authenticate } from '../../middlewares/auth.middleware'
import { finaEnforceScope } from '../../middlewares/fina-enforce-scope.middleware'

const router = Router()
router.use(authenticate)
router.use(finaEnforceScope)

router.get('/', ctrl.listMyNotifications)
router.get('/unread-count', ctrl.countUnread)
router.post('/read-all', ctrl.markAllRead)
router.post('/:id/read', ctrl.markRead)

export default router
