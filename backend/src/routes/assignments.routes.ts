import express from 'express'
import * as assignmentsController from '../controllers/assignments.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireTeacher } from '../middlewares/role.middleware'
import { requireRowInSchoolFamily } from '../middlewares/row-school-scope.middleware'

const router = express.Router()

// Assignments and submissions addressed by id must belong to the caller's school family; reading a
// whole assignment's submissions or stats is for staff (students only see their own via the dashboard).
const assignmentRow = requireRowInSchoolFamily('assignments', 'id')
const submissionRow = requireRowInSchoolFamily('assignment_submissions', 'id')

// All routes require authentication
router.use(authenticate)

// ============================================================================
// ASSIGNMENT ROUTES
// ============================================================================

// Get assignments (by teacher or section)
router.get('/teacher', requireTeacher, assignmentsController.getTeacherAssignments)
router.get('/section', assignmentsController.getSectionAssignments)

// CRUD operations
router.get('/:id', assignmentRow, assignmentsController.getAssignment)
router.post('/', requireTeacher, assignmentsController.createAssignment)
router.put('/:id', requireTeacher, assignmentRow, assignmentsController.updateAssignment)
router.delete('/:id', requireTeacher, assignmentRow, assignmentsController.deleteAssignment)

// ============================================================================
// SUBMISSION ROUTES
// ============================================================================

// Get all submissions for an assignment
router.get('/:id/submissions', requireTeacher, assignmentRow, assignmentsController.getAssignmentSubmissions)

// Get assignment stats
router.get('/:id/stats', requireTeacher, assignmentRow, assignmentsController.getAssignmentStats)

// Submit assignment (students)
router.post('/submit', assignmentsController.submitAssignment)

// Grade submission (teachers)
router.put('/submissions/:id/grade', requireTeacher, submissionRow, assignmentsController.gradeSubmission)

export default router
