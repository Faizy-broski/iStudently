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

// School-level routes — GET is readable by any authenticated user (all roles load sidebar theme)
router.get('/school/:schoolId', sidebarConfigController.getSchoolConfig)
router.put('/school/:schoolId', requireAdmin, sidebarConfigController.updateSchoolConfig)
router.post('/school/:schoolId/reset', requireAdmin, sidebarConfigController.resetSchoolConfig)

// Campus-level routes — GET readable by any authenticated user
router.get('/campus/:campusId', sidebarConfigController.getCampusConfig)
router.put('/campus/:campusId', requireAdmin, sidebarConfigController.updateCampusConfig)
router.post('/campus/:campusId/reset', requireAdmin, sidebarConfigController.resetCampusConfig)

// Any authenticated user reads their effective config (campus → school → null)
router.get('/my', sidebarConfigController.getMyConfig)

export default router
