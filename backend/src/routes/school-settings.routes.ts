import { Router } from 'express'
import { SchoolSettingsController } from '../controllers/school-settings.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireRole } from '../middlewares/role.middleware'

const router = Router()
const controller = new SchoolSettingsController()

// All routes require authentication
router.use(authenticate)

/**
 * GET /api/school-settings
 * Get school settings for the current user's school
 * All authenticated users can view (need it for client-side logic)
 */
router.get('/', (req, res) =>
  controller.getSettings(req, res)
)

/**
 * PUT /api/school-settings
 * Update school settings (diary reminder config, etc.)
 * Admin only
 */
router.put('/', requireRole('admin', 'super_admin'), (req, res) =>
  controller.updateSettings(req, res)
)

/**
 * POST /api/school-settings/test-diary-reminder
 * Send a test diary reminder email
 * Admin only
 */
router.post('/test-diary-reminder', requireRole('admin', 'super_admin'), (req, res) =>
  controller.sendTestReminder(req, res)
)

/**
 * POST /api/school-settings/trigger-diary-reminders
 * Manually trigger diary reminder processing
 * Admin/Super-admin only
 */
router.post('/trigger-diary-reminders', requireRole('admin', 'super_admin'), (req, res) =>
  controller.triggerReminders(req, res)
)

export default router
