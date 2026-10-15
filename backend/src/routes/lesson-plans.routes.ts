import { Router } from 'express'
import { LessonPlansController } from '../controllers/lesson-plans.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireRole } from '../middlewares/role.middleware'
import { requireBodyRowsInSchoolFamily, requireRowInSchoolFamily } from '../middlewares/row-school-scope.middleware'

const router = Router()
const controller = new LessonPlansController()

// All routes require authentication
router.use(authenticate)

// Lessons, their files, and the course period / teacher in a body must belong to the caller's school
// family (before, any signed-in user could read, change or delete another school's lessons by id).
const lessonRow = requireRowInSchoolFamily('lesson_plan_lessons')
const fileRow = requireRowInSchoolFamily('lesson_plan_files', 'fileId', 'lesson:lesson_plan_lessons(school_id)')
const bodyRefs = [requireBodyRowsInSchoolFamily('course_periods', 'course_period_id'), requireBodyRowsInSchoolFamily('staff', 'teacher_id')]
const queryCp = requireRowInSchoolFamily('course_periods', 'course_period_id', 'school_id', 'query')

/**
 * GET /api/lesson-plans/summary
 * Get lesson plan summary grouped by course period
 * All authenticated users can access
 */
router.get('/summary', queryCp, (req, res) =>
  controller.getLessonPlanSummary(req, res)
)

/**
 * GET /api/lesson-plans
 * Get all lesson plans with optional filters
 * All authenticated users can access
 */
router.get('/', queryCp, (req, res) =>
  controller.getLessons(req, res)
)

/**
 * GET /api/lesson-plans/:id
 * Get a single lesson plan by ID
 */
router.get('/:id', lessonRow, (req, res) =>
  controller.getLessonById(req, res)
)

/**
 * POST /api/lesson-plans
 * Create a new lesson plan
 * Only admin and teacher can create
 */
router.post('/', requireRole('admin', 'teacher'), ...bodyRefs, (req, res) =>
  controller.createLesson(req, res)
)

/**
 * PUT /api/lesson-plans/:id
 * Update a lesson plan
 * Only admin and teacher can update
 */
router.put('/:id', requireRole('admin', 'teacher'), lessonRow, ...bodyRefs, (req, res) =>
  controller.updateLesson(req, res)
)

/**
 * DELETE /api/lesson-plans/:id
 * Delete a lesson plan
 * Only admin and teacher can delete
 */
router.delete('/:id', requireRole('admin', 'teacher'), lessonRow, (req, res) =>
  controller.deleteLesson(req, res)
)

/**
 * PUT /api/lesson-plans/:id/items
 * Replace all items for a lesson
 * Only admin and teacher can modify items
 */
router.put('/:id/items', requireRole('admin', 'teacher'), lessonRow, (req, res) =>
  controller.replaceItems(req, res)
)

/**
 * POST /api/lesson-plans/:id/files
 * Add a file attachment to a lesson
 * Only admin and teacher can add files
 */
router.post('/:id/files', requireRole('admin', 'teacher'), lessonRow, (req, res) =>
  controller.addFile(req, res)
)

/**
 * DELETE /api/lesson-plans/files/:fileId
 * Remove a file attachment
 * Only admin and teacher can remove files
 */
router.delete('/files/:fileId', requireRole('admin', 'teacher'), fileRow, (req, res) =>
  controller.removeFile(req, res)
)

export default router
