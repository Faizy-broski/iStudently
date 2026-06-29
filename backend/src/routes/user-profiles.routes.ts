import { Router } from 'express'
import { authenticate } from '../middlewares/auth.middleware'
import { requireRole } from '../middlewares/role.middleware'
import * as UserProfilesController from '../controllers/user-profiles.controller'

const router = Router()

router.use(authenticate)

// Static routes must be before /:id to avoid matching as IDs
router.get('/my-permissions', UserProfilesController.getMyPermissions)
router.get('/roles', requireRole('super_admin', 'admin'), UserProfilesController.listRoles)
router.get('/standalone', requireRole('super_admin', 'admin'), UserProfilesController.listStandaloneProfiles)
router.post('/from-role', requireRole('super_admin', 'admin'), UserProfilesController.createProfileFromRole)

// Profiles CRUD (admin only)
router.get('/', requireRole('super_admin', 'admin'), UserProfilesController.listProfiles)
router.post('/', requireRole('super_admin', 'admin'), UserProfilesController.createProfile)
router.put('/:id', requireRole('super_admin', 'admin'), UserProfilesController.updateProfile)
router.delete('/:id', requireRole('super_admin', 'admin'), UserProfilesController.deleteProfile)

// Permissions matrix for a profile
router.get('/:id/permissions', requireRole('super_admin', 'admin'), UserProfilesController.getPermissions)
router.put('/:id/permissions', requireRole('super_admin', 'admin'), UserProfilesController.updatePermissions)

// Clone a role into a per-user profile and assign to staff
router.post('/:roleId/clone-for-staff', requireRole('super_admin', 'admin'), UserProfilesController.cloneForStaff)

// Staff profile assignment
router.put('/staff/:staffId/assign', requireRole('super_admin', 'admin'), UserProfilesController.assignProfile)
router.delete('/staff/:staffId/profile', requireRole('super_admin', 'admin'), UserProfilesController.removeStaffProfile)

export default router
