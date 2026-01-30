import express from 'express'
import * as StaffController from '../controllers/staff.controller'
import { authenticate as requireAuth } from '../middlewares/auth.middleware'
import { requireRole } from '../middlewares/role.middleware'

const router = express.Router()

// Apply auth middleware to all routes
router.use(requireAuth)

// Get current staff member's own profile (for librarian/staff roles)
router.get('/me', requireRole('librarian', 'staff'), StaffController.getMyProfile)

// Admin only routes for managing staff
router.get('/', requireRole('admin'), StaffController.getAllStaff)
router.get('/:id', requireRole('admin'), StaffController.getStaffById)
router.post('/', requireRole('admin'), StaffController.createStaff)
router.put('/:id', requireRole('admin'), StaffController.updateStaff)
router.delete('/:id', requireRole('admin'), StaffController.deleteStaff)

export default router
