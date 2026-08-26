import { Router } from 'express'
import multer from 'multer'
import { authenticate } from '../middlewares/auth.middleware'
import { requireRole, requireSuperAdmin } from '../middlewares/role.middleware'
import {
  downloadTemplate,
  validate,
  commit,
  getJob,
  listJobs,
  rollback
} from '../controllers/school-data-import.controller'

const router = Router()

// In-memory storage — the workbook is parsed immediately (validate) and the
// buffer handed straight to the background job (commit); never written to
// disk. Same 25MB ceiling enforced again (defense in depth) in the controller.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }
})

router.use(authenticate)

/**
 * GET /api/school-data-import/template
 * Download the multi-tab workbook template (Grades, Sections, Subjects,
 * FeeCategories, FeeStructures, Teachers, Staff, Students, Parents, Invoices,
 * Payments). Admin only.
 */
router.get('/template', requireRole('admin'), downloadTemplate)

/**
 * POST /api/school-data-import/validate
 * Upload the filled-in workbook (field name "file") and run the dry-run
 * validation pass — no DB writes. Returns a token to pass to /commit.
 * Admin only.
 */
router.post('/validate', requireRole('admin'), upload.single('file'), validate)

/**
 * POST /api/school-data-import/commit
 * Confirm a previously-validated upload (by token) and start the background
 * import job. Admin only.
 */
router.post('/commit', requireRole('admin'), commit)

/**
 * GET /api/school-data-import/jobs
 * List this school's past/current import jobs (most recent first).
 * Admin only.
 */
router.get('/jobs', requireRole('admin'), listJobs)

/**
 * GET /api/school-data-import/jobs/:id
 * Poll a single job's status/progress/result. Admin only.
 */
router.get('/jobs/:id', requireRole('admin'), getJob)

/**
 * POST /api/school-data-import/jobs/:id/rollback
 * Delete every row this job created. Super admin only — this is a
 * destructive cleanup action, the same trust level as the existing
 * bulk-delete-students tool it mirrors.
 */
router.post('/jobs/:id/rollback', requireSuperAdmin, rollback)

export default router
