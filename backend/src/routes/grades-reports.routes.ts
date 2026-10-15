import express from 'express'
import * as gradesReportsController from '../controllers/grades-reports.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireAdmin } from '../middlewares/role.middleware'
import { ownStudentsOr } from '../middlewares/student-access.middleware'
import { requireBodyRowsInSchoolFamily } from '../middlewares/row-school-scope.middleware'

const router = express.Router()

router.use(authenticate)

// ============================================================================
// HONOR ROLL (RosarioSIS-style — direct per-grade threshold, no rules)
// ============================================================================

// GET /grades-reports/honor-roll?marking_period_id=&academic_year_id=&campus_id=
router.get('/honor-roll', gradesReportsController.getHonorRollStudents)

// ============================================================================
// CLASS RANK
// ============================================================================

// GET /grades-reports/class-rank?school_id=&academic_year_id=&marking_period_id=&section_id=&grade_level_id=
router.get('/class-rank', gradesReportsController.getClassRanks)
router.get('/gpa-rank', requireAdmin, gradesReportsController.getGpaRankList)

// POST /grades-reports/class-rank/recalculate (admin)
router.post('/class-rank/recalculate', requireAdmin, gradesReportsController.recalculateRanks)

// GET /grades-reports/course-class-rank?course_period_id=&marking_period_id=
router.get('/course-class-rank', gradesReportsController.getCourseClassRank)

// ============================================================================
// TRANSCRIPTS
// ============================================================================

// POST /grades-reports/transcripts/generate  (batch - for printing)
// Admins for the school's students; a student for themselves, a parent for linked children (web: /parent/grades/transcripts).
router.post('/transcripts/generate', ownStudentsOr(requireAdmin, (req) => req.body?.student_ids), requireBodyRowsInSchoolFamily('students', 'student_ids'), gradesReportsController.generateTranscripts)

// GET /grades-reports/transcript/:studentId
router.get('/transcript/:studentId', gradesReportsController.getTranscript)

// GET /grades-reports/transcript/:studentId/gpa (cumulative GPA)
router.get('/transcript/:studentId/gpa', gradesReportsController.getCumulativeGPA)

// POST /grades-reports/transcript/:studentId/generate (admin - generate from final grades)
router.post('/transcript/:studentId/generate', requireAdmin, gradesReportsController.generateTranscript)

// POST /grades-reports/transcript/transfer (admin - add transfer credit)
router.post('/transcript/transfer', requireAdmin, gradesReportsController.addTransferCredit)

export default router
