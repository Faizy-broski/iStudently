import { Router } from 'express'
import { ClassDiaryController } from '../controllers/class-diary.controller'
import { NextFunction, Response } from 'express'
import { supabase } from '../config/supabase'
import { authenticate, AuthRequest } from '../middlewares/auth.middleware'
import { requireOwnRow, requireSelfTeacherId } from '../middlewares/own-course-period.middleware'
import { requireRole } from '../middlewares/role.middleware'
import { requireBodyRowsInSchoolFamily, requireRequestSchoolsInFamily, requireRowInSchoolFamily } from '../middlewares/row-school-scope.middleware'
import { campusIdsAllowed } from '../utils/campus-validation'

const router = Router()
const diaryController = new ClassDiaryController()

// All routes require authentication
router.use(authenticate)
router.use(requireRequestSchoolsInFamily)

// Entries, files and comments must belong to the caller's school family; teachers may only change
// their own entries (admins: any of the family).
const entryRow = requireRowInSchoolFamily('class_diary_entries')
const ownEntry = requireOwnRow('class_diary_entries')
const fileRow = requireRowInSchoolFamily('class_diary_files', 'fileId', 'class_diary_entries!inner(school_id)')
const ownFile = requireOwnRow('class_diary_files', 'fileId', 'params', 'class_diary_entries!inner(teacher_id)')

/** A comment may be deleted by its author, an admin of the school family, or the entry's teacher. */
async function canDeleteComment(req: AuthRequest, res: Response, next: NextFunction) {
  const role = req.profile?.role
  if (role === 'super_admin') return next()
  try {
    const { data, error } = await supabase
      .from('class_diary_comments')
      .select('author_id, entry:class_diary_entries!inner(school_id, teacher_id)')
      .eq('id', req.params.commentId)
      .maybeSingle()
    if (error) throw error
    const row = data as unknown as { author_id: string; entry: { school_id: string; teacher_id: string | null } } | null
    if (!row || !(await campusIdsAllowed(req.profile?.school_id, [row.entry.school_id]))) return res.status(404).json({ success: false, error: 'Not found' })
    const staffId = (req.profile as { staff_id?: string | null }).staff_id
    if (row.author_id === req.profile?.id || role === 'admin' || (role === 'teacher' && row.entry.teacher_id === staffId)) return next()
    return res.status(403).json({ success: false, error: 'Access denied' })
  } catch (err) {
    console.error('Diary comment access check failed:', err)
    return res.status(503).json({ success: false, retryable: true, error: 'Could not verify access' })
  }
}

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
router.get('/:id', entryRow, (req, res) =>
  diaryController.getDiaryEntryById(req, res)
)

/**
 * POST /api/class-diary
 * Create a new diary entry
 * Only admin and teacher can create
 */
router.post('/', requireRole('admin', 'teacher'), requireBodyRowsInSchoolFamily('staff', 'teacher_id'), requireSelfTeacherId('body'), requireBodyRowsInSchoolFamily('sections', 'section_id'), (req, res) =>
  diaryController.createDiaryEntry(req, res)
)

/**
 * PUT /api/class-diary/:id
 * Update a diary entry
 * Only admin and teacher can update
 */
router.put('/:id', requireRole('admin', 'teacher'), entryRow, ownEntry, (req, res) =>
  diaryController.updateDiaryEntry(req, res)
)

/**
 * DELETE /api/class-diary/:id
 * Delete a diary entry
 * Only admin and teacher can delete
 */
router.delete('/:id', requireRole('admin', 'teacher'), entryRow, ownEntry, (req, res) =>
  diaryController.deleteDiaryEntry(req, res)
)

/**
 * PATCH /api/class-diary/:id/toggle-comments
 * Toggle comments on/off for a diary entry
 * Only admin and teacher can toggle
 */
router.patch('/:id/toggle-comments', requireRole('admin', 'teacher'), entryRow, ownEntry, (req, res) =>
  diaryController.toggleComments(req, res)
)

/**
 * POST /api/class-diary/:id/files
 * Add a file attachment to a diary entry
 * Only admin and teacher can add files
 */
router.post('/:id/files', requireRole('admin', 'teacher'), entryRow, ownEntry, (req, res) =>
  diaryController.addFile(req, res)
)

/**
 * DELETE /api/class-diary/files/:fileId
 * Remove a file attachment
 * Only admin and teacher can remove files
 */
router.delete('/files/:fileId', requireRole('admin', 'teacher'), fileRow, ownFile, (req, res) =>
  diaryController.removeFile(req, res)
)

/**
 * POST /api/class-diary/:id/comments
 * Add a comment to a diary entry
 * All authenticated users can comment (if comments enabled)
 */
router.post('/:id/comments', entryRow, (req, res) =>
  diaryController.addComment(req, res)
)

/**
 * DELETE /api/class-diary/comments/:commentId
 * Delete a comment
 * Author or admin can delete
 */
router.delete('/comments/:commentId', canDeleteComment, (req, res) =>
  diaryController.deleteComment(req, res)
)

export default router
