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

/**
 * GET /api/school-settings/smtp
 * Get SMTP settings (password masked)
 */
router.get('/smtp', requireRole('admin', 'super_admin'), (req, res) =>
  controller.getSmtpSettings(req, res)
)

/**
 * PUT /api/school-settings/smtp
 * Save SMTP settings
 */
router.put('/smtp', requireRole('admin', 'super_admin'), (req, res) =>
  controller.updateSmtpSettings(req, res)
)

/**
 * POST /api/school-settings/smtp/test
 * Test SMTP connection and send a test email
 */
router.post('/smtp/test', requireRole('admin', 'super_admin'), (req, res) =>
  controller.testSmtpSettings(req, res)
)

/**
 * GET /api/school-settings/social-login
 * Get social login OAuth credentials (secrets masked)
 */
router.get('/social-login', requireRole('admin', 'super_admin'), (req, res) =>
  controller.getSocialLoginSettings(req, res)
)

/**
 * PUT /api/school-settings/social-login
 * Save social login OAuth credentials
 */
router.put('/social-login', requireRole('admin', 'super_admin'), (req, res) =>
  controller.updateSocialLoginSettings(req, res)
)

/**
 * GET /api/school-settings/pdf-header-footer
 * Get PDF header/footer settings
 */
router.get('/pdf-header-footer', requireRole('admin', 'super_admin'), (req, res) =>
  controller.getPdfHeaderFooter(req, res)
)

/**
 * PUT /api/school-settings/pdf-header-footer
 * Save PDF header/footer settings
 */
router.put('/pdf-header-footer', requireRole('admin', 'super_admin'), (req, res) =>
  controller.updatePdfHeaderFooter(req, res)
)

/**
 * POST /api/school-settings/convert-names-titlecase
 * Convert profile name fields to titlecase for the current campus.
 * Mirrors RosarioSIS "Convert Names To Titlecase" plugin.
 * Admin only — destructive one-time operation.
 */
router.post('/convert-names-titlecase', requireRole('admin', 'super_admin'), (req, res) =>
  controller.convertNamesTitlecase(req, res)
)

/**
 * GET /api/school-settings/custom-menu-order
 * Get sidebar section order for the current school/campus
 */
router.get('/custom-menu-order', requireRole('admin', 'super_admin'), (req, res) =>
  controller.getCustomMenuOrder(req, res)
)

/**
 * PUT /api/school-settings/custom-menu-order
 * Save sidebar section order. Body: { role, order: string[] }
 */
router.put('/custom-menu-order', requireRole('admin', 'super_admin'), (req, res) =>
  controller.updateCustomMenuOrder(req, res)
)

export default router
