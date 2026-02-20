import express from 'express'
import * as gradebookController from '../controllers/gradebook.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireTeacher, requireAdmin } from '../middlewares/role.middleware'

const router = express.Router()

// All routes require authentication
router.use(authenticate)

// ============================================================================
// ASSIGNMENT TYPES
// ============================================================================

// GET /gradebook/assignment-types?course_period_id=
router.get('/assignment-types', gradebookController.getAssignmentTypes)

// GET /gradebook/assignment-types/course/:courseId
router.get('/assignment-types/course/:courseId', gradebookController.getAssignmentTypesByCourse)

// POST /gradebook/assignment-types (teacher)
router.post('/assignment-types', requireTeacher, gradebookController.createAssignmentType)

// PUT /gradebook/assignment-types/:id (teacher)
router.put('/assignment-types/:id', requireTeacher, gradebookController.updateAssignmentType)

// DELETE /gradebook/assignment-types/:id (teacher)
router.delete('/assignment-types/:id', requireTeacher, gradebookController.deleteAssignmentType)

// ============================================================================
// ASSIGNMENTS
// ============================================================================

// GET /gradebook/assignments?course_period_id=&assignment_type_id=
router.get('/assignments', gradebookController.getAssignments)

// GET /gradebook/assignments/:id
router.get('/assignments/:id', gradebookController.getAssignmentById)

// POST /gradebook/assignments (teacher)
router.post('/assignments', requireTeacher, gradebookController.createAssignment)

// PUT /gradebook/assignments/:id (teacher)
router.put('/assignments/:id', requireTeacher, gradebookController.updateAssignment)

// DELETE /gradebook/assignments/:id (teacher)
router.delete('/assignments/:id', requireTeacher, gradebookController.deleteAssignment)

// ============================================================================
// GRADES
// ============================================================================

// GET /gradebook/grades/assignment/:assignmentId
router.get('/grades/assignment/:assignmentId', gradebookController.getGradesForAssignment)

// GET /gradebook/grades/student/:studentId?course_period_id=
router.get('/grades/student/:studentId', gradebookController.getGradesForStudent)

// POST /gradebook/grades (teacher - single grade entry)
router.post('/grades', requireTeacher, gradebookController.enterGrade)

// POST /gradebook/grades/bulk (teacher - bulk grade entry)
router.post('/grades/bulk', requireTeacher, gradebookController.bulkEnterGrades)

// POST /gradebook/grades/import (teacher - import from CSV/Excel)
router.post('/grades/import', requireTeacher, gradebookController.importGradebookGrades)

// ============================================================================
// CALCULATIONS & VIEWS
// ============================================================================

// GET /gradebook/view?course_period_id=&section_id= (full gradebook matrix)
router.get('/view', gradebookController.getGradebookView)

// GET /gradebook/average/:studentId?course_period_id=
router.get('/average/:studentId', gradebookController.calculateStudentAverage)

// GET /gradebook/anomalous?course_period_id=&threshold=
router.get('/anomalous', gradebookController.getAnomalousGrades)

// ============================================================================
// CONFIG
// ============================================================================

// GET /gradebook/config?school_id=&course_period_id=
router.get('/config', gradebookController.getConfig)

// POST /gradebook/config (admin)
router.post('/config', requireAdmin, gradebookController.setConfig)

// ============================================================================
// PROGRESS REPORTS (batch generation for printing)
// ============================================================================

// POST /gradebook/progress-reports
router.post('/progress-reports', requireAdmin, gradebookController.generateProgressReports)

export default router
