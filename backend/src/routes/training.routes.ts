import { Router } from 'express'
import { trainingController } from '../controllers/training.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireRole } from '../middlewares/role.middleware'
import type { AuthRequest } from '../middlewares/auth.middleware'

// ─── Admin Router (requires authentication) ────────────────────────────────

const router = Router()
router.use(authenticate)

// Sessions
router.get('/sessions', requireRole('admin'), (req, res) =>
  trainingController.listSessions(req as AuthRequest, res)
)
router.post('/sessions', requireRole('admin'), (req, res) =>
  trainingController.createSession(req as AuthRequest, res)
)
router.get('/sessions/:id', requireRole('admin'), (req, res) =>
  trainingController.getSession(req as AuthRequest, res)
)
router.put('/sessions/:id', requireRole('admin'), (req, res) =>
  trainingController.updateSession(req as AuthRequest, res)
)
router.delete('/sessions/:id', requireRole('admin'), (req, res) =>
  trainingController.deleteSession(req as AuthRequest, res)
)
router.get('/sessions/:id/registrations', requireRole('admin'), (req, res) =>
  trainingController.listRegistrations(req as AuthRequest, res)
)
router.get('/sessions/:id/export', requireRole('admin'), (req, res) =>
  trainingController.exportCSV(req as AuthRequest, res)
)

// Registrations
router.put('/registrations/:id/attendance', requireRole('admin'), (req, res) =>
  trainingController.toggleAttendance(req as AuthRequest, res)
)
router.put('/registrations/:id/payment', requireRole('admin'), (req, res) =>
  trainingController.updatePaymentStatus(req as AuthRequest, res)
)
router.put('/registrations/:id/cancel', requireRole('admin'), (req, res) =>
  trainingController.cancelRegistration(req as AuthRequest, res)
)
router.put('/registrations/:id/promote', requireRole('admin'), (req, res) =>
  trainingController.promoteWaitlistRecord(req as AuthRequest, res)
)
router.delete('/registrations/:id', requireRole('admin'), (req, res) =>
  trainingController.hardDeleteRegistration(req as AuthRequest, res)
)

export default router

// ─── Public Router (no authentication) ────────────────────────────────────

const publicRouter = Router()

publicRouter.get('/:token', (req, res) =>
  trainingController.getPublicSession(req as AuthRequest, res)
)
publicRouter.get('/:token/student-lookup', (req, res) =>
  trainingController.lookupStudent(req as AuthRequest, res)
)
publicRouter.post('/:token/register', (req, res) =>
  trainingController.register(req as AuthRequest, res)
)

export { publicRouter as trainingPublicRouter }
