import { Router } from 'express'
import { authenticate } from '../middlewares/auth.middleware'
import { requireAdmin, requireRole } from '../middlewares/role.middleware'
import * as ctrl from '../controllers/performance.controller'

const router = Router()

router.use(authenticate)

// ── Catalog (admin-only write, read by teacher/staff/admin) ──────────────────
router.get('/catalog',      requireRole('teacher', 'staff', 'admin', 'super_admin'), ctrl.getCatalog)
router.post('/catalog',     requireAdmin, ctrl.createAction)
router.put('/catalog/:id',  requireAdmin, ctrl.updateAction)
router.delete('/catalog/:id', requireAdmin, ctrl.deleteAction)

// ── Incident logs (admin-only) ───────────────────────────────────────────────
router.get('/logs',        requireAdmin, ctrl.getLogs)
router.get('/logs/:id',    requireAdmin, ctrl.getLogById)
router.post('/logs',       requireAdmin, ctrl.createLog)
router.delete('/logs/:id', requireAdmin, ctrl.deleteLog)

// ── Scores ───────────────────────────────────────────────────────────────────
router.get('/score/:staffId', requireAdmin,                                          ctrl.getStaffScore)
router.get('/my-score',       requireRole('teacher', 'staff', 'admin', 'super_admin'), ctrl.getMyScore)

export default router
