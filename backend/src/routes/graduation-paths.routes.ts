import express from 'express'
import * as gpController from '../controllers/graduation-paths.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireAdmin } from '../middlewares/role.middleware'
import { requireBodyRowsInSchoolFamily, requireRowInSchoolFamily } from '../middlewares/row-school-scope.middleware'

const router = express.Router()

// All routes require authentication
router.use(authenticate)

// Paths and the grade levels, subjects and students assigned to them must belong to the caller's
// school family (before, any signed-in user could read or change another school's path by id).
const pathRow = requireRowInSchoolFamily('graduation_paths')
const studentParam = requireRowInSchoolFamily('students', 'studentId')
const bodyGrades = requireBodyRowsInSchoolFamily('grade_levels', 'grade_level_ids')
const bodySubjects = requireBodyRowsInSchoolFamily('subjects', (b) => (Array.isArray(b?.subjects) ? b.subjects.map((x: any) => x?.subject_id) : []))
const bodyStudents = requireBodyRowsInSchoolFamily('students', 'student_ids')

// ============================================================================
// GRADUATION PATHS CRUD
// ============================================================================

// GET  /graduation-paths              - List all paths for school
router.get('/', gpController.getGraduationPaths)

// GET  /graduation-paths/:id          - Get path by ID with relations
router.get('/:id', pathRow, gpController.getGraduationPath)

// POST /graduation-paths              - Create path (admin)
router.post('/', requireAdmin, gpController.createGraduationPath)

// PUT  /graduation-paths/:id          - Update path (admin)
router.put('/:id', pathRow, requireAdmin, gpController.updateGraduationPath)

// DELETE /graduation-paths/:id        - Delete path (admin)
router.delete('/:id', pathRow, requireAdmin, gpController.deleteGraduationPath)

// ============================================================================
// GRADE LEVELS ASSIGNMENT
// ============================================================================

// GET  /graduation-paths/:id/grade-levels           - List assigned grade levels
router.get('/:id/grade-levels', pathRow, gpController.getPathGradeLevels)

// POST /graduation-paths/:id/grade-levels           - Assign grade levels (admin)
router.post('/:id/grade-levels', pathRow, requireAdmin, bodyGrades, gpController.assignGradeLevels)

// DELETE /graduation-paths/:id/grade-levels/:gradeLevelId - Remove (admin)
router.delete('/:id/grade-levels/:gradeLevelId', pathRow, requireAdmin, gpController.removeGradeLevel)

// ============================================================================
// SUBJECTS ASSIGNMENT
// ============================================================================

// GET  /graduation-paths/:id/subjects               - List assigned subjects
router.get('/:id/subjects', pathRow, gpController.getPathSubjects)

// POST /graduation-paths/:id/subjects               - Assign subjects (admin)
router.post('/:id/subjects', pathRow, requireAdmin, bodySubjects, gpController.assignSubjects)

// PUT  /graduation-paths/:id/subjects/:subjectId    - Update credits (admin)
router.put('/:id/subjects/:subjectId', pathRow, requireAdmin, gpController.updateSubjectCredits)

// DELETE /graduation-paths/:id/subjects/:subjectId  - Remove (admin)
router.delete('/:id/subjects/:subjectId', pathRow, requireAdmin, gpController.removeSubject)

// ============================================================================
// STUDENTS ASSIGNMENT
// ============================================================================

// GET  /graduation-paths/:id/students               - List assigned students
router.get('/:id/students', pathRow, gpController.getPathStudents)

// POST /graduation-paths/:id/students               - Assign students (admin)
router.post('/:id/students', pathRow, requireAdmin, bodyStudents, gpController.assignStudents)

// DELETE /graduation-paths/:id/students/:studentId  - Remove (admin)
router.delete('/:id/students/:studentId', pathRow, requireAdmin, gpController.removeStudent)

// GET  /graduation-paths/:id/students/:studentId/credits - Student credits detail
router.get('/:id/students/:studentId/credits', pathRow, studentParam, gpController.getStudentCredits)

export default router
