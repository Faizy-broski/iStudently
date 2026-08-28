import { Router } from 'express'
import * as ctrl from '../controllers/inspection-report.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireInspector, requireAdmin, requireTeacher, requireRole } from '../middlewares/role.middleware'

const router = Router()
router.use(authenticate)

// Literal-segment routes registered before '/:id' — see inspection-visit.routes.ts's note.
router.get('/mine', requireTeacher, ctrl.listReportsForTeacher)
router.get('/inspector/mine', requireInspector, ctrl.listReportsForInspector)
router.get('/school/:schoolId', requireAdmin, ctrl.listReportsForSchool)
router.get('/evaluation/:evaluationId', requireRole('inspector', 'admin', 'teacher'), ctrl.getReportForEvaluation)

router.post('/', requireInspector, ctrl.getOrCreateReport)
router.get('/:id', requireRole('inspector', 'admin', 'teacher'), ctrl.getReport)
router.post('/:id/pdf', requireRole('inspector', 'admin', 'teacher'), ctrl.recordReportPdf)
router.get('/:id/pdf-url', requireRole('inspector', 'admin', 'teacher'), ctrl.getReportPdfSignedUrl)

export default router
