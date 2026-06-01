import { Router } from 'express'
import { DashboardController } from '../controllers/dashboard.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireSuperAdmin } from '../middlewares/role.middleware'

const router = Router()
const dashboardController = new DashboardController()

// All routes require authentication and super admin role
router.use(authenticate)
router.use(requireSuperAdmin)

// Dashboard routes
router.get('/stats', (req, res) => dashboardController.getStats(req, res))
router.get('/school-growth', (req, res) => dashboardController.getSchoolGrowth(req, res))
router.get('/revenue', (req, res) => dashboardController.getRevenue(req, res))
router.get('/recent-schools', (req, res) => dashboardController.getRecentSchools(req, res))

export default router
