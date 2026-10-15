import { requireOwnStudent } from '../middlewares/student-access.middleware'
import { Router, type NextFunction, type Request, type Response } from 'express'
import * as schedulingController from '../controllers/scheduling.controller'
import { authenticate, type AuthRequest } from '../middlewares/auth.middleware'
import { requireAdmin, requireTeacher } from '../middlewares/role.middleware'
import { requireBodyRowsInSchoolFamily, requireRowInSchoolFamily } from '../middlewares/row-school-scope.middleware'
import { canViewClassList } from '../utils/student-access'

const router = Router()

// All routes require authentication
router.use(authenticate)

// Students, course periods and teachers addressed by id must belong to the caller's school family.
const studentParam = requireRowInSchoolFamily('students', 'studentId')
// Students see only their own schedule, parents only their children's.
const ownStudentParam = requireOwnStudent((req) => req.params.studentId)
const cpParam = requireRowInSchoolFamily('course_periods', 'coursePeriodId')
// Class lists name every enrolled student: students and parents only for their own (children's) classes.
const ownClassList = async (req: Request, res: Response, next: NextFunction) =>
  (await canViewClassList(req as AuthRequest, req.params.coursePeriodId)) ? next() : res.status(403).json({ success: false, error: 'Access denied' })
const teacherParam = requireRowInSchoolFamily('staff', 'teacherId')
const bodyStudent = requireBodyRowsInSchoolFamily('students', 'student_id')
const bodyStudents = requireBodyRowsInSchoolFamily('students', 'student_ids')
const bodyCp = requireBodyRowsInSchoolFamily('course_periods', 'course_period_id')
const bodyTeacher = requireBodyRowsInSchoolFamily('staff', 'teacher_id')

// ============================================================================
// STUDENT ENROLLMENT (Individual Scheduling)
// ============================================================================

// POST /scheduling/enroll                - Enroll a student in a course period (admin)
router.post('/enroll', requireAdmin, bodyStudent, bodyCp, schedulingController.enrollStudent)

// POST /scheduling/drop                  - Drop a student from a course period (admin)
router.post('/drop', requireAdmin, bodyStudent, bodyCp, schedulingController.dropStudent)

// POST /scheduling/mass-enroll           - Mass enroll students (admin)
router.post('/mass-enroll', requireAdmin, bodyStudents, bodyCp, schedulingController.massEnroll)

// POST /scheduling/mass-drop             - Mass drop students (admin)
router.post('/mass-drop', requireAdmin, bodyStudents, bodyCp, schedulingController.massDrop)

// ============================================================================
// STUDENT SCHEDULE VIEWS
// ============================================================================

// GET /scheduling/student/:studentId          - Get student's active schedule
router.get('/student/:studentId', studentParam, ownStudentParam, schedulingController.getStudentSchedule)

// GET /scheduling/student/:studentId/history  - Get full schedule history
router.get('/student/:studentId/history', studentParam, ownStudentParam, schedulingController.getStudentScheduleHistory)

// ============================================================================
// CLASS LIST
// ============================================================================

// GET /scheduling/class-list/:coursePeriodId  - Get enrolled students for a course period
router.get('/class-list/:coursePeriodId', cpParam, ownClassList, schedulingController.getClassList)

// ============================================================================
// COURSE PERIOD SCHEDULING FIELDS
// ============================================================================

// PUT /scheduling/course-period/:coursePeriodId  - Update scheduling fields (seats, room, etc.)
router.put('/course-period/:coursePeriodId', requireAdmin, cpParam, schedulingController.updateCoursePeriodScheduling)

// ============================================================================
// CONFLICT CHECK
// ============================================================================

// GET /scheduling/check-conflicts   - Check schedule conflicts for a student + course period
router.get('/check-conflicts', requireRowInSchoolFamily('students', 'student_id', 'school_id', 'query'), requireRowInSchoolFamily('course_periods', 'course_period_id', 'school_id', 'query'), schedulingController.checkConflicts)

// ============================================================================
// ADD/DROP LOG
// ============================================================================

// GET /scheduling/add-drop-log      - Get add/drop history (admin)
router.get('/add-drop-log', requireAdmin, schedulingController.getAddDropLog)

// ============================================================================
// TEACHER AVAILABILITY
// ============================================================================

// GET /scheduling/teacher-availability/:teacherId  - Get teacher's availability
router.get('/teacher-availability/:teacherId', teacherParam, schedulingController.getTeacherAvailability)

// POST /scheduling/teacher-availability             - Set teacher availability (admin)
router.post('/teacher-availability', requireAdmin, bodyTeacher, schedulingController.setTeacherAvailability)

// GET /scheduling/available-teachers                - Get available teachers for a slot
router.get('/available-teachers', requireAdmin, schedulingController.getAvailableTeachersForSlot)

// ============================================================================
// DASHBOARD STATS (mirrors RosarioSIS Dashboard.inc.php)
// ============================================================================

// GET /scheduling/dashboard-stats   - Get aggregate scheduling statistics
router.get('/dashboard-stats', requireAdmin, schedulingController.getSchedulingDashboardStats)

// ============================================================================
// COURSE PERIOD SCHOOL PERIODS (multi-period support)
// ============================================================================

// GET /scheduling/course-period/:coursePeriodId/school-periods  - Get linked school periods
router.get('/course-period/:coursePeriodId/school-periods', cpParam, schedulingController.getCoursePeriodSchoolPeriods)

// PUT /scheduling/course-period/:coursePeriodId/school-periods  - Set linked school periods
router.put('/course-period/:coursePeriodId/school-periods', requireAdmin, cpParam, schedulingController.setCoursePeriodSchoolPeriods)

export default router
