import { Router } from 'express'
import * as scheduleRequestsController from '../controllers/schedule-requests.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireAdmin } from '../middlewares/role.middleware'
import { requireBodyRowsInSchoolFamily, requireRowInSchoolFamily } from '../middlewares/row-school-scope.middleware'
import { requireOwnStudent } from '../middlewares/student-access.middleware'

const router = Router()

// All routes require authentication
router.use(authenticate)

// Requests, templates, students and courses addressed by id must belong to the caller's school family.
const requestRow = requireRowInSchoolFamily('schedule_requests')
const templateRow = requireRowInSchoolFamily('timetable_templates')
const bodyStudent = requireBodyRowsInSchoolFamily('students', 'student_id')
const bodyStudents = requireBodyRowsInSchoolFamily('students', 'student_ids')
const bodyCourse = requireBodyRowsInSchoolFamily('courses', 'course_id')
// Students list and request courses only for themselves, parents only for their children.
const ownQueryStudent = requireOwnStudent((req) => req.query.student_id, { required: true })
const ownBodyStudent = requireOwnStudent((req) => req.body?.student_id)
// "With" / "without" teacher and period preferences must be the school's own.
const bodyPrefs = [
  requireBodyRowsInSchoolFamily('staff', (b) => [b?.with_teacher_id, b?.not_teacher_id]),
  requireBodyRowsInSchoolFamily('periods', (b) => [b?.with_period_id, b?.not_period_id]),
]

// ============================================================================
// SCHEDULE REQUESTS
// ============================================================================

// GET /schedule-requests                    - List requests (admin, or filtered by student)
router.get('/', ownQueryStudent, scheduleRequestsController.getRequests)

// POST /schedule-requests                   - Create a request
router.post('/', bodyStudent, ownBodyStudent, bodyCourse, ...bodyPrefs, scheduleRequestsController.createRequest)

// PUT /schedule-requests/:id                - Update a request (admin)
router.put('/:id', requireAdmin, requestRow, ...bodyPrefs, scheduleRequestsController.updateRequest)

// DELETE /schedule-requests/:id             - Delete a request (admin)
router.delete('/:id', requireAdmin, requestRow, scheduleRequestsController.deleteRequest)

// POST /schedule-requests/mass              - Mass create requests (admin)
router.post('/mass', requireAdmin, bodyStudents, bodyCourse, ...bodyPrefs, scheduleRequestsController.massCreateRequests)

// ============================================================================
// AUTO-SCHEDULER
// ============================================================================

// POST /schedule-requests/run-scheduler     - Run the auto-scheduler (admin)
router.post('/run-scheduler', requireAdmin, scheduleRequestsController.runScheduler)

// ============================================================================
// TIMETABLE TEMPLATES
// ============================================================================

// GET /schedule-requests/templates               - List templates
router.get('/templates', scheduleRequestsController.getTemplates)

// POST /schedule-requests/templates              - Create template
router.post('/templates', requireAdmin, scheduleRequestsController.createTemplate)

// POST /schedule-requests/templates/from-section - Save section as template
router.post('/templates/from-section', requireAdmin, scheduleRequestsController.saveTemplateFromSection)

// POST /schedule-requests/templates/apply        - Apply template to section
router.post('/templates/apply', requireAdmin, scheduleRequestsController.applyTemplate)

// DELETE /schedule-requests/templates/:id        - Delete template
router.delete('/templates/:id', requireAdmin, templateRow, scheduleRequestsController.deleteTemplate)

export default router
