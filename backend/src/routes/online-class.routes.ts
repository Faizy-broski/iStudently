import { Router } from 'express'
import * as ctrl from '../controllers/online-class.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireTeacher, requireAdmin, requireStudent } from '../middlewares/role.middleware'

const router = Router()
router.use(authenticate)

// Teacher
router.post('/', requireTeacher, ctrl.submitRequest)
router.get('/mine', requireTeacher, ctrl.listMyRequests)
router.post('/:id/cancel', requireTeacher, ctrl.cancelMyRequest)
router.post('/:id/start-session', requireTeacher, ctrl.startSession)

// Admin
router.get('/review-queue', requireAdmin, ctrl.listPendingForReview)
router.post('/:id/approve', requireAdmin, ctrl.approveRequest)
router.post('/:id/reject', requireAdmin, ctrl.rejectRequest)

// Student
router.get('/open', requireStudent, ctrl.listOpenCourses)
router.post('/:id/enroll', requireStudent, ctrl.enroll)
router.post('/:id/withdraw', requireStudent, ctrl.withdraw)
router.get('/enrolled', requireStudent, ctrl.listMyEnrollments)

export default router
