import { Router } from 'express'
import { setupStatusController } from '../controllers/setup-status.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireRole } from '../middlewares/role.middleware'

const router = Router()

// All routes require authentication
router.use(authenticate)

// Setup status (admin only)
router.get('/status', requireRole('admin', 'super_admin'), setupStatusController.getSetupStatus)

// Campus management
// GET campuses is accessible by admin, super_admin, AND librarian (for sidebar campus info)
router.get('/campuses', requireRole('admin', 'super_admin', 'librarian'), setupStatusController.getCampuses)
// GET single campus is accessible by all authenticated roles so teachers/students/parents can load their campus info
router.get('/campuses/:id', requireRole('admin', 'super_admin', 'librarian', 'teacher', 'student', 'parent', 'staff'), setupStatusController.getCampusById)
router.get('/campuses/:id/stats', requireRole('admin', 'super_admin'), setupStatusController.getCampusStats)

// Write operations remain admin-only
router.post('/campuses', requireRole('admin', 'super_admin'), setupStatusController.createCampus)
router.put('/campuses/:id', requireRole('admin', 'super_admin'), setupStatusController.updateCampus)
router.delete('/campuses/:id', requireRole('admin', 'super_admin'), setupStatusController.deleteCampus)

export default router
