import { Router } from 'express'
import * as controller from '../controllers/embedded-resources.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireAdmin, requireRole } from '../middlewares/role.middleware'

const router = Router()

router.use(authenticate)

// Admin: full management
router.get('/', requireAdmin, controller.getAll)
router.post('/', requireAdmin, controller.create)
router.put('/:id', requireAdmin, controller.update)
router.delete('/:id', requireAdmin, controller.remove)

// All roles: read individual resource (for iframe viewer)
router.get(
  '/for-user',
  requireRole('super_admin', 'admin', 'teacher', 'student', 'parent', 'staff', 'librarian'),
  controller.getForUser
)
router.get(
  '/:id',
  requireRole('super_admin', 'admin', 'teacher', 'student', 'parent', 'staff', 'librarian'),
  controller.getById
)

export default router
