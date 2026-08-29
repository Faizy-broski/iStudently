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
router.post('/:id/start-session', requireTeacher, ctrl.startSession) // external_open flow only, still approval-gated
router.post('/course-periods/:coursePeriodId/start', requireTeacher, ctrl.startCourseSession) // existing_course, no approval
// requireTeacher already permits admin/super_admin (see role.middleware.ts) —
// one route, the service layer's assertOwnerOrAdmin further scopes who can
// actually end a given session (owning teacher, or a same-school admin).
router.post('/:id/end-session', requireTeacher, ctrl.endSession)

// Admin
router.get('/review-queue', requireAdmin, ctrl.listPendingForReview)
router.get('/active-sessions', requireAdmin, ctrl.listActiveSessions)
router.post('/:id/approve', requireAdmin, ctrl.approveRequest)
router.post('/:id/reject', requireAdmin, ctrl.rejectRequest)

// Student
router.get('/open', requireStudent, ctrl.listOpenCourses)
router.post('/:id/enroll', requireStudent, ctrl.enroll)
router.post('/:id/withdraw', requireStudent, ctrl.withdraw)
router.get('/enrolled', requireStudent, ctrl.listMyEnrollments)

export default router
