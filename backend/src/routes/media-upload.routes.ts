import { Router } from 'express'
import multer from 'multer'
import { authenticate } from '../middlewares/auth.middleware'
import { uploadMediaRecording, uploadImageAsset, uploadMessageAttachment } from '../controllers/media-upload.controller'

const router = Router()

// Store uploaded file in memory (we stream it straight to Supabase Storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB hard cap
})

router.use(authenticate)

// POST /api/media/upload  — field name must be "file"
router.post('/upload', upload.single('file'), uploadMediaRecording)

// POST /api/media/upload-image  — field name must be "file"
router.post('/upload-image', upload.single('file'), uploadImageAsset)

// POST /api/media/upload-attachment  — field name must be "file"
router.post('/upload-attachment', upload.single('file'), uploadMessageAttachment)

export default router
