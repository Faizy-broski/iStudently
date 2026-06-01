import { Router } from 'express'
import { SchoolDashboardController } from '../controllers/school-dashboard.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireAdmin } from '../middlewares/role.middleware'

const router = Router()
const schoolDashboardController = new SchoolDashboardController()

// All routes require authentication and admin role
router.use(authenticate)
router.use(requireAdmin)

// School dashboard routes
router.get('/stats', (req, res) => schoolDashboardController.getStats(req, res))
router.get('/attendance', (req, res) => schoolDashboardController.getAttendanceData(req, res))
router.get('/student-growth', (req, res) => schoolDashboardController.getStudentGrowth(req, res))
router.get('/grade-distribution', (req, res) => schoolDashboardController.getGradeDistribution(req, res))

export default router
