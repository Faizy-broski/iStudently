import express from 'express'
import * as finalGradesController from '../controllers/final-grades.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireTeacher, requireAdmin } from '../middlewares/role.middleware'
import { requireBodyRowsInSchoolFamily, requireRowInSchoolFamily, requireStudentAccess } from '../middlewares/row-school-scope.middleware'
import { ownStudentsOr } from '../middlewares/student-access.middleware'
import { requireOwnCoursePeriods } from '../middlewares/own-course-period.middleware'

const router = express.Router()

// All routes require authentication
router.use(authenticate)

// Course periods and students given by id must belong to the caller's school family; a whole
// class's final grades only to staff, one student's to staff, the student or a linked parent.
const queryCp = requireRowInSchoolFamily('course_periods', 'course_period_id', 'school_id', 'query')
const bodyCp = requireBodyRowsInSchoolFamily('course_periods', 'course_period_id')
// Teachers work only on course periods they teach (admins pass).
const ownQueryCp = requireOwnCoursePeriods((req) => req.query.course_period_id)
const ownBodyCp = requireOwnCoursePeriods((req) => req.body?.course_period_id)
const bodyStudent = requireBodyRowsInSchoolFamily('students', 'student_id')
const student = requireStudentAccess('studentId')

// ============================================================================
// FINAL GRADES
// ============================================================================

// GET /final-grades?course_period_id=&marking_period_id=
router.get('/', requireTeacher, queryCp, ownQueryCp, finalGradesController.getFinalGrades)

// GET /final-grades/student/:studentId?academic_year_id=
router.get('/student/:studentId', student, finalGradesController.getStudentFinalGrades)

// POST /final-grades (teacher - save single final grade)
router.post('/', requireTeacher, bodyStudent, bodyCp, ownBodyCp, finalGradesController.saveFinalGrade)

// POST /final-grades/import-gradebook (teacher - import from gradebook average)
router.post('/import-gradebook', requireTeacher, bodyCp, ownBodyCp, finalGradesController.importFromGradebook)

// POST /final-grades/calculate (teacher - auto-calculate all for a course_period)
router.post('/calculate', requireTeacher, bodyCp, ownBodyCp, finalGradesController.calculateAndSaveFinalGrades)

// POST /final-grades/calculate-cascading (teacher - cascade QTR→SEM→FY)
router.post('/calculate-cascading', requireTeacher, bodyCp, ownBodyCp, finalGradesController.calculateCascadingGrades)

// ============================================================================
// TEACHER COMPLETION
// ============================================================================

// GET /final-grades/completion?school_id=&marking_period_id=&academic_year_id=
router.get('/completion', finalGradesController.getCompletionStatus)

// POST /final-grades/completion (teacher - mark grades as completed)
router.post('/completion', requireTeacher, bodyCp, ownBodyCp, finalGradesController.markCompleted)

// POST /final-grades/completion/undo (teacher - unmark completion)
router.post('/completion/undo', requireTeacher, bodyCp, ownBodyCp, finalGradesController.unmarkCompleted)

// ============================================================================
// GRADE BREAKDOWN / PROGRESS REPORT
// ============================================================================

// GET /final-grades/breakdown/:studentId?academic_year_id=&marking_period_id=
router.get('/breakdown/:studentId', student, finalGradesController.getGradeBreakdown)

// ============================================================================
// FINAL GRADE LISTS (batch generation for printing)
// ============================================================================

// POST /final-grades/generate
// Staff (teachers and admins) for students of the school; a student for themselves, a parent for linked children (web: /teacher and /parent grades/final-grades).
router.post('/generate', ownStudentsOr(requireTeacher, (req) => req.body?.student_ids), requireBodyRowsInSchoolFamily('students', 'student_ids'), finalGradesController.generateGradeLists)

export default router
