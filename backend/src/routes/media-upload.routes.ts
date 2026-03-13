import { Router } from 'express'
import multer from 'multer'
import { authenticate } from '../middlewares/auth.middleware'
import { uploadMediaRecording } from '../controllers/media-upload.controller'

const router = Router()

// Store uploaded file in memory (we stream it straight to Supabase Storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB hard cap
})

router.use(authenticate)

// POST /api/media/upload  — field name must be "file"
router.post('/upload', upload.single('file'), uploadMediaRecording)

export default router
