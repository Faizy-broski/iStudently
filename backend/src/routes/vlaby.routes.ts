import { Router } from 'express'
import * as controller from '../controllers/vlaby.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireRole } from '../middlewares/role.middleware'

const router = Router()

router.use(authenticate)

const allowed = requireRole('super_admin', 'admin', 'teacher', 'student', 'parent')
const adminOnly = requireRole('super_admin', 'admin')
const superAdminOnly = requireRole('super_admin')

// Auth
router.post('/login', allowed, controller.login)

// School-level VLaby account (admin configures once, all users benefit)
router.get('/school-config', allowed, controller.getSchoolConfig)
router.post('/school-config', adminOnly, controller.connectSchoolVlaby)
router.delete('/school-config', adminOnly, controller.disconnectSchoolVlaby)

// Public catalog — no VLaby token needed, just Studently auth + plugin active
router.get('/catalog', allowed, controller.getCatalog)

// Groups — public VLaby data, for category browsing
router.get('/groups', allowed, controller.getGroups)

// Relations — cascading filter dropdowns (all public VLaby data)
router.get('/relations/countries', allowed, controller.getCountries)
router.get('/relations/country/:countryId/levels', allowed, controller.getLevelsByCountry)
router.get('/relations/level/:levelId/classes', allowed, controller.getClassesByLevel)
router.get('/relations/class/:classId/semesters', allowed, controller.getSemestersByClass)
router.get('/relations/semester/:semesterId/subjects', allowed, controller.getSubjectsBySemester)

// Auth-required — needs VLaby Bearer token in x-vlaby-token header
router.get('/my-experiments', allowed, controller.getUserExperiments)
router.get('/experiment/:id', allowed, controller.getExperiment)

// Device limit: a user's own devices (the limit itself is set by the super admin)
router.get('/my-devices', allowed, controller.myDevices)
router.delete('/my-devices/:id', allowed, controller.releaseMyDevice)

// Device limit: super admin only
router.get('/device-limit', superAdminOnly, controller.getDeviceLimit)
router.put('/device-limit', superAdminOnly, controller.setDeviceLimit)
router.get('/devices', superAdminOnly, controller.listDevices)
router.delete('/devices/user/:profileId', superAdminOnly, controller.resetDevicesOfUser)
router.delete('/devices/:id', superAdminOnly, controller.deleteDevice)

export default router
