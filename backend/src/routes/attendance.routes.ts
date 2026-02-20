import { Router } from 'express'
import * as attendanceController from '../controllers/attendance.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireAdmin, requireTeacher } from '../middlewares/role.middleware'

const router = Router()

// All routes require authentication
router.use(authenticate)

// ============================================================================
// SETUP > Attendance Codes
// CRUD for configurable attendance codes
// ============================================================================

router.get('/codes', requireTeacher, attendanceController.getAttendanceCodes)
router.get('/codes/:id', requireTeacher, attendanceController.getAttendanceCodeById)
router.post('/codes', requireAdmin, attendanceController.createAttendanceCode)
router.put('/codes/:id', requireAdmin, attendanceController.updateAttendanceCode)
router.delete('/codes/:id', requireAdmin, attendanceController.deleteAttendanceCode)

// ============================================================================
// Administration > Calendar
// School calendar management (which days are school days, full-day minutes)
// ============================================================================

router.get('/calendar', requireAdmin, attendanceController.getCalendar)
router.post('/calendar/generate', requireAdmin, attendanceController.generateCalendar)
router.put('/calendar/:id', requireAdmin, attendanceController.updateCalendarDay)
router.put('/calendar/bulk', requireAdmin, attendanceController.bulkUpdateCalendarDays)
router.get('/calendar/school-days', requireAdmin, attendanceController.getSchoolDayCount)

// ============================================================================
// Administration > Admin Attendance View
// View and manage daily attendance with override capability
// ============================================================================

router.get('/admin/view', requireAdmin, attendanceController.getAdminAttendanceView)
router.get('/admin/period-grid', requireAdmin, attendanceController.getAdminPeriodGrid)
router.get('/admin/student/:student_id/periods', requireAdmin, attendanceController.getStudentPeriodAttendance)
router.post('/admin/override', requireAdmin, attendanceController.overrideAttendanceRecord)
router.post('/admin/bulk-override', requireAdmin, attendanceController.bulkOverrideAttendanceRecords)
router.post('/admin/daily-comment', requireAdmin, attendanceController.updateDailyComment)

// ============================================================================
// Add Absences
// Admin adds absences for multiple students/periods
// ============================================================================

router.post('/admin/add-absences', requireAdmin, attendanceController.addAbsences)

// ============================================================================
// REPORTS > Teacher Completion
// Shows which teachers have submitted attendance
// ============================================================================

router.get('/reports/teacher-completion', requireAdmin, attendanceController.getTeacherCompletion)

// ============================================================================
// REPORTS > Average Daily Attendance
// ADA report with daily breakdown
// ============================================================================

router.get('/reports/ada', requireAdmin, attendanceController.getAverageDailyAttendance)

// ADA grouped by grade level (RosarioSIS-style)
router.get('/reports/ada-by-grade', requireAdmin, attendanceController.getADAByGrade)

// ============================================================================
// REPORTS > Attendance Chart / Daily Summary Grid
// Time-series chart data + student×date grid
// ============================================================================

router.get('/reports/chart', requireAdmin, attendanceController.getAttendanceChart)
router.get('/reports/daily-summary-grid', requireAdmin, attendanceController.getDailySummaryGrid)

// ============================================================================
// REPORTS > Attendance Summary
// Per-student summary with code breakdown
// ============================================================================

router.get('/reports/summary', requireAdmin, attendanceController.getAttendanceSummary)
router.get('/reports/summary/export', requireAdmin, attendanceController.exportAttendanceSummary)

// ============================================================================
// REPORTS > Print Attendance Sheets
// Excel download of attendance sheets
// ============================================================================

router.get('/reports/sheets', requireAdmin, attendanceController.printAttendanceSheets)
router.get('/reports/course-periods', requireAdmin, attendanceController.getCoursePeriods)
router.post('/reports/sheets/course-periods', requireAdmin, attendanceController.downloadCoursePeriodSheets)

// ============================================================================
// UTILITIES > Recalculate Daily Attendance
// Batch-recalculate attendance_daily from attendance_records
// ============================================================================

router.post('/utilities/recalculate', requireAdmin, attendanceController.recalculateDailyAttendance)

// ============================================================================
// UTILITIES > Delete Duplicate Attendance
// Find and remove duplicate attendance_records
// ============================================================================

router.get('/utilities/duplicates', requireAdmin, attendanceController.findDuplicateAttendance)
router.post('/utilities/duplicates/delete', requireAdmin, attendanceController.deleteDuplicateAttendance)

// ============================================================================
// Attendance Completion
// Teachers mark attendance as completed for a period
// ============================================================================

router.post('/completed', requireTeacher, attendanceController.markAttendanceCompleted)

export default router
