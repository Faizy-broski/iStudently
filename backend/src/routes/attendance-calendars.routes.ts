import { Router } from 'express'
import { AttendanceCalendarsController } from '../controllers/attendance-calendars.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireRole } from '../middlewares/role.middleware'

const router = Router()
const controller = new AttendanceCalendarsController()

// All routes require authentication
router.use(authenticate)

// ---- Named Calendar CRUD ----

/**
 * GET /api/attendance-calendars
 * List all named calendars for the school
 */
router.get('/', (req, res) => controller.list(req, res))

/**
 * GET /api/attendance-calendars/:id
 * Get a single calendar
 */
router.get('/:id', (req, res) => controller.getById(req, res))

/**
 * POST /api/attendance-calendars
 * Create a new named calendar (admin only)
 */
router.post('/', requireRole('admin'), (req, res) => controller.create(req, res))

/**
 * PUT /api/attendance-calendars/:id
 * Update a named calendar (admin only)
 */
router.put('/:id', requireRole('admin'), (req, res) => controller.update(req, res))

/**
 * DELETE /api/attendance-calendars/:id
 * Delete a named calendar (admin only)
 */
router.delete('/:id', requireRole('admin'), (req, res) => controller.delete(req, res))

// ---- Calendar Days ----

/**
 * GET /api/attendance-calendars/:id/days
 * Get all days for a calendar (optional ?start_date=&end_date=)
 */
router.get('/:id/days', (req, res) => controller.getDays(req, res))

/**
 * PUT /api/attendance-calendars/:id/days/:dayId/toggle
 * Toggle a day's school day status
 */
router.put('/:id/days/:dayId/toggle', requireRole('admin'), (req, res) => controller.toggleDay(req, res))

/**
 * PUT /api/attendance-calendars/:id/days/:dayId
 * Update a calendar day (minutes, notes, etc.)
 */
router.put('/:id/days/:dayId', requireRole('admin'), (req, res) => controller.updateDay(req, res))

/**
 * POST /api/attendance-calendars/:id/regenerate
 * Regenerate all days for a calendar
 */
router.post('/:id/regenerate', requireRole('admin'), (req, res) => controller.regenerate(req, res))

/**
 * GET /api/attendance-calendars/:id/summary
 * Get summary stats for a calendar
 */
router.get('/:id/summary', (req, res) => controller.getSummary(req, res))

export default router
