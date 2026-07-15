import { Router } from 'express'
import { pushNotificationsController } from '../controllers/push-notifications.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireAdmin } from '../middlewares/role.middleware'

const router = Router()

router.use(authenticate)

router.get('/vapid-public-key', (req, res) => pushNotificationsController.getPublicKey(req, res))
router.post('/subscribe', (req, res) => pushNotificationsController.subscribe(req, res))
router.delete('/subscribe', (req, res) => pushNotificationsController.unsubscribe(req, res))

router.get('/stats', requireAdmin, (req, res) => pushNotificationsController.getStats(req, res))
router.post('/test', requireAdmin, (req, res) => pushNotificationsController.sendTest(req, res))

export default router
