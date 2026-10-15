import { Router } from 'express'
import { setupStatusController } from '../controllers/setup-status.controller'
import { authenticate, type AuthRequest } from '../middlewares/auth.middleware'
import { requireRole } from '../middlewares/role.middleware'
import type { NextFunction, Response } from 'express'
import { campusIdsAllowed } from '../utils/campus-validation'

const router = Router()

// All routes require authentication
router.use(authenticate)

/** A campus addressed by id must be the caller's school or one of its branches (super admins: any). */
async function campusInFamily(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.profile?.role === 'super_admin') return next()
  try {
    if (await campusIdsAllowed(req.profile?.school_id, [req.params.id])) return next()
    return res.status(404).json({ success: false, error: 'Campus not found' })
  } catch (err) {
    console.error('Campus scope check failed:', err)
    return res.status(503).json({ success: false, retryable: true, error: 'Could not verify access' })
  }
}

// Setup status (admin only)
router.get('/status', requireRole('admin', 'super_admin'), setupStatusController.getSetupStatus)

// Campus management
// GET campuses is accessible by admin, super_admin, AND librarian (for sidebar campus info)
router.get('/campuses', requireRole('admin', 'super_admin', 'librarian'), setupStatusController.getCampuses)
// GET single campus is accessible by all authenticated roles so teachers/students/parents can load their campus info
router.get('/campuses/:id', requireRole('admin', 'super_admin', 'librarian', 'teacher', 'student', 'parent', 'staff'), campusInFamily, setupStatusController.getCampusById)
router.get('/campuses/:id/stats', requireRole('admin', 'super_admin'), campusInFamily, setupStatusController.getCampusStats)

// Write operations remain admin-only
router.post('/campuses', requireRole('admin', 'super_admin'), setupStatusController.createCampus)
router.put('/campuses/:id', requireRole('admin', 'super_admin'), campusInFamily, setupStatusController.updateCampus)
router.delete('/campuses/:id', requireRole('admin', 'super_admin'), campusInFamily, setupStatusController.deleteCampus)

export default router
