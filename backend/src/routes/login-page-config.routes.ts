import { Router } from 'express'
import { DashboardController } from '../controllers/dashboard.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireSuperAdmin } from '../middlewares/role.middleware'

const router = Router()
const dashboardController = new DashboardController()

// GET is public — the unauthenticated /auth/login page needs to read it
router.get('/', (req, res) => dashboardController.getLoginPageConfig(req, res))

// Mutations require super admin
router.put('/', authenticate, requireSuperAdmin, (req, res) => dashboardController.updateLoginPageConfig(req, res))
router.post('/reset', authenticate, requireSuperAdmin, (req, res) => dashboardController.resetLoginPageConfig(req, res))

export default router
