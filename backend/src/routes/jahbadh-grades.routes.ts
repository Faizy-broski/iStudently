import { Router } from 'express'

import { jahbadhGradesController as c } from '../controllers/jahbadh-grades.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireJahbadhGradesEnabled } from '../middlewares/jahbadh-grades-enabled.middleware'
import { requireRole } from '../middlewares/role.middleware'

/**
 * Jahbadh grades plugin (official Libyan distribution). Admins (and staff granted the grades
 * module) manage rules, links, locks and see every subject; teachers see only the sections they
 * teach and enter marks only for their own subjects (checked in the service, via course periods
 * linked to memo subjects). Every write is audited (jg_audit_log).
 */
const router = Router()

router.use(authenticate)
router.use(requireJahbadhGradesEnabled)

const admin = requireRole('admin', 'super_admin')
const adminOrTeacher = requireRole('admin', 'super_admin', 'teacher')

// Official distribution (rules)
router.get('/rules', adminOrTeacher, c.listRules)
router.get('/rules/:gradeCode', adminOrTeacher, c.getRule)
router.put('/rules/:gradeCode', admin, c.updateRule)
router.post('/setup', admin, c.setup)
router.get('/sample-report-card.pdf', admin, c.sampleReportCard)

// Settings and school links
router.get('/settings', adminOrTeacher, c.getSettings)
router.put('/settings', admin, c.saveSettings)
router.get('/grade-map', admin, c.getGradeMap)
router.put('/grade-map', admin, c.saveGradeMap)
router.get('/subject-links', admin, c.getSubjectLinks)
router.put('/subject-links', admin, c.saveSubjectLinks)

// Sections, grids and results
router.get('/sections', adminOrTeacher, c.listSections)
router.get('/sections/:sectionId/subjects', adminOrTeacher, c.sectionSubjects)
router.get('/sections/:sectionId/subjects/:subjectId/grid', adminOrTeacher, c.grid)
router.put('/sections/:sectionId/subjects/:subjectId/marks', adminOrTeacher, c.saveMarks)
router.put('/sections/:sectionId/subjects/:subjectId/round2', adminOrTeacher, c.saveRound2)
router.get('/sections/:sectionId/locks', adminOrTeacher, c.listLocks)
router.post('/sections/:sectionId/locks', admin, c.addLock)
router.delete('/sections/:sectionId/locks/:lockId', admin, c.removeLock)
router.get('/sections/:sectionId/results', adminOrTeacher, c.results)
router.get('/sections/:sectionId/results.pdf', adminOrTeacher, c.resultsPdf)
router.get('/sections/:sectionId/second-round', adminOrTeacher, c.secondRound)
router.get('/sections/:sectionId/second-round.pdf', adminOrTeacher, c.secondRoundPdf)
router.get('/sections/:sectionId/audit', admin, c.audit)

// Activities, absence and notes (homeroom data printed on report cards)
router.get('/sections/:sectionId/activities', adminOrTeacher, c.activities)
router.put('/sections/:sectionId/activities', adminOrTeacher, c.saveActivities)

// Report cards (B7): options per section, preview data, PDF (batch or range), publishing
router.get('/sections/:sectionId/report-card-settings', adminOrTeacher, c.reportCardSettings)
router.put('/sections/:sectionId/report-card-settings', adminOrTeacher, c.saveReportCardSettings)
router.get('/sections/:sectionId/report-cards', adminOrTeacher, c.reportCards)
router.get('/sections/:sectionId/report-cards.pdf', adminOrTeacher, c.reportCardsPdf)
router.get('/sections/:sectionId/publications', adminOrTeacher, c.publications)
router.post('/sections/:sectionId/publications', admin, c.publish)
router.delete('/sections/:sectionId/publications/:publicationId', admin, c.unpublish)

// Analytics (B6-6 … B6-14): admins, and teachers for the sections they teach
router.get('/sections/:sectionId/dashboard', adminOrTeacher, c.dashboard)
router.get('/sections/:sectionId/early-warning', adminOrTeacher, c.earlyWarning)
router.get('/sections/:sectionId/groups', adminOrTeacher, c.learningGroups)
router.get('/sections/:sectionId/students/:studentId/profile', adminOrTeacher, c.studentProfile)
router.get('/sections/:sectionId/students/:studentId/profile/pdf', adminOrTeacher, c.studentProfilePdf)
router.get('/sections/:sectionId/subject-analysis', adminOrTeacher, c.subjectAnalysis)
router.get('/sections/:sectionId/subject-analysis/pdf', adminOrTeacher, c.subjectAnalysisPdf)
router.get('/sections/:sectionId/tests', adminOrTeacher, c.listTests)
router.post('/sections/:sectionId/tests', adminOrTeacher, c.createTest)
router.get('/sections/:sectionId/tests/:testId', adminOrTeacher, c.getTest)
router.put('/sections/:sectionId/tests/:testId', adminOrTeacher, c.updateTest)
router.delete('/sections/:sectionId/tests/:testId', adminOrTeacher, c.deleteTest)
router.get('/sections/:sectionId/tests/:testId/pdf', adminOrTeacher, c.testPdf)
router.get('/sections/:sectionId/rubrics', adminOrTeacher, c.listRubrics)
router.post('/sections/:sectionId/rubrics', adminOrTeacher, c.createRubric)
router.get('/sections/:sectionId/rubrics/:rubricId', adminOrTeacher, c.getRubric)
router.put('/sections/:sectionId/rubrics/:rubricId', adminOrTeacher, c.updateRubric)
router.delete('/sections/:sectionId/rubrics/:rubricId', adminOrTeacher, c.deleteRubric)
router.post('/sections/:sectionId/rubrics/:rubricId/apply', adminOrTeacher, c.applyRubric)

// Students and parents: released report cards of their own students
const family = requireRole('student', 'parent')
router.get('/my/report-cards', family, c.myReportCards)
router.get('/my/report-cards/:studentId/:scope', family, c.myReportCardPdf) // PDF

export default router
