import express from 'express'
import * as examsController from '../controllers/exams.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireTeacher } from '../middlewares/role.middleware'
import { requireBodyRowsInSchoolFamily, requireRequestSchoolsInFamily, requireRowInSchoolFamily } from '../middlewares/row-school-scope.middleware'
import { requireOwnRow, requireSelfTeacherId } from '../middlewares/own-course-period.middleware'

const router = express.Router()

// Exams and their results must belong to the caller's school family: before this, any signed-in user
// could read any exam's results and teachers could create, edit, delete or mark exams of other schools.
const examRow = requireRowInSchoolFamily('exams', 'id')
const teacherInQuery = requireRowInSchoolFamily('staff', 'teacher_id', 'school_id', 'query')
// Teachers may only manage their own exams (admins: any exam of the school family).
const ownExam = requireOwnRow('exams')

// All routes require authentication
router.use(authenticate)
router.use(requireRequestSchoolsInFamily)

// ============================================================================
// EXAM TYPE ROUTES
// ============================================================================

router.get('/types', examsController.getExamTypes)

// ============================================================================
// EXAM ROUTES
// ============================================================================

router.get('/teacher', requireTeacher, teacherInQuery, requireSelfTeacherId('query'), examsController.getTeacherExams)
router.post(
  '/',
  requireTeacher,
  requireBodyRowsInSchoolFamily('staff', 'teacher_id'),
  requireSelfTeacherId('body'),
  requireBodyRowsInSchoolFamily('sections', 'section_id'),
  examsController.createExam,
)
router.put('/:id', requireTeacher, examRow, ownExam, requireSelfTeacherId('body'), examsController.updateExam)
router.delete('/:id', requireTeacher, examRow, ownExam, examsController.deleteExam)

// ============================================================================
// EXAM RESULTS ROUTES
// ============================================================================

router.get('/:id/results', requireTeacher, examRow, ownExam, examsController.getExamResults)
router.post('/results/record', requireTeacher, requireBodyRowsInSchoolFamily('exams', 'exam_id'), requireOwnRow('exams', 'exam_id', 'body'), requireBodyRowsInSchoolFamily('students', 'student_id'), examsController.recordMarks)

export default router
