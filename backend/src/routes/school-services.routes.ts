import { Router } from 'express'
import { SchoolServicesController } from '../controllers/school-services.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireRole } from '../middlewares/role.middleware'
import { requireRowInSchoolFamily } from '../middlewares/row-school-scope.middleware'

const router = Router()
const controller = new SchoolServicesController()

// All routes require authentication
router.use(authenticate)

// Act on a service / student only inside the caller's school family
const serviceInFamily = requireRowInSchoolFamily('school_services')
const studentInFamily = requireRowInSchoolFamily('students', 'studentId')
const subServiceInFamily = requireRowInSchoolFamily('school_services', 'serviceId')

// =========================================
// School Services Management (Admin only)
// =========================================

// GET /api/services - Get all school services
router.get('/', requireRole('admin', 'teacher'), (req, res) =>
    controller.getServices(req, res)
)

// GET /api/services/:id - Get single service
router.get('/:id', requireRole('admin', 'teacher'), serviceInFamily, (req, res) =>
    controller.getServiceById(req, res)
)

// POST /api/services - Create a service
router.post('/', requireRole('admin'), (req, res) =>
    controller.createService(req, res)
)

// PUT /api/services/:id - Update a service
router.put('/:id', requireRole('admin'), serviceInFamily, (req, res) =>
    controller.updateService(req, res)
)

// DELETE /api/services/:id - Delete a service
router.delete('/:id', requireRole('admin'), serviceInFamily, (req, res) =>
    controller.deleteService(req, res)
)

// PUT /api/services/:id/grade-charges - Set grade-level charges
router.put('/:id/grade-charges', requireRole('admin'), serviceInFamily, (req, res) =>
    controller.setGradeCharges(req, res)
)

// =========================================
// Student Service Subscriptions
// =========================================

// GET /api/services/student/:studentId - Get student's services
router.get('/student/:studentId', requireRole('admin', 'teacher'), studentInFamily, (req, res) =>
    controller.getStudentServices(req, res)
)

// POST /api/services/student/:studentId/subscribe - Subscribe student to services
router.post('/student/:studentId/subscribe', requireRole('admin'), studentInFamily, (req, res) =>
    controller.subscribeStudent(req, res)
)

// DELETE /api/services/student/:studentId/:serviceId - Unsubscribe
router.delete('/student/:studentId/:serviceId', requireRole('admin'), studentInFamily, subServiceInFamily, (req, res) =>
    controller.unsubscribeStudent(req, res)
)

export default router
