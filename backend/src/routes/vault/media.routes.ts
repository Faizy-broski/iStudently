import { Router } from 'express'
import multer from 'multer'
import * as ctrl from '../../controllers/vault/media.controller'
import { authenticate } from '../../middlewares/auth.middleware'
import { requireVaultAccess } from '../../middlewares/vault-access.middleware'

const router = Router()

// Memory storage — streamed straight to Supabase Storage, never written to
// disk. Matches fina/media.routes.ts's convention. 50MB cap matches
// vault-media's bucket-level file_size_limit.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
})

router.use(authenticate)
router.use(requireVaultAccess)

router.post('/upload', upload.single('file'), ctrl.uploadAttachment)
router.get('/:recordId/attachments/:index', ctrl.getAttachment)

export default router
