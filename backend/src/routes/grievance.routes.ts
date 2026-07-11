import { Router } from 'express'
import multer from 'multer'
import { GrievanceController } from '../controllers/grievance.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireAdmin } from '../middlewares/role.middleware'

const router = Router()
const grievanceController = new GrievanceController()

// Memory storage — the file is streamed straight to Supabase Storage from
// GrievanceService, never written to disk. The 25MB cap here is a hard
// defense-in-depth ceiling independent of each school's configurable
// grievance_settings.max_attachment_mb (enforced separately in the service).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
})

// All routes require authentication; fine-grained ownership/role checks happen
// in GrievanceService (mirrors the messaging module's approach).
router.use(authenticate)

router.get('/unread-count', (req, res) => grievanceController.getUnreadCount(req, res))
router.get('/categories', (req, res) => grievanceController.getCategories(req, res))
router.post('/categories', requireAdmin, (req, res) => grievanceController.createCategory(req, res))
router.put('/categories/:id', requireAdmin, (req, res) => grievanceController.updateCategory(req, res))
router.delete('/categories/:id', requireAdmin, (req, res) => grievanceController.deleteCategory(req, res))

router.get('/settings', requireAdmin, (req, res) => grievanceController.getSettings(req, res))
router.put('/settings', requireAdmin, (req, res) => grievanceController.updateSettings(req, res))

router.get('/dashboard', requireAdmin, (req, res) => grievanceController.getDashboardStats(req, res))
router.get('/report', requireAdmin, (req, res) => grievanceController.getReport(req, res))

router.get('/', (req, res) => grievanceController.listGrievances(req, res))
router.post('/', (req, res) => grievanceController.createGrievance(req, res))

router.get('/:id', (req, res) => grievanceController.getGrievance(req, res))
router.post('/:id/comments', (req, res) => grievanceController.addComment(req, res))
router.post('/:id/attachments', (req, res) => grievanceController.uploadAttachments(req, res))
router.post('/:id/attachments/upload', upload.single('file'), (req, res) => grievanceController.uploadAttachmentFile(req, res))
router.get('/:id/attachments/:attachmentId/url', (req, res) => grievanceController.getAttachmentUrl(req, res))
router.put('/:id/status', (req, res) => grievanceController.updateStatus(req, res))
router.post('/:id/assign', requireAdmin, (req, res) => grievanceController.assignGrievance(req, res))
router.post('/:id/escalate', (req, res) => grievanceController.escalateGrievance(req, res))
router.post('/:id/reopen', (req, res) => grievanceController.reopenGrievance(req, res))
router.post('/:id/feedback', (req, res) => grievanceController.submitFeedback(req, res))

export default router
