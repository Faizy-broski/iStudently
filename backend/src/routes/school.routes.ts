import { Router } from 'express'
import { SchoolController } from '../controllers/school.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireSuperAdmin, requireRole } from '../middlewares/role.middleware'

const router = Router()
const schoolController = new SchoolController()

// All routes require authentication
router.use(authenticate)

// Settings routes (for admin to manage their own school settings)
router.get('/settings', requireRole('admin'), (req, res) => schoolController.getSchoolSettings(req, res))
router.put('/settings', requireRole('admin'), (req, res) => schoolController.updateSchoolSettings(req, res))

// Multi-school context routes
router.get('/my-schools', (req, res) => schoolController.getMySchools(req, res))
router.post('/switch-context', (req, res) => schoolController.switchSchool(req, res))


// Onboarding route (must come before other routes)
router.post('/onboard', requireSuperAdmin, (req, res) => schoolController.onboardSchool(req, res))

// Statistics routes (must come before /:id to avoid route conflicts)
router.get('/stats', requireSuperAdmin, (req, res) => schoolController.getStats(req, res))
router.get('/count-by-status', requireSuperAdmin, (req, res) => schoolController.getCountByStatus(req, res))

// CRUD routes
router.post('/', requireRole('admin'), (req, res) => schoolController.createSchool(req, res))
router.get('/', requireSuperAdmin, (req, res) => schoolController.getAllSchools(req, res))
router.get('/slug/:slug', requireSuperAdmin, (req, res) => schoolController.getSchoolBySlug(req, res))
router.get('/:id', requireSuperAdmin, (req, res) => schoolController.getSchoolById(req, res))
router.patch('/:id', requireSuperAdmin, (req, res) => schoolController.updateSchool(req, res))
router.patch('/:id/status', requireSuperAdmin, (req, res) => schoolController.updateSchoolStatus(req, res))

// Admin management routes
router.get('/:id/admin', requireSuperAdmin, (req, res) => schoolController.getSchoolAdmin(req, res))
router.patch('/:id/admin', requireSuperAdmin, (req, res) => schoolController.updateSchoolAdmin(req, res))

// User status management (soft delete / reactivate)
router.patch('/users/:userId/toggle-status', requireRole('admin', 'super_admin'), (req, res) => schoolController.toggleUserStatus(req, res))

router.delete('/:id', requireSuperAdmin, (req, res) => schoolController.deleteSchool(req, res))

export default router
