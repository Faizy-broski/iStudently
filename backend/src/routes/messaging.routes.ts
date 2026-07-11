import { Router } from 'express'
import { MessagingController } from '../controllers/messaging.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireSuperAdmin } from '../middlewares/role.middleware'

const router = Router()
const messagingController = new MessagingController()

// All messaging routes require authentication; any authenticated role can use messaging.
router.use(authenticate)

router.post('/send', (req, res) => messagingController.sendMessage(req, res))
router.get('/recipients', (req, res) => messagingController.listRecipients(req, res))
router.get('/unread-count', (req, res) => messagingController.getUnreadCount(req, res))
router.get('/', (req, res) => messagingController.listMessages(req, res))
router.get('/templates', (req, res) => messagingController.listTemplates(req, res))
router.post('/templates', (req, res) => messagingController.saveTemplate(req, res))
router.delete('/templates/:id', (req, res) => messagingController.deleteTemplate(req, res))

// Global delete-window setting — super admin only.
router.get('/settings', requireSuperAdmin, (req, res) => messagingController.getSettings(req, res))
router.put('/settings', requireSuperAdmin, (req, res) => messagingController.updateSettings(req, res))

router.get('/:id', (req, res) => messagingController.getThread(req, res))
router.put('/:id/archive', (req, res) => messagingController.archiveMessage(req, res))
router.delete('/:id', (req, res) => messagingController.deleteMessage(req, res))

export default router
