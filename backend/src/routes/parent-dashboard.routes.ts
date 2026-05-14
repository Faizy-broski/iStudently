import { Router } from 'express'
import { parentDashboardController } from '../controllers/parent-dashboard.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireRole } from '../middlewares/role.middleware'

const router = Router()

// All routes require authentication and parent role
router.use(authenticate)
router.use(requireRole('parent'))

/**
 * GET /api/parent-dashboard/students
 * Get list of all children for the logged-in parent
 */
router.get('/students', (req, res) => 
  parentDashboardController.getStudents(req, res)
)

/**
 * GET /api/parent-dashboard/dashboard/:studentId
 * Get consolidated dashboard data (attendance, fees, exams, grades) for a student
 */
router.get('/dashboard/:studentId', (req, res) =>
  parentDashboardController.getDashboardData(req, res)
)

/**
 * GET /api/parent-dashboard/attendance/:studentId/today
 * Get today's attendance status for a student
 */
router.get('/attendance/:studentId/today', (req, res) =>
  parentDashboardController.getAttendanceToday(req, res)
)

/**
 * GET /api/parent-dashboard/attendance/:studentId/history
 * Get attendance history for a student
 * Query params: ?days=30 (default: 30)
 */
router.get('/attendance/:studentId/history', (req, res) =>
  parentDashboardController.getAttendanceHistory(req, res)
)

/**
 * GET /api/parent-dashboard/fees/:studentId/status
 * Get fee status and outstanding balance for a student
 */
router.get('/fees/:studentId/status', (req, res) =>
  parentDashboardController.getFeeStatus(req, res)
)

/**
 * GET /api/parent-dashboard/exams/:studentId/upcoming
 * Get upcoming exams for a student
 * Query params: ?limit=5 (default: 5)
 */
router.get('/exams/:studentId/upcoming', (req, res) =>
  parentDashboardController.getUpcomingExams(req, res)
)

/**
 * GET /api/parent-dashboard/grades/:studentId/recent
 * Get recent exam grades for a student
 * Query params: ?limit=5 (default: 5)
 */
router.get('/grades/:studentId/recent', (req, res) =>
  parentDashboardController.getRecentGrades(req, res)
)

/**
 * GET /api/parent-dashboard/gradebook/:studentId
 * Get complete gradebook (all subjects) for a student
 */
router.get('/gradebook/:studentId', (req, res) =>
  parentDashboardController.getGradebook(req, res)
)

/**
 * GET /api/parent-dashboard/homework/:studentId
 * Get homework/assignments diary for a student
 * Query params: ?days=7 (default: 7)
 */
router.get('/homework/:studentId', (req, res) =>
  parentDashboardController.getHomework(req, res)
)

/**
 * GET /api/parent-dashboard/timetable/:studentId
 * Get class timetable for a student's section
 */
router.get('/timetable/:studentId', (req, res) =>
  parentDashboardController.getTimetable(req, res)
)

/**
 * GET /api/parent-dashboard/attendance/:studentId/subject-wise
 * Get subject-wise monthly attendance summary
 * Query params: ?month=2026-01 (default: current month)
 */
router.get('/attendance/:studentId/subject-wise', (req, res) =>
  parentDashboardController.getSubjectWiseAttendance(req, res)
)

/**
 * GET /api/parent-dashboard/attendance/:studentId/detailed
 * Get detailed attendance records for a specific month/subject
 * Query params: ?month=1&year=2026&subject_id=xxx
 */
router.get('/attendance/:studentId/detailed', (req, res) =>
  parentDashboardController.getDetailedAttendance(req, res)
)

/**
 * GET /api/parent-dashboard/fees/:studentId/payment-history
 * Get fee payment history with receipts for a student
 */
router.get('/fees/:studentId/payment-history', (req, res) =>
  parentDashboardController.getPaymentHistory(req, res)
)

/**
 * GET /api/parent-dashboard/id-card/:studentId
 * Get student's ID card data
 */
router.get('/id-card/:studentId', (req, res) =>
  parentDashboardController.getStudentIdCard(req, res)
)

/**
 * GET /api/parent-dashboard/report-card/:studentId
 * Get student's report card for download
 * Query params: ?academic_year=2025-2026 (optional)
 */
router.get('/report-card/:studentId', (req, res) =>
  parentDashboardController.getReportCard(req, res)
)

/**
 * GET /api/parent-dashboard/discipline/:studentId
 * Get discipline referrals for a student
 */
router.get('/discipline/:studentId', (req, res) =>
  parentDashboardController.getDiscipline(req, res)
)

/**
 * GET /api/parent-dashboard/activities/:studentId
 * Get activities a student is enrolled in
 */
router.get('/activities/:studentId', (req, res) =>
  parentDashboardController.getActivities(req, res)
)

/**
 * GET /api/parent-dashboard/class-diary/:studentId
 * Get class diary entries for a student's section
 */
router.get('/class-diary/:studentId', (req, res) =>
  parentDashboardController.getDiaryEntries(req, res)
)

/**
 * GET /api/parent-dashboard/grades/:studentId/final
 * Get exam-based final grades grouped by subject
 */
router.get('/grades/:studentId/final', (req, res) =>
  parentDashboardController.getFinalGrades(req, res)
)

/**
 * GET /api/parent-dashboard/grades/:studentId/gpa-rank
 * Get GPA and class rank for a student
 */
router.get('/grades/:studentId/gpa-rank', (req, res) =>
  parentDashboardController.getGpaRank(req, res)
)

/**
 * GET /api/parent-dashboard/student-info/:studentId
 * Get full student profile info (RosarioSIS-style) for parent
 */
router.get('/student-info/:studentId', (req, res) =>
  parentDashboardController.getStudentInfo(req, res)
)

/**
 * GET /api/parent-dashboard/assignments/:studentId
 * Get gradebook assignments (with submission status) for a child student
 * Query params: ?status=todo|submitted|graded (optional)
 * Uses the same proven student-dashboard service so data is always consistent.
 */
router.get('/assignments/:studentId', (req, res) =>
  parentDashboardController.getStudentAssignments(req, res)
)

/**
 * GET /api/parent-dashboard/lesson-plans/:studentId
 * Get published lesson plans for a child student
 */
router.get('/lesson-plans/:studentId', (req, res) =>
  parentDashboardController.getLessonPlans(req, res)
)

/**
 * GET /api/parent-dashboard/student-courses/:studentId
 * Get all enrolled courses for a child student (no end_date filter)
 */
router.get('/student-courses/:studentId', (req, res) =>
  parentDashboardController.getStudentCourses(req, res)
)

export default router
