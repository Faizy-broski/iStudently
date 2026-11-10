import express from 'express'
import * as reportCardsController from '../controllers/report-cards.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireAdmin, requireTeacher } from '../middlewares/role.middleware'
import { requireBodyRowsInSchoolFamily, requireRowInSchoolFamily, requireStudentAccess } from '../middlewares/row-school-scope.middleware'
import { ownStudentsOr } from '../middlewares/student-access.middleware'
import { coursePeriodOf, requireOwnCoursePeriods, requireOwnStudents } from '../middlewares/own-course-period.middleware'
import { supabase } from '../config/supabase'

/** The student of a row addressed by id (teacher ownership checks). */
async function studentOf(table: string, id: unknown): Promise<string | null> {
  if (typeof id !== 'string' || !id) return null
  const { data } = await supabase.from(table).select('student_id').eq('id', id).maybeSingle()
  return (data as { student_id?: string | null } | null)?.student_id ?? null
}

const router = express.Router()

// Comment code scales / codes addressed by id must belong to the caller's school family.
const codeScaleRow = requireRowInSchoolFamily('comment_code_scales')
const codeScaleParam = requireRowInSchoolFamily('comment_code_scales', 'scaleId')
const codeRow = requireRowInSchoolFamily('comment_codes')
const categoryRow = requireRowInSchoolFamily('report_card_comment_categories')
const commentRow = requireRowInSchoolFamily('report_card_comments')
const studentCommentRow = requireRowInSchoolFamily('student_report_card_comments')
const student = requireStudentAccess('studentId')
const bodyStudent = requireBodyRowsInSchoolFamily('students', 'student_id')
const bodyStudents = requireBodyRowsInSchoolFamily('students', 'student_ids')

router.use(authenticate)

// ============================================================================
// COMMENT CATEGORIES (admin CRUD)
// ============================================================================

router.get('/categories', reportCardsController.getCategories)
router.post('/categories', requireAdmin, reportCardsController.createCategory)
router.put('/categories/:id', requireAdmin, categoryRow, reportCardsController.updateCategory)
router.delete('/categories/:id', requireAdmin, categoryRow, reportCardsController.deleteCategory)

// ============================================================================
// COMMENT TEMPLATES (admin CRUD)
// ============================================================================

router.get('/comments', reportCardsController.getComments)
router.post('/comments', requireAdmin, reportCardsController.createComment)
router.put('/comments/:id', requireAdmin, commentRow, reportCardsController.updateComment)
router.delete('/comments/:id', requireAdmin, commentRow, reportCardsController.deleteComment)

// ============================================================================
// COMMENT CODE SCALES & CODES (admin CRUD)
// ============================================================================

router.get('/code-scales', reportCardsController.getCodeScales)
router.post('/code-scales', requireAdmin, reportCardsController.createCodeScale)
router.put('/code-scales/:id', requireAdmin, codeScaleRow, reportCardsController.updateCodeScale)
router.delete('/code-scales/:id', requireAdmin, codeScaleRow, reportCardsController.deleteCodeScale)
router.post('/code-scales/:scaleId/codes', requireAdmin, codeScaleParam, reportCardsController.createCode)
router.put('/codes/:id', requireAdmin, codeRow, reportCardsController.updateCode)
router.delete('/codes/:id', requireAdmin, codeRow, reportCardsController.deleteCode)

// ============================================================================
// STUDENT COMMENTS (teacher enters per-student)
// ============================================================================

router.get('/student/:studentId', student, reportCardsController.getStudentComments)
// Teachers comment only on their own classes and their own students.
router.post('/student-comments', requireTeacher, bodyStudent, requireBodyRowsInSchoolFamily('course_periods', 'course_period_id'), requireOwnCoursePeriods((req) => req.body?.course_period_id), requireOwnStudents((req) => req.body?.student_id), reportCardsController.saveStudentComment)
router.delete('/student-comments/:id', requireTeacher, studentCommentRow, requireOwnCoursePeriods((req) => coursePeriodOf('student_report_card_comments', req.params.id)), reportCardsController.deleteStudentComment)

// ============================================================================
// REPORT CARD GENERATION
// ============================================================================

// GET /report-cards/generate/:studentId?marking_period_id=&academic_year_id=
router.get('/generate/:studentId', student, reportCardsController.generateReportCard)

// POST /report-cards/generate — batch generate for multiple students
// Teachers and admins for the school's students; a student for themselves, a parent for linked children.
router.post('/generate', ownStudentsOr(requireTeacher, (req) => req.body?.student_ids), bodyStudents, reportCardsController.generateReportCards)

// ============================================================================
// TUTOR / HOMEROOM COMMENTS
// Global per-student comment per marking period (not course-specific).
// school_id scoped to effective campus_id for full tenant isolation.
// ============================================================================

// GET  /report-cards/tutor-comments/marking-periods?academic_year_id=&school_id=
router.get('/tutor-comments/marking-periods', reportCardsController.getEligibleMarkingPeriods)

// GET  /report-cards/tutor-comments/:studentId?marking_period_id=&academic_year_id=&campus_id=
router.get('/tutor-comments/:studentId', student, reportCardsController.getTutorComment)

// POST /report-cards/tutor-comments  (upsert — insert or update)
router.post('/tutor-comments', requireTeacher, bodyStudent, requireOwnStudents((req) => req.body?.student_id), reportCardsController.upsertTutorComment)

// DELETE /report-cards/tutor-comments/:id?campus_id=
router.delete('/tutor-comments/:id', requireTeacher, requireRowInSchoolFamily('student_mp_tutor_comments'), requireOwnStudents((req) => studentOf('student_mp_tutor_comments', req.params.id)), reportCardsController.deleteTutorComment)

export default router
