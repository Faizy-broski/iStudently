import { Response } from 'express'

import { AuthRequest } from '../middlewares/auth.middleware'
import { schoolRootId } from '../utils/campus-validation'
import * as jg from '../services/jahbadh/grades.service'
import { printHeader, renderReportCardPdf, renderReportCardsPdf, renderResultsPdf, renderSecondRoundPdf } from '../services/jahbadh/print.service'
import * as rc from '../services/jahbadh/report-cards.service'
import * as an from '../services/jahbadh/analytics.service'
import { renderAnalysisCardPdf, renderItemAnalysisPdf, renderStudentProfilePdf } from '../services/jahbadh/print.service'
import { JG_ITEM_VERDICTS_AR, JG_RELIABILITY_AR, JG_RESULT_LABELS } from '../lib/jahbadh'
import { sampleReportCardData } from '../services/jahbadh/report-card-sample'

type Handler = (req: AuthRequest, res: Response) => Promise<unknown>

/** Wraps a handler: JgError → its status/code, anything else → 500 (logged). */
const handle = (fn: Handler) => async (req: AuthRequest, res: Response) => {
  try {
    const data = await fn(req, res)
    if (!res.headersSent) res.json({ success: true, data })
  } catch (err: any) {
    if (err instanceof jg.JgError) {
      return res.status(err.status).json({ success: false, error: err.message, code: err.code, details: err.details })
    }
    // A Jahbadh table that does not exist yet: a migration has not been run on this database.
    const missing = err?.code === 'PGRST205' || err?.code === '42P01' ? String(err?.message ?? '').match(/(jg|jc)_[a-z0-9_]+/)?.[0] : null
    if (missing) {
      return res.status(503).json({ success: false, error: `Database update missing: table ${missing} does not exist. Run the Jahbadh migrations (backend/migrations/jahbadh_*.sql).`, code: 'not_migrated' })
    }
    console.error('[jahbadh-grades]', err)
    return res.status(500).json({ success: false, error: err?.message || 'Unexpected error' })
  }
}

const actorOf = (req: AuthRequest): jg.JgActor => ({
  profileId: req.profile?.id,
  role: req.profile?.role,
  staffId: req.profile?.staff_id ?? null,
})

/** The campus the request works on: the admin's selected campus_id, else the caller's own campus/school. */
const campusOf = (req: AuthRequest): string =>
  (req.query.campus_id as string) || req.body?.campus_id || req.profile?.campus_id || req.profile?.school_id

async function rootOf(req: AuthRequest): Promise<string> {
  const root = await schoolRootId(req.profile?.school_id)
  if (!root) throw new jg.JgError(403, 'No school context')
  return root
}

async function versionOf(req: AuthRequest, root: string) {
  return (req.query.version as string) || (await jg.getSettings(root, campusOf(req))).version_label
}

const ctxOf = (req: AuthRequest) =>
  jg.sectionContext(req.params.sectionId, req.profile?.school_id, actorOf(req), (req.query.academic_year_id as string) || null)

/** Optional list-number range (?from=&to=) or one student (?student_id=). */
const rangeOf = (req: AuthRequest) => ({
  from: Number(req.query.from) || undefined,
  to: Number(req.query.to) || undefined,
  studentIds: typeof req.query.student_id === 'string' && req.query.student_id ? [req.query.student_id] : undefined,
})

const analysisQuery = (req: AuthRequest) => ({
  subject: (req.query.subject as string) || undefined,
  measure: (req.query.measure as string) || undefined,
  compare: (req.query.compare as string) || undefined,
  pass: Number(req.query.pass) || undefined,
})

function sendPdf(res: Response, pdf: Buffer, filename: string) {
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(filename)}`)
  res.send(pdf)
}

export const jahbadhGradesController = {
  // rules
  listRules: handle(async (req) => {
    const root = await rootOf(req)
    return jg.listRules(root, await versionOf(req, root))
  }),
  getRule: handle(async (req) => {
    const root = await rootOf(req)
    const version = await versionOf(req, root)
    const code = Number(req.params.gradeCode)
    const grade = (await jg.getGrade(root, version, code)) ?? (await jg.listRules(root, version)).grades.find((g) => g.rule.grade_code === code)
    if (!grade) throw new jg.JgError(404, 'Grade not found')
    return grade
  }),
  updateRule: handle(async (req) => {
    const root = await rootOf(req)
    return jg.updateGrade(root, await versionOf(req, root), Number(req.params.gradeCode), req.body ?? {}, actorOf(req))
  }),
  setup: handle(async (req) => {
    const root = await rootOf(req)
    return jg.setupSchool(root, await versionOf(req, root), actorOf(req))
  }),

  // settings and links
  getSettings: handle(async (req) => jg.getSettings(await rootOf(req), campusOf(req))),
  saveSettings: handle(async (req) => {
    const root = await rootOf(req)
    const campus = (req.body?.campus_id as string) || null
    return jg.saveSettings(root, campus === root ? null : campus, req.body ?? {}, actorOf(req))
  }),
  getGradeMap: handle(async (req) => jg.getGradeMap(campusOf(req))),
  saveGradeMap: handle(async (req) => jg.saveGradeMap(campusOf(req), req.body?.entries ?? [], actorOf(req), await rootOf(req))),
  getSubjectLinks: handle(async (req) => {
    const root = await rootOf(req)
    return jg.getSubjectLinks(root, await versionOf(req, root), String(req.query.grade_level_id ?? ''))
  }),
  saveSubjectLinks: handle(async (req) => {
    const root = await rootOf(req)
    return jg.saveSubjectLinks(root, await versionOf(req, root), String(req.body?.grade_level_id ?? ''), req.body?.entries ?? [], actorOf(req))
  }),

  // sections
  listSections: handle(async (req) => jg.listSections(campusOf(req), actorOf(req))),
  sectionSubjects: handle(async (req) => {
    const ctx = await ctxOf(req)
    return {
      section: { ...ctx.section, grade_level_name: ctx.gradeLevelName },
      academic_year: { id: ctx.yearId, name: ctx.yearName },
      rule: ctx.grade.rule,
      settings: ctx.settings,
      subjects: jg.sectionSubjects(ctx),
    }
  }),
  grid: handle(async (req) => jg.getGrid(await ctxOf(req), req.params.subjectId)),
  saveMarks: handle(async (req) => jg.saveMarks(await ctxOf(req), req.params.subjectId, req.body?.cells ?? [], actorOf(req))),
  saveRound2: handle(async (req) => jg.saveRound2(await ctxOf(req), req.params.subjectId, req.body?.entries ?? [], actorOf(req))),
  listLocks: handle(async (req) => jg.loadLocks(await ctxOf(req))),
  addLock: handle(async (req) =>
    jg.addLock(await ctxOf(req), Number(req.body?.stage), (req.body?.subject_id as string) || null, actorOf(req)),
  ),
  removeLock: handle(async (req) => jg.removeLock(await ctxOf(req), req.params.lockId, actorOf(req))),
  results: handle(async (req) => jg.getResults(await ctxOf(req))),
  secondRound: handle(async (req) => jg.getSecondRound(await ctxOf(req))),
  audit: handle(async (req) => jg.getAudit(await ctxOf(req), Number(req.query.limit) || 200)),

  resultsPdf: handle(async (req, res) => {
    const ctx = await ctxOf(req)
    const [results, header] = await Promise.all([jg.getResults(ctx), printHeader(ctx.section.school_id, ctx.settings)])
    sendPdf(res, await renderResultsPdf(results, header), `results-${ctx.gradeLevelName}-${ctx.section.name}.pdf`)
  }),
  secondRoundPdf: handle(async (req, res) => {
    const ctx = await ctxOf(req)
    const [data, header] = await Promise.all([jg.getSecondRound(ctx), printHeader(ctx.section.school_id, ctx.settings)])
    sendPdf(res, await renderSecondRoundPdf(data, header), `second-round-${ctx.gradeLevelName}-${ctx.section.name}.pdf`)
  }),
  // activities, absence, notes, school days (B6-9)
  activities: handle(async (req) => rc.getActivities(await ctxOf(req), Number(req.query.stage) || 1)),
  saveActivities: handle(async (req) => rc.saveActivities(await ctxOf(req), Number(req.body?.stage) || 1, req.body ?? {}, actorOf(req))),

  // report cards (B7)
  reportCardSettings: handle(async (req) => rc.getReportCardSettings(await ctxOf(req))),
  saveReportCardSettings: handle(async (req) => rc.saveReportCardSettings(await ctxOf(req), req.body ?? {}, actorOf(req))),
  reportCards: handle(async (req) => {
    const ctx = await ctxOf(req)
    const scope = rc.parseScope(ctx, req.query.scope)
    return rc.buildReportCards(ctx, scope, rangeOf(req))
  }),
  reportCardsPdf: handle(async (req, res) => {
    const ctx = await ctxOf(req)
    const scope = rc.parseScope(ctx, req.query.scope)
    const { cards, options } = await rc.buildReportCards(ctx, scope, rangeOf(req))
    if (!cards.length) throw new jg.JgError(404, 'No report cards in this range')
    sendPdf(res, await renderReportCardsPdf(cards, options), `report-cards-${ctx.gradeLevelName}-${ctx.section.name}-${scope}.pdf`)
  }),
  publications: handle(async (req) => rc.listPublications(await ctxOf(req))),
  publish: handle(async (req) => {
    const ctx = await ctxOf(req)
    return rc.publish(ctx, rc.parseScope(ctx, req.body?.scope), actorOf(req))
  }),
  unpublish: handle(async (req) => rc.unpublish(await ctxOf(req), req.params.publicationId, actorOf(req))),

  // students and parents: published cards only
  myReportCards: handle(async (req) => rc.myReportCards(req.profile?.role, req.profile?.id)),
  myReportCardPdf: handle(async (req, res) => {
    const own = await rc.ownStudents(req.profile?.role, req.profile?.id)
    const student = own.find((s) => s.id === req.params.studentId)
    if (!student?.section_id) throw new jg.JgError(404, 'Report card not found')
    const ctx = await jg.sectionContext(student.section_id, req.profile?.school_id, actorOf(req))
    const scope = rc.parseScope(ctx, req.params.scope)
    if (!(await rc.listPublications(ctx)).some((p) => p.scope === scope)) throw new jg.JgError(404, 'This report card has not been released yet')
    const { cards, options } = await rc.buildReportCards(ctx, scope, { studentIds: [student.id] })
    if (!cards.length) throw new jg.JgError(404, 'Report card not found')
    sendPdf(res, await renderReportCardPdf(cards[0], options), `report-card-${scope}.pdf`)
  }),

  // analytics (B6-6 … B6-14)
  dashboard: handle(async (req) => an.dashboard(await ctxOf(req))),
  earlyWarning: handle(async (req) => an.earlyWarning(await ctxOf(req))),
  learningGroups: handle(async (req) => an.learningGroups(await ctxOf(req), (req.query.subject as string) || null)),
  studentProfile: handle(async (req) => an.studentProfile(await ctxOf(req), req.params.studentId)),
  studentProfilePdf: handle(async (req, res) => {
    const ctx = await ctxOf(req)
    const [p, header] = await Promise.all([an.studentProfile(ctx, req.params.studentId), printHeader(ctx.section.school_id, ctx.settings)])
    const stageNames = p.stages.map((n) => p.stage_names[n - 1] ?? String(n))
    sendPdf(res, await renderStudentProfilePdf({
      title: `بطاقة النتيجة — الصف ${ctx.gradeLevelName} — العام الدراسي ${ctx.yearName ?? ''}`,
      sectionTitle: `${ctx.gradeLevelName} — ${ctx.section.name}`,
      studentName: p.student.name,
      stageNames,
      subjects: p.subjects.map((s) => ({ ...s, stages: p.stages.map((n) => s.stages[n] ?? null), result: s.result ? JG_RESULT_LABELS[s.result] : null })),
      total: p.total, max: p.max, pct: p.pct, estimate: p.estimate, rank: p.rank, classSize: p.class_size,
      supportSubjects: p.support_subjects, decision: p.decision, feedback: p.feedback,
    }, header), `student-${p.list_number}.pdf`)
  }),
  subjectAnalysis: handle(async (req) => an.subjectAnalysis(await ctxOf(req), analysisQuery(req))),
  subjectAnalysisPdf: handle(async (req, res) => {
    const ctx = await ctxOf(req)
    const [d, header] = await Promise.all([an.subjectAnalysis(ctx, analysisQuery(req)), printHeader(ctx.section.school_id, ctx.settings)])
    sendPdf(res, await renderAnalysisCardPdf({
      sectionTitle: `${header.schoolName} — العام الدراسي ${ctx.yearName ?? ''} — ${ctx.gradeLevelName} ${ctx.section.name}`,
      subject: d.subject.name, measureLabel: d.measure.label, measureMax: d.measure.max, compareLabel: d.compare?.label ?? null,
      passRate: d.pass_rate, learners: d.learners, analysis: d.analysis, reading: d.reading,
      date: new Date().toISOString().slice(0, 10).replace(/-/g, '/'),
    }, header), `analysis-${d.subject.name}.pdf`)
  }),
  listTests: handle(async (req) => an.listTests(await ctxOf(req))),
  getTest: handle(async (req) => an.getTest(await ctxOf(req), req.params.testId)),
  createTest: handle(async (req) => an.saveTest(await ctxOf(req), null, req.body ?? {}, actorOf(req))),
  updateTest: handle(async (req) => an.saveTest(await ctxOf(req), req.params.testId, req.body ?? {}, actorOf(req))),
  deleteTest: handle(async (req) => an.deleteTest(await ctxOf(req), req.params.testId)),
  testPdf: handle(async (req, res) => {
    const ctx = await ctxOf(req)
    const [t, header] = await Promise.all([an.getTest(ctx, req.params.testId), printHeader(ctx.section.school_id, ctx.settings)])
    sendPdf(res, await renderItemAnalysisPdf({
      name: t.name,
      subject: ctx.grade.subjects.find((s) => s.id === t.jg_subject_id)?.short_name ?? null,
      date: t.test_date,
      sectionTitle: `${ctx.gradeLevelName} — ${ctx.section.name}`,
      questions: t.questions,
      students: t.students.map((s: any) => ({ name: s.student.name, scores: t.scores[s.student.id] ?? [], total: s.total, pct: s.pct, rank: s.rank })),
      analysis: t.analysis,
      verdictLabels: JG_ITEM_VERDICTS_AR,
      reliabilityLabels: JG_RELIABILITY_AR,
    }, header), `test-analysis.pdf`)
  }),
  listRubrics: handle(async (req) => an.listRubrics(await ctxOf(req))),
  getRubric: handle(async (req) => an.getRubric(await ctxOf(req), req.params.rubricId)),
  createRubric: handle(async (req) => an.saveRubric(await ctxOf(req), null, req.body ?? {}, actorOf(req))),
  updateRubric: handle(async (req) => an.saveRubric(await ctxOf(req), req.params.rubricId, req.body ?? {}, actorOf(req))),
  deleteRubric: handle(async (req) => an.deleteRubric(await ctxOf(req), req.params.rubricId)),
  applyRubric: handle(async (req) =>
    an.applyRubric(await ctxOf(req), req.params.rubricId, String(req.body?.subject_id ?? ''), String(req.body?.component_id ?? ''), actorOf(req)),
  ),

  sampleReportCard: handle(async (_req, res) => {
    sendPdf(res, await renderReportCardPdf(sampleReportCardData()), 'sample-report-card.pdf')
  }),
}
