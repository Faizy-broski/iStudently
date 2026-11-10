import { Router } from 'express'
import * as timetableController from '../controllers/timetable.controller'
import * as requirementsController from '../controllers/timetable-requirements.controller'
import * as constraintsController from '../controllers/teacher-constraints.controller'
import * as generationController from '../controllers/timetable-generation.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireAdmin, requireTeacher } from '../middlewares/role.middleware'
import { requireRowInSchoolFamily } from '../middlewares/row-school-scope.middleware'
import { requireOwnClass, requireOwnStudents, requireSelfTeacherId, timetableEntryOfAttendance } from '../middlewares/own-course-period.middleware'

const router = Router()

// All routes require authentication
router.use(authenticate)

// Timetable entries addressed by id must belong to the caller's school family.
const entryRow = requireRowInSchoolFamily('timetable_entries')
const requirementRow = requireRowInSchoolFamily('timetable_requirements')
const jobRow = requireRowInSchoolFamily('timetable_generation_jobs', 'jobId')
const teacherRow = requireRowInSchoolFamily('staff', 'teacherId')
const yearInQuery = requireRowInSchoolFamily('academic_years', 'academic_year_id', 'school_id', 'query')
const yearInBody = requireRowInSchoolFamily('academic_years', 'academic_year_id', 'school_id', 'body')
const teacherInQuery = requireRowInSchoolFamily('staff', 'teacher_id', 'school_id', 'query')

// ============================================================================
// TIMETABLE GENERATOR — GENERATION JOBS (Phase 2)
// ============================================================================

router.post('/generate', requireAdmin, yearInBody, generationController.startGeneration)
router.get('/generate/jobs', requireAdmin, generationController.listJobs)
router.get('/generate/:jobId/status', requireAdmin, jobRow, generationController.getJobStatus)
router.post('/generate/:jobId/cancel', requireAdmin, jobRow, generationController.cancelJob)
router.post('/generate/:jobId/rollback', requireAdmin, jobRow, generationController.rollbackJob)

// ============================================================================
// TIMETABLE GENERATOR — REQUIREMENTS (Phase 2)
// ============================================================================

router.get('/requirements', requireAdmin, yearInQuery, requirementsController.listRequirements)
router.post('/requirements', requireAdmin, yearInBody, requirementsController.createRequirement)
router.post('/requirements/bulk', requireAdmin, requirementsController.bulkCreateRequirements)
router.post('/requirements/seed-from-assignments', requireAdmin, yearInBody, requirementsController.seedFromAssignments)
router.get('/requirements/coverage', requireAdmin, yearInQuery, requirementsController.getCoverage)
router.put('/requirements/:id', requireAdmin, requirementRow, requirementsController.updateRequirement)
router.delete('/requirements/:id', requireAdmin, requirementRow, requirementsController.deleteRequirement)

// ============================================================================
// TIMETABLE GENERATOR — TEACHER CONSTRAINTS + GENERATION SETTINGS (Phase 2)
// ============================================================================

router.get('/teacher-constraints', requireAdmin, yearInQuery, constraintsController.listTeacherConstraints)
router.get('/teacher-constraints/:teacherId', requireAdmin, teacherRow, constraintsController.getTeacherConstraints)
router.put('/teacher-constraints/:teacherId', requireAdmin, teacherRow, constraintsController.upsertTeacherConstraints)

router.get('/generation-settings', requireAdmin, constraintsController.getGenerationSettings)
router.put('/generation-settings', requireAdmin, constraintsController.updateGenerationSettings)

// ============================================================================
// TIMETABLE GENERATOR — LOCK / UNLOCK (Phase 2)
// ============================================================================

router.put('/:id/lock', requireAdmin, entryRow, timetableController.lockTimetableEntry)
router.post('/bulk-lock', requireAdmin, timetableController.bulkLockTimetableEntries)

// ============================================================================
// BULK IMPORT ROUTES
// ============================================================================

router.get('/import-template', requireAdmin, timetableController.getTimetableImportTemplate)
router.post('/bulk-import', requireAdmin, timetableController.bulkImportTimetable)

// ============================================================================
// STEP 2: TIMETABLE CONSTRUCTION ROUTES
// ============================================================================

router.get('/section', requireTeacher, requireRowInSchoolFamily('sections', 'section_id', 'school_id', 'query'), yearInQuery, timetableController.getTimetableBySection)
router.get('/grade', requireTeacher, requireRowInSchoolFamily('grade_levels', 'grade_level_id', 'school_id', 'query'), yearInQuery, timetableController.getTimetableByGrade)
router.get('/teacher', requireTeacher, teacherInQuery, yearInQuery, timetableController.getTimetableByTeacher)
router.get('/available-subjects', requireAdmin, timetableController.getAvailableSubjectsForSection)
router.get('/check-conflict', requireAdmin, timetableController.checkTeacherConflict)
router.post('/validate-change', requireAdmin, timetableController.validateScheduleChange)
router.post('/ensure-grade-section', requireAdmin, timetableController.ensureGradeSection)
router.post('/', requireAdmin, timetableController.createTimetableEntry)
router.put('/:id', requireAdmin, entryRow, timetableController.updateTimetableEntry)
router.delete('/:id', requireAdmin, entryRow, timetableController.deleteTimetableEntry)

// ============================================================================
// STEP 4: TEACHER'S SCHEDULE VIEW ROUTES
// ============================================================================

router.get('/teacher-schedule', requireTeacher, teacherInQuery, timetableController.getTeacherSchedule)
router.get('/teacher-timetable', requireTeacher, teacherInQuery, yearInQuery, timetableController.getTeacherTimetable)
router.get('/current-class', requireTeacher, teacherInQuery, timetableController.getCurrentClass)
router.get('/next-class', requireTeacher, teacherInQuery, timetableController.getNextClass)

// ============================================================================
// STEP 3 & 4: ATTENDANCE ROUTES
// ============================================================================

router.post('/attendance/generate', requireAdmin, timetableController.generateDailyAttendance)
// Class attendance: the class must be in the caller's school family, and teachers may only use their own classes.
const queryEntry = [requireRowInSchoolFamily('timetable_entries', 'timetable_entry_id', 'school_id', 'query'), requireOwnClass('entry', (req) => req.query.timetable_entry_id)]
router.get('/attendance/class', requireTeacher, ...queryEntry, timetableController.getAttendanceForClass)
router.get('/attendance/section-date', requireTeacher, requireRowInSchoolFamily('sections', 'section_id', 'school_id', 'query'), requireOwnClass('section', (req) => req.query.section_id), timetableController.getAttendanceForSectionDate)
router.put('/attendance/:id', requireTeacher, requireRowInSchoolFamily('attendance_records'), requireOwnClass('entry', (req) => timetableEntryOfAttendance(req.params.id)), timetableController.updateAttendanceRecord)
router.post('/attendance/bulk-update', requireTeacher, requireRowInSchoolFamily('timetable_entries', 'timetable_entry_id', 'school_id', 'body'), requireOwnClass('entry', (req) => req.body?.timetable_entry_id), timetableController.bulkUpdateAttendance)
router.get('/attendance/stats', requireTeacher, ...queryEntry, timetableController.getAttendanceStats)
router.get('/attendance/student-history', requireTeacher, requireRowInSchoolFamily('students', 'student_id', 'school_id', 'query'), requireOwnStudents((req) => req.query.student_id), timetableController.getStudentAttendanceHistory)
router.get('/attendance/class-summary', requireTeacher, requireRowInSchoolFamily('sections', 'section_id', 'school_id', 'query'), requireOwnClass('section', (req) => req.query.section_id), timetableController.getClassAttendanceSummary)
router.get('/attendance/teacher-overview', requireTeacher, teacherInQuery, requireSelfTeacherId('query'), timetableController.getTeacherAttendanceOverview)

export default router
