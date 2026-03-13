import { Router } from 'express'
import { authenticate } from '../middlewares/auth.middleware'
import * as icalController from '../controllers/ical.controller'

const router = Router()

/**
 * GET /api/ical/link
 * Authenticated — generates a signed subscribe URL for the calling user.
 * Query: type (events|schedule), campus_id?
 */
router.get('/ical/link', authenticate, icalController.getLink)

/**
 * GET /api/ical/subscribe/:token
 * Public — streams .ics file. Token is validated server-side via HMAC.
 */
router.get('/ical/subscribe/:token', icalController.subscribe)

export default router
