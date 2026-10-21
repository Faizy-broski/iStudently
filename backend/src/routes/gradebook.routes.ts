import express from 'express'
import { supabase } from '../config/supabase'
import * as gradebookController from '../controllers/gradebook.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireTeacher, requireAdmin } from '../middlewares/role.middleware'
import { requireBodyRowsInSchoolFamily, requireRequestSchoolsInFamily, requireRowInSchoolFamily, requireStudentAccess } from '../middlewares/row-school-scope.middleware'
import { ownStudentsOr } from '../middlewares/student-access.middleware'
import { coursePeriodOf, requireOwnCoursePeriods, requireOwnStaffQuery } from '../middlewares/own-course-period.middleware'

const router = express.Router()

// All routes require authentication
router.use(authenticate)

// Assignments, types, course periods and students addressed by id must belong to the caller's
// school family; one student's grades only to staff, the student or a linked parent.
const typeRow = requireRowInSchoolFamily('gradebook_assignment_types')
const assignmentRow = requireRowInSchoolFamily('gradebook_assignments')
const assignmentParam = requireRowInSchoolFamily('gradebook_assignments', 'assignmentId')
const courseRow = requireRowInSchoolFamily('courses', 'courseId')
const student = requireStudentAccess('studentId')
const bodyCp = requireBodyRowsInSchoolFamily('course_periods', 'course_period_id')
const queryCp = requireRowInSchoolFamily('course_periods', 'course_period_id', 'school_id', 'query')
const bodyCps = requireBodyRowsInSchoolFamily('course_periods', 'course_period_ids')
const bodyAssignment = requireBodyRowsInSchoolFamily('gradebook_assignments', 'assignment_id')
const bodyStudent = requireBodyRowsInSchoolFamily('students', 'student_id')
// Teachers work only on course periods they teach (admins pass).
const ownQueryCp = requireOwnCoursePeriods((req) => req.query.course_period_id)
const ownBodyCp = requireOwnCoursePeriods((req) => req.body?.course_period_id)
const ownBodyCps = requireOwnCoursePeriods((req) => req.body?.course_period_ids)
const ownAssignment = requireOwnCoursePeriods((req) => coursePeriodOf('gradebook_assignments', req.params.id))
const ownAssignmentParam = requireOwnCoursePeriods((req) => coursePeriodOf('gradebook_assignments', req.params.assignmentId))
const ownBodyAssignment = requireOwnCoursePeriods((req) => coursePeriodOf('gradebook_assignments', req.body?.assignment_id))
/** An assignment type belongs to a course period, or (course-wide) to a course: then the teacher must teach a period of it. */
const ownType = requireOwnCoursePeriods(async (req) => {
  const { data } = await supabase.from('gradebook_assignment_types').select('course_period_id, course_id').eq('id', req.params.id).maybeSingle()
  const row = data as { course_period_id: string | null; course_id: string | null } | null
  if (!row) return null
  if (row.course_period_id) return row.course_period_id
  return teacherCpOfCourse(req, row.course_id)
})
const ownBodyType = requireOwnCoursePeriods(async (req) => req.body?.course_period_id ?? teacherCpOfCourse(req, req.body?.course_id))

/** One of the teacher's own course periods of a course, or a sentinel that fails the ownership check. */
async function teacherCpOfCourse(req: { profile?: unknown }, courseId: unknown): Promise<string | null> {
  if (typeof courseId !== 'string' || !courseId) return null
  const staffId = (req.profile as { staff_id?: string | null } | undefined)?.staff_id
  if (!staffId) return 'none'
  const { data } = await supabase.from('course_periods').select('id').eq('course_id', courseId).or(`teacher_id.eq.${staffId},secondary_teacher_id.eq.${staffId}`).limit(1)
  return (data as { id: string }[] | null)?.[0]?.id ?? '00000000-0000-0000-0000-000000000000'
}

const bodyGradeStudents = requireBodyRowsInSchoolFamily('students', (b) => (Array.isArray(b.grades) ? b.grades.map((g: { student_id?: unknown }) => g?.student_id) : undefined))

// ============================================================================
// ASSIGNMENT TYPES
// ============================================================================

// GET /gradebook/assignment-types?course_period_id=
router.get('/assignment-types', queryCp, gradebookController.getAssignmentTypes)

// GET /gradebook/assignment-types/course/:courseId
router.get('/assignment-types/course/:courseId', courseRow, gradebookController.getAssignmentTypesByCourse)

// POST /gradebook/assignment-types (teacher)
router.post('/assignment-types', requireTeacher, ownBodyType, gradebookController.createAssignmentType)

// PUT /gradebook/assignment-types/:id (teacher)
router.put('/assignment-types/:id', requireTeacher, typeRow, ownType, gradebookController.updateAssignmentType)

// DELETE /gradebook/assignment-types/:id (teacher)
router.delete('/assignment-types/:id', requireTeacher, typeRow, ownType, gradebookController.deleteAssignmentType)

// ============================================================================
// ASSIGNMENTS
// ============================================================================

// GET /gradebook/assignments?course_period_id=&assignment_type_id=
router.get('/assignments', requireTeacher, queryCp, ownQueryCp, gradebookController.getAssignments)

// GET /gradebook/assignments/staff (teacher - all assignments for current teacher)
router.get('/assignments/staff', requireTeacher, gradebookController.getAssignmentsByStaff)

// GET /gradebook/assignments/:id
router.get('/assignments/:id', assignmentRow, ownAssignment, gradebookController.getAssignmentById)

// POST /gradebook/assignments (teacher)
router.post('/assignments', requireTeacher, bodyCp, ownBodyCp, gradebookController.createAssignment)

// PUT /gradebook/assignments/:id (teacher)
router.put('/assignments/:id', requireTeacher, assignmentRow, ownAssignment, bodyCp, ownBodyCp, gradebookController.updateAssignment)

// DELETE /gradebook/assignments/:id (teacher)
router.delete('/assignments/:id', requireTeacher, assignmentRow, ownAssignment, gradebookController.deleteAssignment)

// POST /gradebook/assignments/mass-create (admin/teacher)
router.post('/assignments/mass-create', requireTeacher, bodyCps, ownBodyCps, gradebookController.massCreateAssignment)

// ============================================================================
// GRADES
// ============================================================================

// GET /gradebook/grades/assignment/:assignmentId
router.get('/grades/assignment/:assignmentId', requireTeacher, assignmentParam, ownAssignmentParam, gradebookController.getGradesForAssignment)

// GET /gradebook/grades/summary/student/:studentId?marking_period_id=
router.get('/grades/summary/student/:studentId', student, gradebookController.getStudentGradesSummary)

// GET /gradebook/grades/student/:studentId?course_period_id=
router.get('/grades/student/:studentId', student, gradebookController.getGradesForStudent)

// POST /gradebook/grades (teacher - single grade entry)
router.post('/grades', requireTeacher, bodyAssignment, bodyStudent, bodyCp, ownBodyCp, ownBodyAssignment, gradebookController.enterGrade)

// POST /gradebook/grades/bulk (teacher - bulk grade entry)
router.post('/grades/bulk', requireTeacher, bodyAssignment, bodyCp, bodyGradeStudents, ownBodyCp, ownBodyAssignment, gradebookController.bulkEnterGrades)

// POST /gradebook/grades/import (teacher - import from CSV/Excel)
router.post('/grades/import', requireTeacher, bodyCp, ownBodyCp, gradebookController.importGradebookGrades)

// ============================================================================
// CALCULATIONS & VIEWS
// ============================================================================

// GET /gradebook/breakdown?course_period_id=&assignment_id=
router.get('/breakdown', requireTeacher, queryCp, ownQueryCp, gradebookController.getGradebookBreakdown)

// GET /gradebook/assignment-options?course_period_id=&marking_period_id=
router.get('/assignment-options', requireTeacher, queryCp, ownQueryCp, gradebookController.getAssignmentOptionsForBreakdown)

// GET /gradebook/view?course_period_id=&section_id= (full gradebook matrix)
router.get('/view', requireTeacher, queryCp, ownQueryCp, gradebookController.getGradebookView)

// GET /gradebook/average/:studentId?course_period_id=
router.get('/average/:studentId', student, gradebookController.calculateStudentAverage)

// GET /gradebook/anomalous?course_period_id=&threshold=
router.get('/anomalous', requireTeacher, queryCp, ownQueryCp, requireRowInSchoolFamily('staff', 'staff_id', 'school_id', 'query'), requireOwnStaffQuery(), gradebookController.getAnomalousGrades)

// ============================================================================
// CONFIG
// ============================================================================

// GET /gradebook/config?school_id=&course_period_id=
router.get('/config', requireRequestSchoolsInFamily, queryCp, gradebookController.getConfig)

// POST /gradebook/config (admin)
router.post('/config', requireAdmin, gradebookController.setConfig)

// POST /gradebook/config/batch (admin — save multiple keys at once)
router.post('/config/batch', requireAdmin, gradebookController.setBatchConfig)

// PUT /gradebook/config (teacher — per-CP overrides only, ownership enforced)
router.put('/config', requireTeacher, gradebookController.setConfigAsTeacher)

// ============================================================================
// PROGRESS REPORTS (batch generation for printing)
// ============================================================================

// POST /gradebook/progress-reports
// Staff (teachers and admins) for the school's students; a student for themselves, a parent for linked children (web: /teacher and /parent grades/progress-reports).
router.post('/progress-reports', ownStudentsOr(requireTeacher, (req) => req.body?.student_ids), requireBodyRowsInSchoolFamily('students', 'student_ids'), gradebookController.generateProgressReports)

export default router
