import { Router } from 'express'
import multer from 'multer'
import { authenticate } from '../middlewares/auth.middleware'
import { uploadMediaRecording, uploadImageAsset, uploadMessageAttachment, uploadLibraryFile } from '../controllers/media-upload.controller'
import { requireRole } from '../middlewares/role.middleware'

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

// POST /api/media/upload-library-file  — library covers/documents (field "file", body kind + category_id)
router.post('/upload-library-file', requireRole('admin', 'librarian'), upload.single('file'), uploadLibraryFile)

export default router
