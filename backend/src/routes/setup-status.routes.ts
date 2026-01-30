import { Router } from 'express'
import { setupStatusController } from '../controllers/setup-status.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireRole } from '../middlewares/role.middleware'

const router = Router()

// All routes require authentication and admin role
router.use(authenticate)
router.use(requireRole('admin', 'super_admin'))

// Setup status
router.get('/status', setupStatusController.getSetupStatus)

// Campus management
router.get('/campuses', setupStatusController.getCampuses)
router.post('/campuses', setupStatusController.createCampus)
router.put('/campuses/:id', setupStatusController.updateCampus)
router.delete('/campuses/:id', setupStatusController.deleteCampus)

export default router
