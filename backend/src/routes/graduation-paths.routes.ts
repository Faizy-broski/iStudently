import express from 'express'
import * as gpController from '../controllers/graduation-paths.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireAdmin } from '../middlewares/role.middleware'

const router = express.Router()

// All routes require authentication
router.use(authenticate)

// ============================================================================
// GRADUATION PATHS CRUD
// ============================================================================

// GET  /graduation-paths              - List all paths for school
router.get('/', gpController.getGraduationPaths)

// GET  /graduation-paths/:id          - Get path by ID with relations
router.get('/:id', gpController.getGraduationPath)

// POST /graduation-paths              - Create path (admin)
router.post('/', requireAdmin, gpController.createGraduationPath)

// PUT  /graduation-paths/:id          - Update path (admin)
router.put('/:id', requireAdmin, gpController.updateGraduationPath)

// DELETE /graduation-paths/:id        - Delete path (admin)
router.delete('/:id', requireAdmin, gpController.deleteGraduationPath)

// ============================================================================
// GRADE LEVELS ASSIGNMENT
// ============================================================================

// GET  /graduation-paths/:id/grade-levels           - List assigned grade levels
router.get('/:id/grade-levels', gpController.getPathGradeLevels)

// POST /graduation-paths/:id/grade-levels           - Assign grade levels (admin)
router.post('/:id/grade-levels', requireAdmin, gpController.assignGradeLevels)

// DELETE /graduation-paths/:id/grade-levels/:gradeLevelId - Remove (admin)
router.delete('/:id/grade-levels/:gradeLevelId', requireAdmin, gpController.removeGradeLevel)

// ============================================================================
// SUBJECTS ASSIGNMENT
// ============================================================================

// GET  /graduation-paths/:id/subjects               - List assigned subjects
router.get('/:id/subjects', gpController.getPathSubjects)

// POST /graduation-paths/:id/subjects               - Assign subjects (admin)
router.post('/:id/subjects', requireAdmin, gpController.assignSubjects)

// PUT  /graduation-paths/:id/subjects/:subjectId    - Update credits (admin)
router.put('/:id/subjects/:subjectId', requireAdmin, gpController.updateSubjectCredits)

// DELETE /graduation-paths/:id/subjects/:subjectId  - Remove (admin)
router.delete('/:id/subjects/:subjectId', requireAdmin, gpController.removeSubject)

// ============================================================================
// STUDENTS ASSIGNMENT
// ============================================================================

// GET  /graduation-paths/:id/students               - List assigned students
router.get('/:id/students', gpController.getPathStudents)

// POST /graduation-paths/:id/students               - Assign students (admin)
router.post('/:id/students', requireAdmin, gpController.assignStudents)

// DELETE /graduation-paths/:id/students/:studentId  - Remove (admin)
router.delete('/:id/students/:studentId', requireAdmin, gpController.removeStudent)

// GET  /graduation-paths/:id/students/:studentId/credits - Student credits detail
router.get('/:id/students/:studentId/credits', gpController.getStudentCredits)

export default router
