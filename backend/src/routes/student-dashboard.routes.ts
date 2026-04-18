import { Router } from 'express'
import { StudentDashboardController } from '../controllers/student-dashboard.controller'
import { authenticate } from '../middlewares/auth.middleware'

const router = Router()
const controller = new StudentDashboardController()

// All routes require authentication
// Student role only - don't use requireRole which checks for admin/teacher
router.use(authenticate)
// No role middleware needed - auth middleware already verified the user

/**
 * GET /api/student-dashboard/overview
 * Get comprehensive dashboard overview
 * Returns: today's timetable, due assignments, recent feedback, attendance
 */
router.get('/overview', (req, res) => controller.getDashboardOverview(req, res))

/**
 * GET /api/student-dashboard/timetable/today
 * Get today's class schedule
 */
router.get('/timetable/today', (req, res) => controller.getTodayTimetable(req, res))

/**
 * GET /api/student-dashboard/timetable/week
 * Get full weekly timetable
 */
router.get('/timetable/week', (req, res) => controller.getWeeklyTimetable(req, res))

/**
 * GET /api/student-dashboard/assignments/due
 * Get assignments due in next 48 hours
 */
router.get('/assignments/due', (req, res) => controller.getDueAssignments(req, res))

/**
 * GET /api/student-dashboard/assignments
 * Get all assignments with optional status filter
 * Query params: ?status=todo|submitted|graded
 */
router.get('/assignments', (req, res) => controller.getStudentAssignments(req, res))

/**
 * GET /api/student-dashboard/feedback/recent
 * Get recent feedback/grades
 * Query params: ?limit=5
 */
router.get('/feedback/recent', (req, res) => controller.getRecentFeedback(req, res))

/**
 * GET /api/student-dashboard/attendance
 * Get attendance summary (percentage, present/absent days)
 */
router.get('/attendance', (req, res) => controller.getAttendanceSummary(req, res))

/**
 * GET /api/student-dashboard/attendance/subjects
 * Get subject-wise attendance breakdown
 */
router.get('/attendance/subjects', (req, res) => controller.getSubjectWiseAttendance(req, res))

/**
 * GET /api/student-dashboard/attendance/detailed
 * Get detailed attendance records with date, period, subject
 * Query params: ?month=1&year=2026
 */
router.get('/attendance/detailed', (req, res) => controller.getDetailedAttendance(req, res))

/**
 * GET /api/student-dashboard/exams/upcoming
 * Get upcoming exams
 */
router.get('/exams/upcoming', (req, res) => controller.getUpcomingExams(req, res))

/**
 * GET /api/student-dashboard/grades
 * Get all grades grouped by subject/course-period
 */
router.get('/grades', (req, res) => controller.getStudentGrades(req, res))

/**
 * GET /api/student-dashboard/report-card
 * Get report card summary (subject averages + comments)
 * Query params: ?marking_period_id=xxx (optional)
 */
router.get('/report-card', (req, res) => controller.getStudentReportCard(req, res))

/**
 * GET /api/student-dashboard/discipline
 * Get logged-in student's own discipline referrals
 */
router.get('/discipline', (req, res) => controller.getStudentDiscipline(req, res))

/**
 * GET /api/student-dashboard/activities
 * Get activities the logged-in student is enrolled in
 */
router.get('/activities', (req, res) => controller.getStudentActivities(req, res))

/**
 * GET /api/student-dashboard/hostel
 * Get student's current hostel room assignment
 */
router.get('/hostel', (req, res) => controller.getHostelAssignment(req, res))

/**
 * GET /api/student-dashboard/class-diary
 * Get class diary entries for student's section
 */
router.get('/class-diary', (req, res) => controller.getClassDiary(req, res))

/**
 * GET /api/student-dashboard/info
 * Get comprehensive student info (profile, section, school)
 */
router.get('/info', (req, res) => controller.getStudentInfo(req, res))

/**
 * GET /api/student-dashboard/profile/id-card
 * Get digital ID card information
 */
router.get('/profile/id-card', (req, res) => controller.getDigitalIdCard(req, res))

// Billing (zero-trust: student_id from JWT only)
router.get('/billing/fees', (req, res) => controller.getStudentFees(req, res))
router.get('/billing/payments', (req, res) => controller.getStudentPaymentHistory(req, res))

// Scheduling
router.get('/scheduling/courses', (req, res) => controller.getStudentCourses(req, res))
router.get('/scheduling/class-pictures', (req, res) => controller.getClassPictures(req, res))
router.get('/scheduling/lesson-plans', (req, res) => controller.getLessonPlans(req, res))

// Grades detail
router.get('/grades/final', (req, res) => controller.getStudentFinalGrades(req, res))
router.get('/grades/gpa-rank', (req, res) => controller.getStudentGpaRank(req, res))

export default router
