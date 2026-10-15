import express from 'express'
import * as controller from '../controllers/historical-grades.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireAdmin } from '../middlewares/role.middleware'
import { requireBodyRowsInSchoolFamily, requireRowInSchoolFamily, requireStudentAccess } from '../middlewares/row-school-scope.middleware'

// A student's grades from past marking periods (web: /admin/grades/historical-grades). Students, periods
// and grade rows given by id must belong to the caller's school family.
const router = express.Router()
router.use(authenticate, requireAdmin)

const student = requireStudentAccess('studentId')
const mpParam = requireRowInSchoolFamily('history_marking_periods', 'mpId')
const mpQuery = requireRowInSchoolFamily('history_marking_periods', 'marking_period_id', 'school_id', 'query')
const mpBody = requireBodyRowsInSchoolFamily('history_marking_periods', 'marking_period_id')
const cpBody = requireBodyRowsInSchoolFamily('course_periods', 'course_period_id')
const gradeRow = requireRowInSchoolFamily('historical_grades')

router.get('/student/:studentId/marking-periods', student, controller.listStudentMarkingPeriods)
router.post('/student/:studentId/marking-periods', student, mpBody, controller.addStudentMarkingPeriod)
router.put('/student/:studentId/marking-periods/:mpId', student, mpParam, controller.updateStudentMarkingPeriod)
router.delete('/student/:studentId/marking-periods/:mpId', student, mpParam, controller.removeStudentMarkingPeriod)

router.get('/student/:studentId', student, mpQuery, controller.listStudentGrades)
router.post('/student/:studentId', student, mpBody, cpBody, controller.createStudentGrade)
router.put('/:id', gradeRow, cpBody, controller.updateGrade)
router.delete('/:id', gradeRow, controller.deleteGrade)

export default router
