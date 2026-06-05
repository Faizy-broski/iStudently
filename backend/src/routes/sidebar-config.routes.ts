import { Router } from 'express'
import * as sidebarConfigController from '../controllers/sidebar-config.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireSuperAdmin, requireAdmin } from '../middlewares/role.middleware'

const router = Router()

router.use(authenticate)

// Superadmin-only routes
router.get('/superadmin', requireSuperAdmin, sidebarConfigController.getSuperadminConfig)
router.put('/superadmin', requireSuperAdmin, sidebarConfigController.updateSuperadminConfig)
router.post('/superadmin/reset', requireSuperAdmin, sidebarConfigController.resetSuperadminConfig)

// School-level routes — super_admin or school admin (ownership verified in controller)
router.get('/school/:schoolId', requireAdmin, sidebarConfigController.getSchoolConfig)
router.put('/school/:schoolId', requireAdmin, sidebarConfigController.updateSchoolConfig)
router.post('/school/:schoolId/reset', requireAdmin, sidebarConfigController.resetSchoolConfig)

// Campus-level routes — super_admin or school admin (campus ownership verified in controller)
router.get('/campus/:campusId', requireAdmin, sidebarConfigController.getCampusConfig)
router.put('/campus/:campusId', requireAdmin, sidebarConfigController.updateCampusConfig)
router.post('/campus/:campusId/reset', requireAdmin, sidebarConfigController.resetCampusConfig)

// Any authenticated user reads their effective config (campus → school → null)
router.get('/my', sidebarConfigController.getMyConfig)

export default router
