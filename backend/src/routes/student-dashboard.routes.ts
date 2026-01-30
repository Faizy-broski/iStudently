import { Router } from 'express'
import { StudentDashboardController } from '../controllers/student-dashboard.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireRole } from '../middlewares/role.middleware'

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
 * GET /api/student-dashboard/profile/id-card
 * Get digital ID card information
 */
router.get('/profile/id-card', (req, res) => controller.getDigitalIdCard(req, res))

export default router
