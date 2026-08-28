import { Router } from 'express'
import multer from 'multer'
import * as ctrl from '../../controllers/fina/media.controller'
import { authenticate } from '../../middlewares/auth.middleware'
import { finaEnforceScope } from '../../middlewares/fina-enforce-scope.middleware'
import { requireRole } from '../../middlewares/role.middleware'
import { createFinaRateLimit } from '../../middlewares/rate-limit.middleware'

const router = Router()

// Memory storage — streamed straight to Supabase Storage, never written to
// disk. Matches inspection-media.routes.ts's convention. 200MB cap covers
// video; media-pipeline.service.ts enforces a tighter 25MB cap for images.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 },
})

// super_admin excluded — spec §12: SYSADMIN has no Publish access, and
// uploading/tagging media directly feeds publishing.
const STAFF_ROLES = ['admin', 'media_officer', 'teacher'] as const

router.use(authenticate)
router.use(finaEnforceScope)
// spec §22: "rate limiting on media" — 300/hour per caller, matching the
// FINA_MEDIA_RATE_LIMIT env var from the approved plan.
router.use(createFinaRateLimit(60 * 60 * 1000, Number(process.env.FINA_MEDIA_RATE_LIMIT) || 300))

// Literal-segment routes before the generic '/:id/...' routes below.
router.get('/pending', requireRole(...STAFF_ROLES), ctrl.listPendingTagging)
router.get('/mine/ready', requireRole(...STAFF_ROLES), ctrl.listMyReadyMedia)
router.post('/upload', requireRole(...STAFF_ROLES), upload.single('file'), ctrl.uploadMedia)

router.get('/:id/tagging', requireRole(...STAFF_ROLES), ctrl.getMediaForTagging)
router.get('/:id/raw', requireRole(...STAFF_ROLES), ctrl.getRawMediaPreview)
router.post('/:id/face-tags', requireRole(...STAFF_ROLES), ctrl.addFaceTag)
router.delete('/:id/face-tags/:tagId', requireRole(...STAFF_ROLES), ctrl.removeFaceTag)
router.post('/:id/no-identifiable-students', requireRole(...STAFF_ROLES), ctrl.setNoIdentifiableStudents)
router.post('/:id/confirm-tagging', requireRole(...STAFF_ROLES), ctrl.confirmTagging)

// Gate-protected — open to any authenticated Al-Fina' role; the gate itself
// (consent-gate.service.ts) decides full/blurred/denied per caller.
router.get('/:id/:variant', ctrl.getMediaVariant)

export default router
