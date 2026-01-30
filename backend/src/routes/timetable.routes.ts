import { Router } from 'express'
import * as timetableController from '../controllers/timetable.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireAdmin, requireTeacher } from '../middlewares/role.middleware'

const router = Router()

// All routes require authentication
router.use(authenticate)

// ============================================================================
// STEP 2: TIMETABLE CONSTRUCTION ROUTES
// ============================================================================

router.get('/section', requireTeacher, timetableController.getTimetableBySection)
router.get('/teacher', requireTeacher, timetableController.getTimetableByTeacher)
router.get('/available-subjects', requireAdmin, timetableController.getAvailableSubjectsForSection)
router.get('/check-conflict', requireAdmin, timetableController.checkTeacherConflict)
router.post('/', requireAdmin, timetableController.createTimetableEntry)
router.put('/:id', requireAdmin, timetableController.updateTimetableEntry)
router.delete('/:id', requireAdmin, timetableController.deleteTimetableEntry)

// ============================================================================
// STEP 4: TEACHER'S SCHEDULE VIEW ROUTES
// ============================================================================

router.get('/teacher-schedule', requireTeacher, timetableController.getTeacherSchedule)
router.get('/teacher-timetable', requireTeacher, timetableController.getTeacherTimetable)
router.get('/current-class', requireTeacher, timetableController.getCurrentClass)
router.get('/next-class', requireTeacher, timetableController.getNextClass)

// ============================================================================
// STEP 3 & 4: ATTENDANCE ROUTES
// ============================================================================

router.post('/attendance/generate', requireAdmin, timetableController.generateDailyAttendance)
router.get('/attendance/class', requireTeacher, timetableController.getAttendanceForClass)
router.get('/attendance/section-date', requireTeacher, timetableController.getAttendanceForSectionDate)
router.put('/attendance/:id', requireTeacher, timetableController.updateAttendanceRecord)
router.post('/attendance/bulk-update', requireTeacher, timetableController.bulkUpdateAttendance)
router.get('/attendance/stats', requireTeacher, timetableController.getAttendanceStats)
router.get('/attendance/student-history', requireTeacher, timetableController.getStudentAttendanceHistory)
router.get('/attendance/class-summary', requireTeacher, timetableController.getClassAttendanceSummary)
router.get('/attendance/teacher-overview', requireTeacher, timetableController.getTeacherAttendanceOverview)

export default router
