import express, { NextFunction, Response } from 'express'
import { supabase } from '../config/supabase'
import type { AuthRequest } from '../middlewares/auth.middleware'
import * as examsController from '../controllers/exams.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireTeacher } from '../middlewares/role.middleware'
import { requireBodyRowsInSchoolFamily, requireRequestSchoolsInFamily, requireRowInSchoolFamily } from '../middlewares/row-school-scope.middleware'
import { requireOwnClass, requireOwnRow, requireSelfTeacherId } from '../middlewares/own-course-period.middleware'

/** The student marked must be in the exam's section. */
async function studentInExamSection(req: AuthRequest, res: Response, next: NextFunction) {
  const examId = req.body?.exam_id
  const studentId = req.body?.student_id
  if (typeof examId !== 'string' || typeof studentId !== 'string') return next()
  try {
    const [exam, student] = await Promise.all([
      supabase.from('exams').select('section_id').eq('id', examId).maybeSingle(),
      supabase.from('students').select('section_id').eq('id', studentId).maybeSingle(),
    ])
    if (exam.error) throw exam.error
    if (student.error) throw student.error
    const examSection = (exam.data as { section_id?: string | null } | null)?.section_id
    if (examSection && (student.data as { section_id?: string | null } | null)?.section_id !== examSection) {
      return res.status(400).json({ success: false, error: 'The student is not in this exam\'s section' })
    }
    return next()
  } catch (err) {
    console.error('Exam section check failed:', err)
    return res.status(503).json({ success: false, retryable: true, error: 'Could not verify access' })
  }
}

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
  requireOwnClass('section', (req) => req.body?.section_id),
  examsController.createExam,
)
router.put('/:id', requireTeacher, examRow, ownExam, requireSelfTeacherId('body'), requireBodyRowsInSchoolFamily('sections', 'section_id'), requireOwnClass('section', (req) => req.body?.section_id), examsController.updateExam)
router.delete('/:id', requireTeacher, examRow, ownExam, examsController.deleteExam)

// ============================================================================
// EXAM RESULTS ROUTES
// ============================================================================

router.get('/:id/results', requireTeacher, examRow, ownExam, examsController.getExamResults)
router.post('/results/record', requireTeacher, requireBodyRowsInSchoolFamily('exams', 'exam_id'), requireOwnRow('exams', 'exam_id', 'body'), requireBodyRowsInSchoolFamily('students', 'student_id'), studentInExamSection, examsController.recordMarks)

export default router
