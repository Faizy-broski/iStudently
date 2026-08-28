import { Router } from 'express'
import * as ctrl from '../controllers/training-prescription.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireInspector, requireAdmin, requireTeacher, requireRole } from '../middlewares/role.middleware'

const router = Router()
router.use(authenticate)

// Teacher: own prescriptions + self-reported completion
router.get('/mine', requireTeacher, ctrl.listMyPrescriptions)
router.post('/:id/complete', requireRole('teacher', 'inspector', 'admin'), ctrl.completePrescription)

// Inspector: create manual prescriptions, view per-evaluation, assign/dismiss
router.post('/evaluation/:evaluationId', requireInspector, ctrl.createManualPrescription)
router.get('/evaluation/:evaluationId', requireRole('inspector', 'admin'), ctrl.listPrescriptionsForEvaluation)
router.post('/:id/assign', requireRole('inspector', 'admin'), ctrl.assignPrescription)
router.post('/:id/dismiss', requireRole('inspector', 'admin'), ctrl.dismissPrescription)

// Available training sessions to link (inspector/admin, campus-scoped)
router.get('/sessions/school/:schoolId', requireRole('inspector', 'admin'), ctrl.listAvailableTrainingSessions)

// Admin: every prescription across a campus
router.get('/school/:schoolId', requireAdmin, ctrl.listPrescriptionsForSchool)

export default router
