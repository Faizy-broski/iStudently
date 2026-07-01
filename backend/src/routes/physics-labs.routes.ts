import { Router } from 'express'
import * as controller from '../controllers/physics-labs.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireAdmin, requireRole } from '../middlewares/role.middleware'

const router = Router()

router.use(authenticate)

// Admin: full management
router.get('/',      requireAdmin, controller.getAll)
router.post('/',     requireAdmin, controller.create)
router.put('/:id',  requireAdmin, controller.update)
router.delete('/:id', requireAdmin, controller.remove)

// Admin: view student submissions per lab
router.get('/:id/submissions', requireAdmin, controller.getSubmissions)

// Student: browse assigned labs
router.get(
  '/for-student',
  requireRole('super_admin', 'admin', 'teacher', 'student', 'parent', 'staff', 'librarian'),
  controller.getForStudent
)

// Student: submit findings
router.post(
  '/submissions',
  requireRole('student'),
  controller.submitFindings
)

export default router
