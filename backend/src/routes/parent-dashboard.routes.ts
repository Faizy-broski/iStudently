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

export default router
