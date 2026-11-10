import { Router } from 'express'
import multer from 'multer'

import { jahbadhGradesController as c } from '../controllers/jahbadh-grades.controller'
import { jahbadhDataController as d } from '../controllers/jahbadh-data.controller'
import { jahbadhOfficialController as o } from '../controllers/jahbadh-official.controller'
import { jahbadhAssessmentController as qa } from '../controllers/jahbadh-assessment.controller'
import { jahbadhInsightController as i } from '../controllers/jahbadh-insight.controller'
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
router.get('/setup/upgrade-preview', admin, c.upgradePreview)
router.post('/setup/upgrade', admin, c.upgradeApply)
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
router.get('/sections/:sectionId/subjects/:subjectId/grid.pdf', adminOrTeacher, c.gridPdf)
router.put('/sections/:sectionId/subjects/:subjectId/marks', adminOrTeacher, c.saveMarks)
router.put('/sections/:sectionId/subjects/:subjectId/subitem-marks', adminOrTeacher, c.saveSubItemMarks)
router.get('/sections/:sectionId/subjects/:subjectId/monthly', adminOrTeacher, c.monthly)
router.put('/sections/:sectionId/subjects/:subjectId/monthly', adminOrTeacher, c.saveMonthly)
router.get('/sections/:sectionId/subjects/:subjectId/monthly.pdf', adminOrTeacher, c.monthlyPdf)
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

// Wave 2 data workflows (brief B6 #25, #26, #29, B9)
// Name import: paste the list (JSON `text`) or upload a .csv/.xlsx (`file`); preview, then apply.
const importUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } })
router.post('/sections/:sectionId/import/preview', admin, importUpload.single('file'), d.importPreview)
router.post('/sections/:sectionId/import/apply', admin, importUpload.single('file'), d.importApply)
// Daily attendance per stage: the school calendar (stage starts, weekend, holidays, alert limit) and the codes.
router.get('/attendance-calendar', adminOrTeacher, d.getCalendar)
router.put('/attendance-calendar', admin, d.saveCalendar)
router.get('/sections/:sectionId/daily-attendance', adminOrTeacher, d.dailyAttendance)
router.put('/sections/:sectionId/daily-attendance', adminOrTeacher, d.saveDailyAttendance)
// Rollover to next year: the plan for the platform's year-end rollover.
router.get('/sections/:sectionId/rollover', admin, d.rolloverPreview)
router.post('/sections/:sectionId/rollover', admin, d.rolloverApply)
// Homeroom teacher («رائد الفصل»): sees every subject of the section read-only.
router.get('/sections/:sectionId/homeroom', adminOrTeacher, d.getHomeroom)
router.put('/sections/:sectionId/homeroom', admin, d.setHomeroom)

// Wave 2 official outputs (brief B6 #17–24, #27, #28, #47): JSON for the screens and A4 PDFs.
router.get('/sections/:sectionId/statistics', adminOrTeacher, o.statistics)
router.get('/sections/:sectionId/statistics.pdf', adminOrTeacher, o.statisticsPdf)
router.get('/sections/:sectionId/top-students', adminOrTeacher, o.topStudents)
router.get('/sections/:sectionId/top-students.pdf', adminOrTeacher, o.topStudentsPdf)
router.get('/sections/:sectionId/final-sheet', adminOrTeacher, o.finalSheet)
router.get('/sections/:sectionId/final-sheet.pdf', adminOrTeacher, o.finalSheetPdf)
router.get('/sections/:sectionId/review-sheet', adminOrTeacher, o.reviewSheet)
router.get('/sections/:sectionId/review-sheet.pdf', adminOrTeacher, o.reviewSheetPdf)
router.get('/sections/:sectionId/second-round/entry-sheet', adminOrTeacher, o.round2Sheet)
router.get('/sections/:sectionId/second-round/entry-sheet.pdf', adminOrTeacher, o.round2SheetPdf)
router.get('/sections/:sectionId/second-round/timetable', adminOrTeacher, o.round2Timetable)
router.put('/sections/:sectionId/second-round/timetable', admin, o.saveRound2Timetable)
router.get('/sections/:sectionId/second-round/notices', adminOrTeacher, o.round2Notices)
router.get('/sections/:sectionId/second-round/notices.pdf', adminOrTeacher, o.round2NoticesPdf)
router.post('/sections/:sectionId/second-round/notices/send', admin, o.sendRound2Notices)
router.get('/sections/:sectionId/guardian-notices', adminOrTeacher, o.guardianNotices)
router.get('/sections/:sectionId/guardian-notices.pdf', adminOrTeacher, o.guardianNoticesPdf)
router.post('/sections/:sectionId/guardian-notices/send', admin, o.sendGuardianNotices)
router.get('/sections/:sectionId/monthly-cards', adminOrTeacher, o.monthlyCards)
router.get('/sections/:sectionId/monthly-cards.pdf', adminOrTeacher, o.monthlyCardsPdf)
router.get('/sections/:sectionId/monthly-curve', adminOrTeacher, o.monthlyCurve)
router.get('/sections/:sectionId/monthly-curve.pdf', adminOrTeacher, o.monthlyCurvePdf)
router.get('/sections/:sectionId/marking-sheets', adminOrTeacher, o.markingSheets)
router.get('/sections/:sectionId/marking-sheets.pdf', adminOrTeacher, o.markingSheetsPdf)
router.get('/sections/:sectionId/report-cards.zip', adminOrTeacher, o.reportCardsBundle)

// Students and parents: released report cards of their own students
const family = requireRole('student', 'parent')
router.get('/my/report-cards', family, c.myReportCards)
router.get('/my/report-cards/:studentId/:scope', family, c.myReportCardPdf) // PDF

// Teacher quiz auto-grading into a grade column (brief #61, Wave 6); ownership and locks in the service.
router.get('/sections/:sectionId/quiz-grading/targets', adminOrTeacher, qa.quizTargets)
router.get('/sections/:sectionId/quiz-grading', adminOrTeacher, qa.listQuizKeys)
router.post('/sections/:sectionId/quiz-grading', adminOrTeacher, qa.saveQuizKey)
router.get('/sections/:sectionId/quiz-grading/:quizKeyId', adminOrTeacher, qa.getQuizKey)
router.delete('/sections/:sectionId/quiz-grading/:quizKeyId', adminOrTeacher, qa.deleteQuizKey)
router.put('/sections/:sectionId/quiz-grading/:quizKeyId/answers', adminOrTeacher, qa.saveQuizAnswers)
router.get('/sections/:sectionId/quiz-grading/:quizKeyId/commit', adminOrTeacher, qa.commitPreview)
router.post('/sections/:sectionId/quiz-grading/:quizKeyId/commit', adminOrTeacher, qa.commit)

// Wave 5 insight and administration (brief B6-30 … B6-50, B6-62). Coordinators (staff) and inspectors read
// (B6-45); writes are checked in the controller (admins; teachers for support plans and points).
const readers = requireRole('admin', 'super_admin', 'teacher', 'staff', 'inspector')
router.get('/insight-settings', readers, i.insightSettings)
router.put('/insight-settings', admin, i.saveInsightSettings)
router.get('/phrase-bank', readers, i.phraseBank)
router.put('/phrase-bank', admin, i.savePhraseBank)
router.get('/excellence-categories', readers, i.excellenceCategories)
router.put('/excellence-categories', admin, i.saveExcellenceCategories)
router.get('/principal-dashboard', readers, i.principalDashboard)
router.get('/principal-dashboard.pdf', readers, i.principalDashboardPdf)
router.get('/section-allocation', readers, i.allocation)
router.get('/section-allocation.pdf', readers, i.allocationPdf)
router.get('/marking-fairness', readers, i.fairness)
router.get('/marking-fairness.pdf', readers, i.fairnessPdf)
router.get('/sections/:sectionId/workflow', readers, i.workflow)
router.get('/sections/:sectionId/infographics', readers, i.infographics)
router.get('/sections/:sectionId/prediction', readers, i.prediction)
router.get('/sections/:sectionId/prediction.pdf', readers, i.predictionPdf)
router.get('/sections/:sectionId/edge-students', readers, i.edge)
router.get('/sections/:sectionId/edge-students.pdf', readers, i.edgePdf)
router.get('/sections/:sectionId/inflation', readers, i.inflation)
router.get('/sections/:sectionId/inflation.pdf', readers, i.inflationPdf)
router.get('/sections/:sectionId/auto-comments', readers, i.autoComments)
router.get('/sections/:sectionId/auto-comments.pdf', readers, i.autoCommentsPdf)
router.get('/sections/:sectionId/weak-items', readers, i.weakItems)
router.get('/sections/:sectionId/weak-items.pdf', readers, i.weakItemsPdf)
router.post('/sections/:sectionId/what-if', admin, i.whatIf)
router.post('/sections/:sectionId/what-if.pdf', admin, i.whatIfPdf)
router.get('/sections/:sectionId/what-if/scenarios', admin, i.scenarios)
router.post('/sections/:sectionId/what-if/scenarios', admin, i.createScenario)
router.put('/sections/:sectionId/what-if/scenarios/:scenarioId', admin, i.updateScenario)
router.delete('/sections/:sectionId/what-if/scenarios/:scenarioId', admin, i.deleteScenario)
router.get('/sections/:sectionId/entry-audit', readers, i.audit)
router.get('/sections/:sectionId/entry-audit.pdf', readers, i.auditPdf)
router.get('/sections/:sectionId/approval', readers, i.approval)
router.get('/sections/:sectionId/approval.pdf', readers, i.approvalPdf)
router.post('/sections/:sectionId/approval', admin, i.approve)
router.get('/sections/:sectionId/verification', readers, i.verification)
router.get('/sections/:sectionId/verification.pdf', readers, i.verificationPdf)
router.post('/sections/:sectionId/verification', adminOrTeacher, i.issueCodes)
router.get('/sections/:sectionId/verification/check', readers, i.checkCode)
router.get('/sections/:sectionId/certificates', readers, i.certificates)
router.get('/sections/:sectionId/certificates.pdf', readers, i.certificatesPdf)
router.get('/sections/:sectionId/support-plans', readers, i.supportPlans)
router.get('/sections/:sectionId/support-plans.pdf', readers, i.supportPlansPdf)
router.put('/sections/:sectionId/support-plans/:studentId', adminOrTeacher, i.saveSupportPlan)
router.get('/sections/:sectionId/absence-impact', readers, i.absenceImpact)
router.get('/sections/:sectionId/absence-impact.pdf', readers, i.absenceImpactPdf)
router.get('/sections/:sectionId/entry-progress', readers, i.entryProgress)
router.get('/sections/:sectionId/entry-progress.pdf', readers, i.entryProgressPdf)
router.post('/sections/:sectionId/entry-progress/reminders', admin, i.sendReminders)
router.get('/sections/:sectionId/stage-deadlines', readers, i.deadlines)
router.put('/sections/:sectionId/stage-deadlines', admin, i.saveDeadlines)
router.get('/sections/:sectionId/excellence', readers, i.excellence)
router.get('/sections/:sectionId/excellence.pdf', readers, i.excellencePdf)
router.post('/sections/:sectionId/excellence', adminOrTeacher, i.addPoints)
router.delete('/sections/:sectionId/excellence/:entryId', adminOrTeacher, i.deletePoints)
router.get('/sections/:sectionId/end-of-year', readers, i.endOfYear)
router.get('/sections/:sectionId/end-of-year.pdf', readers, i.endOfYearPdf)
router.put('/sections/:sectionId/end-of-year', admin, i.saveEndOfYear)

export default router
