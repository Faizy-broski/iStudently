import { Router } from 'express'
import { ClassDiaryController } from '../controllers/class-diary.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireRole } from '../middlewares/role.middleware'

const router = Router()
const diaryController = new ClassDiaryController()

// All routes require authentication
router.use(authenticate)

/**
 * GET /api/class-diary/read
 * Get diary entries in read view (by date + optional filters)
 * All authenticated users can access
 */
router.get('/read', (req, res) =>
  diaryController.getDiaryReadView(req, res)
)

/**
 * GET /api/class-diary
 * Get all diary entries with optional filters
 * All authenticated users can access
 */
router.get('/', (req, res) =>
  diaryController.getDiaryEntries(req, res)
)

/**
 * GET /api/class-diary/:id
 * Get a single diary entry by ID
 */
router.get('/:id', (req, res) =>
  diaryController.getDiaryEntryById(req, res)
)

/**
 * POST /api/class-diary
 * Create a new diary entry
 * Only admin and teacher can create
 */
router.post('/', requireRole('admin', 'teacher'), (req, res) =>
  diaryController.createDiaryEntry(req, res)
)

/**
 * PUT /api/class-diary/:id
 * Update a diary entry
 * Only admin and teacher can update
 */
router.put('/:id', requireRole('admin', 'teacher'), (req, res) =>
  diaryController.updateDiaryEntry(req, res)
)

/**
 * DELETE /api/class-diary/:id
 * Delete a diary entry
 * Only admin and teacher can delete
 */
router.delete('/:id', requireRole('admin', 'teacher'), (req, res) =>
  diaryController.deleteDiaryEntry(req, res)
)

/**
 * PATCH /api/class-diary/:id/toggle-comments
 * Toggle comments on/off for a diary entry
 * Only admin and teacher can toggle
 */
router.patch('/:id/toggle-comments', requireRole('admin', 'teacher'), (req, res) =>
  diaryController.toggleComments(req, res)
)

/**
 * POST /api/class-diary/:id/files
 * Add a file attachment to a diary entry
 * Only admin and teacher can add files
 */
router.post('/:id/files', requireRole('admin', 'teacher'), (req, res) =>
  diaryController.addFile(req, res)
)

/**
 * DELETE /api/class-diary/files/:fileId
 * Remove a file attachment
 * Only admin and teacher can remove files
 */
router.delete('/files/:fileId', requireRole('admin', 'teacher'), (req, res) =>
  diaryController.removeFile(req, res)
)

/**
 * POST /api/class-diary/:id/comments
 * Add a comment to a diary entry
 * All authenticated users can comment (if comments enabled)
 */
router.post('/:id/comments', (req, res) =>
  diaryController.addComment(req, res)
)

/**
 * DELETE /api/class-diary/comments/:commentId
 * Delete a comment
 * Author or admin can delete
 */
router.delete('/comments/:commentId', (req, res) =>
  diaryController.deleteComment(req, res)
)

export default router
