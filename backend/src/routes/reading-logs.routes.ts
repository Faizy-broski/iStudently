import { Router } from 'express'
import { readingLogsController } from '../controllers/reading-logs.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireRole } from '../middlewares/role.middleware'

const router = Router()

router.use(authenticate)

// Student submits a new reading log
router.post(
  '/',
  requireRole('student'),
  (req, res) => readingLogsController.create(req as any, res)
)

// Student attaches audio path after upload
router.patch(
  '/:id/audio',
  requireRole('student'),
  (req, res) => readingLogsController.setAudio(req as any, res)
)

// Student reads their own logs
router.get(
  '/my',
  requireRole('student'),
  (req, res) => readingLogsController.getMine(req as any, res)
)

// Teacher / admin / librarian views all school logs
router.get(
  '/',
  requireRole('admin', 'teacher', 'librarian'),
  (req, res) => readingLogsController.getSchoolLogs(req as any, res)
)

export default router
