import express from 'express'
import * as assignmentsController from '../controllers/assignments.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireTeacher } from '../middlewares/role.middleware'
import { requireBodyRowsInSchoolFamily, requireRowInSchoolFamily } from '../middlewares/row-school-scope.middleware'
import { requireOwnRow, requireSelfTeacherId } from '../middlewares/own-course-period.middleware'

const router = express.Router()

// Assignments and submissions addressed by id must belong to the caller's school family; reading a
// whole assignment's submissions or stats is for staff (students only see their own via the dashboard).
const assignmentRow = requireRowInSchoolFamily('assignments', 'id')
const submissionRow = requireRowInSchoolFamily('assignment_submissions', 'id')
// Teachers may only manage their own assignments (admins: any of the school family).
const ownAssignment = requireOwnRow('assignments')

// All routes require authentication
router.use(authenticate)

// ============================================================================
// ASSIGNMENT ROUTES
// ============================================================================

// Get assignments (by teacher or section)
router.get('/teacher', requireTeacher, requireRowInSchoolFamily('staff', 'teacher_id', 'school_id', 'query'), requireSelfTeacherId('query'), assignmentsController.getTeacherAssignments)
router.get('/section', assignmentsController.getSectionAssignments)

// CRUD operations
router.get('/:id', assignmentRow, assignmentsController.getAssignment)
router.post('/', requireTeacher, requireBodyRowsInSchoolFamily('staff', 'teacher_id'), requireSelfTeacherId('body'), requireBodyRowsInSchoolFamily('sections', 'section_id'), assignmentsController.createAssignment)
router.put('/:id', requireTeacher, assignmentRow, ownAssignment, requireSelfTeacherId('body'), assignmentsController.updateAssignment)
router.delete('/:id', requireTeacher, assignmentRow, ownAssignment, assignmentsController.deleteAssignment)

// ============================================================================
// SUBMISSION ROUTES
// ============================================================================

// Get all submissions for an assignment
router.get('/:id/submissions', requireTeacher, assignmentRow, ownAssignment, assignmentsController.getAssignmentSubmissions)

// Get assignment stats
router.get('/:id/stats', requireTeacher, assignmentRow, ownAssignment, assignmentsController.getAssignmentStats)

// Submit assignment (students)
router.post('/submit', assignmentsController.submitAssignment)

// Grade submission (teachers)
router.put('/submissions/:id/grade', requireTeacher, submissionRow, requireOwnRow('assignment_submissions', 'id', 'params', 'assignment:assignments!inner(teacher_id)'), assignmentsController.gradeSubmission)

export default router
