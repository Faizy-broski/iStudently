import { Router } from 'express'
import * as pendingSignupsController from '../controllers/pending-signups.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireAdmin } from '../middlewares/role.middleware'

const router = Router()

router.use(authenticate)

// GET /api/pending-signups/count — pending count for badge
router.get('/count', requireAdmin, pendingSignupsController.getPendingCount)

// GET /api/pending-signups — list with filters (?status=pending&role=teacher&page=1&limit=20)
router.get('/', requireAdmin, pendingSignupsController.getPendingSignups)

// GET /api/pending-signups/:id — single pending signup detail
router.get('/:id', requireAdmin, pendingSignupsController.getPendingSignupById)

// POST /api/pending-signups/:id/approve — create real account and mark approved
router.post('/:id/approve', requireAdmin, pendingSignupsController.approvePendingSignup)

// POST /api/pending-signups/:id/reject — mark rejected with optional reason
router.post('/:id/reject', requireAdmin, pendingSignupsController.rejectPendingSignup)

export default router
