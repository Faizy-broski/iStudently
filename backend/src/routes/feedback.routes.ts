import { Router } from 'express'
import * as controller from '../controllers/feedback.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireRole } from '../middlewares/role.middleware'

const router = Router()

router.use(authenticate)

// Any authenticated user can submit feedback
router.post('/', controller.submitFeedback)

// Super admin only: review submissions
router.get('/', requireRole('super_admin'), controller.listFeedback)
router.get('/count', requireRole('super_admin'), controller.getCount)
router.patch('/:id', requireRole('super_admin'), controller.updateStatus)

export default router
