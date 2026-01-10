import { Router } from 'express'
import { SchoolController } from '../controllers/school.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireSuperAdmin } from '../middlewares/role.middleware'

const router = Router()
const schoolController = new SchoolController()

// All routes require authentication
router.use(authenticate)

// Onboarding route (must come before other routes)
router.post('/onboard', requireSuperAdmin, (req, res) => schoolController.onboardSchool(req, res))

// Statistics routes (must come before /:id to avoid route conflicts)
router.get('/stats', requireSuperAdmin, (req, res) => schoolController.getStats(req, res))
router.get('/count-by-status', requireSuperAdmin, (req, res) => schoolController.getCountByStatus(req, res))

// CRUD routes - Super Admin only
router.post('/', requireSuperAdmin, (req, res) => schoolController.createSchool(req, res))
router.get('/', requireSuperAdmin, (req, res) => schoolController.getAllSchools(req, res))
router.get('/slug/:slug', requireSuperAdmin, (req, res) => schoolController.getSchoolBySlug(req, res))
router.get('/:id', requireSuperAdmin, (req, res) => schoolController.getSchoolById(req, res))
router.patch('/:id', requireSuperAdmin, (req, res) => schoolController.updateSchool(req, res))
router.patch('/:id/status', requireSuperAdmin, (req, res) => schoolController.updateSchoolStatus(req, res))

// Admin management routes
router.get('/:id/admin', requireSuperAdmin, (req, res) => schoolController.getSchoolAdmin(req, res))
router.patch('/:id/admin', requireSuperAdmin, (req, res) => schoolController.updateSchoolAdmin(req, res))

router.delete('/:id', requireSuperAdmin, (req, res) => schoolController.deleteSchool(req, res))

export default router
