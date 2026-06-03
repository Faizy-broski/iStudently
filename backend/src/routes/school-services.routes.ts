import { Router } from 'express'
import { SchoolServicesController } from '../controllers/school-services.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireRole } from '../middlewares/role.middleware'

const router = Router()
const controller = new SchoolServicesController()

// All routes require authentication
router.use(authenticate)

// =========================================
// School Services Management (Admin only)
// =========================================

// GET /api/services - Get all school services
router.get('/', requireRole('admin', 'teacher'), (req, res) =>
    controller.getServices(req, res)
)

// GET /api/services/:id - Get single service
router.get('/:id', requireRole('admin', 'teacher'), (req, res) =>
    controller.getServiceById(req, res)
)

// POST /api/services - Create a service
router.post('/', requireRole('admin'), (req, res) =>
    controller.createService(req, res)
)

// PUT /api/services/:id - Update a service
router.put('/:id', requireRole('admin'), (req, res) =>
    controller.updateService(req, res)
)

// DELETE /api/services/:id - Delete a service
router.delete('/:id', requireRole('admin'), (req, res) =>
    controller.deleteService(req, res)
)

// PUT /api/services/:id/grade-charges - Set grade-level charges
router.put('/:id/grade-charges', requireRole('admin'), (req, res) =>
    controller.setGradeCharges(req, res)
)

// =========================================
// Student Service Subscriptions
// =========================================

// GET /api/services/student/:studentId - Get student's services
router.get('/student/:studentId', requireRole('admin', 'teacher'), (req, res) =>
    controller.getStudentServices(req, res)
)

// POST /api/services/student/:studentId/subscribe - Subscribe student to services
router.post('/student/:studentId/subscribe', requireRole('admin'), (req, res) =>
    controller.subscribeStudent(req, res)
)

// DELETE /api/services/student/:studentId/:serviceId - Unsubscribe
router.delete('/student/:studentId/:serviceId', requireRole('admin'), (req, res) =>
    controller.unsubscribeStudent(req, res)
)

export default router
