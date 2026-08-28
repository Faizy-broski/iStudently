import { Router } from 'express'
import * as ctrl from '../controllers/inspection-evaluation.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireInspector, requireTeacher, requireRole } from '../middlewares/role.middleware'

const router = Router()
router.use(authenticate)

// Inspector: create/score/submit
router.post('/', requireInspector, ctrl.getOrCreateDraftEvaluation)
router.post('/:id/scores', requireInspector, ctrl.saveScore)
router.post('/:id/submit', requireInspector, ctrl.submitEvaluation)
router.post('/:id/evidence', requireInspector, ctrl.addEvidence)
router.delete('/evidence/:evidenceId', requireInspector, ctrl.removeEvidence)

// Grade sampling helpers (inspector, for the observe screen)
router.get('/course-periods/teacher/:teacherId', requireInspector, ctrl.listCoursePeriodsForTeacher)
router.get('/grade-sample/:coursePeriodId', requireInspector, ctrl.getGradeSampleForComparison)

// Teacher: read own submitted evaluation for a visit
router.get('/teacher/visit/:visitId', requireTeacher, ctrl.getEvaluationForTeacher)

// Shared (route-level role check here; per-evaluation campus/ownership
// authorization is enforced in the service layer on top of this)
router.get('/visit/:visitId', requireRole('inspector', 'admin'), ctrl.listEvaluationsForVisit)
router.get('/evidence/:evidenceId/signed-url', requireRole('inspector', 'admin', 'teacher'), ctrl.getEvidenceSignedUrl)
router.get('/:id', requireRole('inspector', 'admin', 'teacher'), ctrl.getEvaluation)

export default router
