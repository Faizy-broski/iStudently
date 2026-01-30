import express from 'express'
import * as assignmentsController from '../controllers/assignments.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireTeacher } from '../middlewares/role.middleware'

const router = express.Router()

// All routes require authentication
router.use(authenticate)

// ============================================================================
// ASSIGNMENT ROUTES
// ============================================================================

// Get assignments (by teacher or section)
router.get('/teacher', requireTeacher, assignmentsController.getTeacherAssignments)
router.get('/section', assignmentsController.getSectionAssignments)

// CRUD operations
router.get('/:id', assignmentsController.getAssignment)
router.post('/', requireTeacher, assignmentsController.createAssignment)
router.put('/:id', requireTeacher, assignmentsController.updateAssignment)
router.delete('/:id', requireTeacher, assignmentsController.deleteAssignment)

// ============================================================================
// SUBMISSION ROUTES
// ============================================================================

// Get all submissions for an assignment
router.get('/:id/submissions', assignmentsController.getAssignmentSubmissions)

// Get assignment stats
router.get('/:id/stats', assignmentsController.getAssignmentStats)

// Submit assignment (students)
router.post('/submit', assignmentsController.submitAssignment)

// Grade submission (teachers)
router.put('/submissions/:id/grade', requireTeacher, assignmentsController.gradeSubmission)

export default router
