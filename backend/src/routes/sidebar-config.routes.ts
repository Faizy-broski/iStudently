import { Router } from 'express'
import * as sidebarConfigController from '../controllers/sidebar-config.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireSuperAdmin } from '../middlewares/role.middleware'

const router = Router()

router.use(authenticate)

// GET /api/sidebar-config/superadmin — super admin reads own config
router.get('/superadmin', requireSuperAdmin, sidebarConfigController.getSuperadminConfig)

// PUT /api/sidebar-config/superadmin — super admin writes own config
router.put('/superadmin', requireSuperAdmin, sidebarConfigController.updateSuperadminConfig)

// POST /api/sidebar-config/superadmin/reset — reset super admin config to defaults
router.post('/superadmin/reset', requireSuperAdmin, sidebarConfigController.resetSuperadminConfig)

// GET /api/sidebar-config/school/:schoolId — super admin reads a school's config
router.get('/school/:schoolId', requireSuperAdmin, sidebarConfigController.getSchoolConfig)

// PUT /api/sidebar-config/school/:schoolId — super admin writes a school's config
router.put('/school/:schoolId', requireSuperAdmin, sidebarConfigController.updateSchoolConfig)

// POST /api/sidebar-config/school/:schoolId/reset — reset school config to defaults
router.post('/school/:schoolId/reset', requireSuperAdmin, sidebarConfigController.resetSchoolConfig)

// GET /api/sidebar-config/my — any authenticated user reads their own effective config
router.get('/my', sidebarConfigController.getMyConfig)

export default router
