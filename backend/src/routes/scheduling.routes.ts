import { Router } from 'express'
import * as schedulingController from '../controllers/scheduling.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireAdmin, requireTeacher } from '../middlewares/role.middleware'

const router = Router()

// All routes require authentication
router.use(authenticate)

// ============================================================================
// STUDENT ENROLLMENT (Individual Scheduling)
// ============================================================================

// POST /scheduling/enroll                - Enroll a student in a course period (admin)
router.post('/enroll', requireAdmin, schedulingController.enrollStudent)

// POST /scheduling/drop                  - Drop a student from a course period (admin)
router.post('/drop', requireAdmin, schedulingController.dropStudent)

// POST /scheduling/mass-enroll           - Mass enroll students (admin)
router.post('/mass-enroll', requireAdmin, schedulingController.massEnroll)

// POST /scheduling/mass-drop             - Mass drop students (admin)
router.post('/mass-drop', requireAdmin, schedulingController.massDrop)

// ============================================================================
// STUDENT SCHEDULE VIEWS
// ============================================================================

// GET /scheduling/student/:studentId          - Get student's active schedule
router.get('/student/:studentId', schedulingController.getStudentSchedule)

// GET /scheduling/student/:studentId/history  - Get full schedule history
router.get('/student/:studentId/history', schedulingController.getStudentScheduleHistory)

// ============================================================================
// CLASS LIST
// ============================================================================

// GET /scheduling/class-list/:coursePeriodId  - Get enrolled students for a course period
router.get('/class-list/:coursePeriodId', schedulingController.getClassList)

// ============================================================================
// COURSE PERIOD SCHEDULING FIELDS
// ============================================================================

// PUT /scheduling/course-period/:coursePeriodId  - Update scheduling fields (seats, room, etc.)
router.put('/course-period/:coursePeriodId', requireAdmin, schedulingController.updateCoursePeriodScheduling)

// ============================================================================
// CONFLICT CHECK
// ============================================================================

// GET /scheduling/check-conflicts   - Check schedule conflicts for a student + course period
router.get('/check-conflicts', schedulingController.checkConflicts)

// ============================================================================
// ADD/DROP LOG
// ============================================================================

// GET /scheduling/add-drop-log      - Get add/drop history (admin)
router.get('/add-drop-log', requireAdmin, schedulingController.getAddDropLog)

// ============================================================================
// TEACHER AVAILABILITY
// ============================================================================

// GET /scheduling/teacher-availability/:teacherId  - Get teacher's availability
router.get('/teacher-availability/:teacherId', schedulingController.getTeacherAvailability)

// POST /scheduling/teacher-availability             - Set teacher availability (admin)
router.post('/teacher-availability', requireAdmin, schedulingController.setTeacherAvailability)

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
router.get('/course-period/:coursePeriodId/school-periods', schedulingController.getCoursePeriodSchoolPeriods)

// PUT /scheduling/course-period/:coursePeriodId/school-periods  - Set linked school periods
router.put('/course-period/:coursePeriodId/school-periods', requireAdmin, schedulingController.setCoursePeriodSchoolPeriods)

export default router
