import { Router } from 'express'
import * as ctrl from '../../controllers/hifzi/students.controller'
import { authenticate } from '../../middlewares/auth.middleware'
import { requireHifziEnabled } from '../../middlewares/hifzi-enabled.middleware'
import { requireAdmin, requireTeacher, requireRole } from '../../middlewares/role.middleware'

const router = Router()
router.use(authenticate)
router.use(requireHifziEnabled)

router.get('/enrollments', requireTeacher, ctrl.listEnrollments)
router.post('/enrollments', requireAdmin, ctrl.enrollStudent)
router.post('/enrollments/bulk', requireAdmin, ctrl.enrollStudentsBulk)
router.patch('/enrollments/:id/withdraw', requireAdmin, ctrl.withdrawEnrollment)

// Profile reads: self-scoping enforced in the controller via
// backend/src/utils/hifzi-access.ts's assertCanAccessStudent, so student
// and parent roles are allowed through this role gate.
router.get('/:id/profile', requireRole('student', 'parent', 'teacher', 'admin'), ctrl.getStudentProfile)
router.patch('/:id/profile', requireTeacher, ctrl.updateStudentProfile)
router.post('/:id/notes', requireTeacher, ctrl.addStudentNote)

export default router
