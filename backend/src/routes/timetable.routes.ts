import { Router } from 'express'
import * as timetableController from '../controllers/timetable.controller'
import * as requirementsController from '../controllers/timetable-requirements.controller'
import * as constraintsController from '../controllers/teacher-constraints.controller'
import * as generationController from '../controllers/timetable-generation.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireAdmin, requireTeacher } from '../middlewares/role.middleware'

const router = Router()

// All routes require authentication
router.use(authenticate)

// ============================================================================
// TIMETABLE GENERATOR — GENERATION JOBS (Phase 2)
// ============================================================================

router.post('/generate', requireAdmin, generationController.startGeneration)
router.get('/generate/jobs', requireAdmin, generationController.listJobs)
router.get('/generate/:jobId/status', requireAdmin, generationController.getJobStatus)
router.post('/generate/:jobId/cancel', requireAdmin, generationController.cancelJob)
router.post('/generate/:jobId/rollback', requireAdmin, generationController.rollbackJob)

// ============================================================================
// TIMETABLE GENERATOR — REQUIREMENTS (Phase 2)
// ============================================================================

router.get('/requirements', requireAdmin, requirementsController.listRequirements)
router.post('/requirements', requireAdmin, requirementsController.createRequirement)
router.post('/requirements/bulk', requireAdmin, requirementsController.bulkCreateRequirements)
router.post('/requirements/seed-from-assignments', requireAdmin, requirementsController.seedFromAssignments)
router.get('/requirements/coverage', requireAdmin, requirementsController.getCoverage)
router.put('/requirements/:id', requireAdmin, requirementsController.updateRequirement)
router.delete('/requirements/:id', requireAdmin, requirementsController.deleteRequirement)

// ============================================================================
// TIMETABLE GENERATOR — TEACHER CONSTRAINTS + GENERATION SETTINGS (Phase 2)
// ============================================================================

router.get('/teacher-constraints', requireAdmin, constraintsController.listTeacherConstraints)
router.get('/teacher-constraints/:teacherId', requireAdmin, constraintsController.getTeacherConstraints)
router.put('/teacher-constraints/:teacherId', requireAdmin, constraintsController.upsertTeacherConstraints)

router.get('/generation-settings', requireAdmin, constraintsController.getGenerationSettings)
router.put('/generation-settings', requireAdmin, constraintsController.updateGenerationSettings)

// ============================================================================
// TIMETABLE GENERATOR — LOCK / UNLOCK (Phase 2)
// ============================================================================

router.put('/:id/lock', requireAdmin, timetableController.lockTimetableEntry)
router.post('/bulk-lock', requireAdmin, timetableController.bulkLockTimetableEntries)

// ============================================================================
// BULK IMPORT ROUTES
// ============================================================================

router.get('/import-template', requireAdmin, timetableController.getTimetableImportTemplate)
router.post('/bulk-import', requireAdmin, timetableController.bulkImportTimetable)

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
