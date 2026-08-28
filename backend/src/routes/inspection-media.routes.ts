import { Router } from 'express'
import multer from 'multer'
import * as ctrl from '../controllers/inspection-media.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireInspector, requireRole } from '../middlewares/role.middleware'

const router = Router()

// Memory storage — streamed straight to Supabase Storage, never written to
// disk. Matches grievance.routes.ts's convention.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
})

router.use(authenticate)
router.post('/:evaluationId/upload', requireInspector, upload.single('file'), ctrl.uploadEvidence)
router.post('/reports/:reportId/upload', requireRole('inspector', 'admin', 'teacher'), upload.single('file'), ctrl.uploadReportPdf)

export default router
