import { Router } from 'express'
import { EventController } from '../controllers/event.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireRole } from '../middlewares/role.middleware'

const router = Router()
const eventController = new EventController()

// All routes require authentication
router.use(authenticate)

/**
 * GET /api/events/range
 * Get events for a specific date range (for calendar view)
 * All authenticated users can access
 */
router.get('/range', (req, res) => 
  eventController.getEventsForRange(req, res)
)

/**
 * GET /api/events/upcoming
 * Get upcoming events (next 30 days)
 * All authenticated users can access
 */
router.get('/upcoming', (req, res) => 
  eventController.getUpcomingEvents(req, res)
)

/**
 * GET /api/events/categories/counts
 * Get event counts by category
 * Admin and teacher can access
 */
router.get('/categories/counts', requireRole('admin', 'teacher'), (req, res) => 
  eventController.getCategoryCounts(req, res)
)

/**
 * PATCH /api/events/hijri-offset
 * Update Hijri offset for a category
 * Only admin can access
 */
router.patch('/hijri-offset', requireRole('admin'), (req, res) => 
  eventController.updateHijriOffset(req, res)
)

/**
 * GET /api/events/:id
 * Get a single event by ID
 * All authenticated users can access
 */
router.get('/:id', (req, res) => 
  eventController.getEventById(req, res)
)

/**
 * GET /api/events
 * Get all events with optional filters
 * All authenticated users can access
 */
router.get('/', (req, res) => 
  eventController.getEvents(req, res)
)

/**
 * POST /api/events
 * Create a new event
 * Only admin can create events
 */
router.post('/', requireRole('admin'), (req, res) => 
  eventController.createEvent(req, res)
)

/**
 * PUT /api/events/:id
 * Update an event
 * Only admin can update events
 */
router.put('/:id', requireRole('admin'), (req, res) => 
  eventController.updateEvent(req, res)
)

/**
 * DELETE /api/events/:id
 * Delete an event
 * Only admin can delete events
 */
router.delete('/:id', requireRole('admin'), (req, res) => 
  eventController.deleteEvent(req, res)
)

export default router
