import { Request, Response } from 'express'

import { AuthRequest } from '../middlewares/auth.middleware'
import { schoolRootId } from '../utils/campus-validation'
import type { JgCertificateKind } from '../lib/jahbadh'
import * as jg from '../services/jahbadh/grades.service'
import * as ins from '../services/jahbadh/insight/insight.service'
import * as pr from '../services/jahbadh/insight/print-insight.service'
import { printHeader } from '../services/jahbadh/print.service'

/**
 * Wave 5 of the Jahbadh grades plugin (brief B6-30 … B6-50, B6-62): insight and administration. Same
 * section access as the rest of the plugin; coordinators (staff) and inspectors read (B6-45).
 */

type Handler = (req: AuthRequest, res: Response) => Promise<unknown>

const handle = (fn: Handler) => async (req: AuthRequest, res: Response) => {
  try {
    const data = await fn(req, res)
    if (!res.headersSent) res.json({ success: true, data })
  } catch (err: any) {
    if (err instanceof jg.JgError) return res.status(err.status).json({ success: false, error: err.message, code: err.code, details: err.details })
    if (jg.isNotMigrated(err)) {
      return res.status(503).json({ success: false, error: 'Database update missing: run backend/migrations/jahbadh_wave5.sql', code: 'not_migrated' })
    }
    console.error('[jahbadh-insight]', err)
    return res.status(500).json({ success: false, error: err?.message || 'Unexpected error' })
  }
}

const actorOf = (req: AuthRequest): jg.JgActor => ({ profileId: req.profile?.id, role: req.profile?.role, staffId: req.profile?.staff_id ?? null })
const ctxOf = (req: AuthRequest) =>
  jg.sectionContext(req.params.sectionId, req.profile?.school_id, actorOf(req), (req.query.academic_year_id as string) || null)
const headerOf = (ctx: jg.JgSectionContext) => printHeader(ctx.section.school_id, ctx.settings, { sectionId: ctx.section.id, yearId: ctx.yearId })
const num = (v: unknown) => (v === undefined || v === '' || v === null ? undefined : Number(v))
const rootOf = async (req: AuthRequest) => {
  const root = await schoolRootId(req.profile?.school_id)
  if (!root) throw new jg.JgError(404, 'School not found')
  return root
}
const campusOf = (req: AuthRequest) => (req.query.campus_id as string) || req.profile?.school_id
const adminOnly = (req: AuthRequest) => {
  if (!['admin', 'super_admin'].includes(req.profile?.role ?? '')) throw new jg.JgError(403, 'Admins only')
}
/** Teachers of the section and admins write (support plans, points); readers (staff, inspectors) don't. */
const writer = (req: AuthRequest) => {
  if (!['admin', 'super_admin', 'teacher'].includes(req.profile?.role ?? '')) throw new jg.JgError(403, 'Read-only access')
}
const label = (ctx: jg.JgSectionContext) => `${ctx.gradeLevelName}-${ctx.section.name}`

function sendPdf(res: Response, buf: Buffer, filename: string) {
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(filename)}`)
  res.send(buf)
}
/** JSON data → PDF of the same section. */
const sectionPdf = <D>(load: (req: AuthRequest, ctx: jg.JgSectionContext) => Promise<D>, html: (d: D, h: Awaited<ReturnType<typeof printHeader>>, req: AuthRequest) => string | Promise<string>, name: string, landscape = true) =>
  handle(async (req, res) => {
    const ctx = await ctxOf(req)
    const [d, h] = await Promise.all([load(req, ctx), headerOf(ctx)])
    sendPdf(res, await pr.pdf(await html(d, h, req), landscape), `${name}-${label(ctx)}.pdf`)
  })

const stageOf = (req: AuthRequest) => Number(req.query.stage)
const loaders = {
  prediction: (req: AuthRequest, ctx: jg.JgSectionContext) => ins.getPrediction(ctx, (req.query.student_id as string) || null),
  edge: (req: AuthRequest, ctx: jg.JgSectionContext) => ins.getEdge(ctx, { margin: num(req.query.margin), need: num(req.query.need) }),
  inflation: (req: AuthRequest, ctx: jg.JgSectionContext) => ins.getInflation(ctx, { gap: num(req.query.gap) }),
  comments: (req: AuthRequest, ctx: jg.JgSectionContext) => ins.getAutoComments(ctx, stageOf(req)),
  weak: (req: AuthRequest, ctx: jg.JgSectionContext) => ins.getWeakItems(ctx, String(req.query.subject ?? ''), stageOf(req)),
  audit: (_req: AuthRequest, ctx: jg.JgSectionContext) => ins.getAudit(ctx),
  approval: (_req: AuthRequest, ctx: jg.JgSectionContext) => ins.getApproval(ctx),
  archive: (_req: AuthRequest, ctx: jg.JgSectionContext) => ins.verificationArchive(ctx),
  certificates: (req: AuthRequest, ctx: jg.JgSectionContext) => ins.getCertificates(ctx, req.query.scope ?? 'final'),
  plans: (req: AuthRequest, ctx: jg.JgSectionContext) => ins.getSupportPlans(ctx, { weeks: num(req.query.weeks), studentId: (req.query.student_id as string) || null }),
  absence: (_req: AuthRequest, ctx: jg.JgSectionContext) => ins.getAbsenceImpact(ctx),
  progress: (_req: AuthRequest, ctx: jg.JgSectionContext) => ins.getEntryProgress(ctx),
  excellence: (req: AuthRequest, ctx: jg.JgSectionContext) => ins.getExcellence(ctx, { from: (req.query.from as string) || undefined, to: (req.query.to as string) || undefined }),
  eoy: (_req: AuthRequest, ctx: jg.JgSectionContext) => ins.getEndOfYear(ctx),
}
const certKind = (req: AuthRequest): JgCertificateKind => {
  const k = String(req.query.kind ?? 'excellence') as JgCertificateKind
  if (!ins.CERT_KINDS.includes(k)) throw new jg.JgError(400, `kind must be one of ${ins.CERT_KINDS.join(', ')}`)
  return k
}

/** Campus-wide pages: admins and readers (coordinators, inspectors) of the school family. */
const campusReader = (req: AuthRequest) => {
  if (!['admin', 'super_admin', 'staff', 'inspector'].includes(req.profile?.role ?? '')) throw new jg.JgError(403, 'Admins only')
}
const campusHeader = async (req: AuthRequest) => {
  const campus = campusOf(req)!
  const root = await rootOf(req)
  return printHeader(campus, await jg.getSettings(root, campus))
}
const allocationQuery = (req: AuthRequest) => ({
  from: String(req.query.from ?? ''),
  repeat: (req.query.repeat as string) || null,
  names: String(req.query.names ?? '').split(',').map((s) => s.trim()).filter(Boolean),
})

export const jahbadhInsightController = {
  // B6-62 infographics: the period model (+ optional comparison) for the shared renderers
  infographics: handle(async (req) => ins.infographics(await ctxOf(req), req.query.scope, req.query.compare)),
  // B6-45 workflow home
  workflow: handle(async (req) => ins.getWorkflow(await ctxOf(req), actorOf(req))),

  // B6-30 … B6-34
  prediction: handle(async (req) => loaders.prediction(req, await ctxOf(req))),
  predictionPdf: sectionPdf(loaders.prediction, pr.predictionHtml, 'التوقع-المبكر'),
  edge: handle(async (req) => loaders.edge(req, await ctxOf(req))),
  edgePdf: sectionPdf(loaders.edge, pr.edgeHtml, 'الطلاب-على-الحافة'),
  inflation: handle(async (req) => loaders.inflation(req, await ctxOf(req))),
  inflationPdf: sectionPdf(loaders.inflation, pr.inflationHtml, 'مؤشر-تضخم-الأعمال'),
  autoComments: handle(async (req) => loaders.comments(req, await ctxOf(req))),
  autoCommentsPdf: sectionPdf(loaders.comments, pr.autoCommentsHtml, 'الملاحظات-التلقائية', false),
  weakItems: handle(async (req) => loaders.weak(req, await ctxOf(req))),
  weakItemsPdf: sectionPdf(loaders.weak, pr.weakItemsHtml, 'خريطة-البنود'),

  // B6-35 what-if (admins)
  whatIf: handle(async (req) => { adminOnly(req); return ins.runWhatIf(await ctxOf(req), req.body ?? {}) }),
  whatIfPdf: handle(async (req, res) => {
    adminOnly(req)
    const ctx = await ctxOf(req)
    const [d, h] = await Promise.all([ins.runWhatIf(ctx, req.body ?? {}), headerOf(ctx)])
    sendPdf(res, await pr.pdf(pr.whatIfHtml(d, h), true), `محاكي-ماذا-لو-${label(ctx)}.pdf`)
  }),
  scenarios: handle(async (req) => { adminOnly(req); return ins.listScenarios(await ctxOf(req)) }),
  createScenario: handle(async (req) => { adminOnly(req); return ins.saveScenario(await ctxOf(req), null, req.body ?? {}, actorOf(req)) }),
  updateScenario: handle(async (req) => { adminOnly(req); return ins.saveScenario(await ctxOf(req), req.params.scenarioId, req.body ?? {}, actorOf(req)) }),
  deleteScenario: handle(async (req) => { adminOnly(req); return ins.deleteScenario(await ctxOf(req), req.params.scenarioId, actorOf(req)) }),

  // B6-37 auditor, B6-38 approval, B6-39 verification
  audit: handle(async (req) => loaders.audit(req, await ctxOf(req))),
  auditPdf: sectionPdf(loaders.audit, pr.auditHtml, 'مدقق-الإدخال'),
  approval: handle(async (req) => loaders.approval(req, await ctxOf(req))),
  approvalPdf: sectionPdf(loaders.approval, pr.approvalHtml, 'سجل-الاعتماد', false),
  approve: handle(async (req) => { adminOnly(req); return ins.approve(await ctxOf(req), (req.body?.note as string) ?? null, actorOf(req)) }),
  verification: handle(async (req) => loaders.archive(req, await ctxOf(req))),
  verificationPdf: sectionPdf(loaders.archive, pr.verificationArchiveHtml, 'أرشيف-رموز-التحقق', false),
  issueCodes: handle(async (req) => {
    writer(req)
    const ctx = await ctxOf(req)
    const scope = String(req.body?.scope ?? 'final')
    if (scope !== 'final' && !/^stage\d$/.test(scope)) throw new jg.JgError(400, 'scope must be final or stageN')
    return { codes: await ins.issueCodes(ctx, scope, actorOf(req)) }
  }),
  checkCode: handle(async (req) => ins.checkCode(await ctxOf(req), String(req.query.code ?? ''), (req.query.student_number as string) || null)),

  // B6-40 certificates
  certificates: handle(async (req) => loaders.certificates(req, await ctxOf(req))),
  certificatesPdf: sectionPdf(loaders.certificates, (d, h, req) => pr.certificatesHtml(d, certKind(req), h), 'شهادات-التقدير'),

  // B6-41 support plans, B6-42 absence impact
  supportPlans: handle(async (req) => loaders.plans(req, await ctxOf(req))),
  supportPlansPdf: sectionPdf(loaders.plans, pr.supportPlansHtml, 'خطة-الدعم-الفردية', false),
  saveSupportPlan: handle(async (req) => { writer(req); return ins.saveSupportPlan(await ctxOf(req), req.params.studentId, req.body ?? {}, actorOf(req)) }),
  absenceImpact: handle(async (req) => loaders.absence(req, await ctxOf(req))),
  absenceImpactPdf: sectionPdf(loaders.absence, pr.absenceImpactHtml, 'أثر-الغياب', false),

  // B6-46 entry progress
  entryProgress: handle(async (req) => loaders.progress(req, await ctxOf(req))),
  entryProgressPdf: sectionPdf(loaders.progress, pr.entryProgressHtml, 'متابعة-الرصد'),
  sendReminders: handle(async (req) => { adminOnly(req); return ins.sendReminders(await ctxOf(req), req.body?.all === true, actorOf(req)) }),
  deadlines: handle(async (req) => { const ctx = await ctxOf(req); return ins.getDeadlines(ctx.rootId, ctx.yearId) }),
  saveDeadlines: handle(async (req) => { adminOnly(req); return ins.saveDeadlines(await ctxOf(req), req.body ?? {}, actorOf(req)) }),

  // B6-48 excellence points
  excellence: handle(async (req) => loaders.excellence(req, await ctxOf(req))),
  excellencePdf: sectionPdf(loaders.excellence, pr.excellenceHtml, 'نقاط-التميز'),
  addPoints: handle(async (req) => { writer(req); return ins.addPoints(await ctxOf(req), req.body ?? {}, actorOf(req)) }),
  deletePoints: handle(async (req) => { writer(req); return ins.deletePoints(await ctxOf(req), req.params.entryId, actorOf(req)) }),

  // B6-49 end-of-year report
  endOfYear: handle(async (req) => loaders.eoy(req, await ctxOf(req))),
  endOfYearPdf: sectionPdf(loaders.eoy, pr.endOfYearHtml, 'التقرير-الختامي', false),
  saveEndOfYear: handle(async (req) => { adminOnly(req); return ins.saveEndOfYear(await ctxOf(req), req.body?.manual ?? req.body ?? {}, actorOf(req)) }),

  // school-wide settings
  insightSettings: handle(async (req) => ins.getInsightSettings(await rootOf(req))),
  saveInsightSettings: handle(async (req) => { adminOnly(req); return ins.saveInsightSettings(await rootOf(req), req.body ?? {}, actorOf(req)) }),
  phraseBank: handle(async (req) => ins.getPhrases(await rootOf(req))),
  savePhraseBank: handle(async (req) => { adminOnly(req); return ins.savePhrases(await rootOf(req), req.body?.phrases ?? [], actorOf(req)) }),
  excellenceCategories: handle(async (req) => ins.getCategories(await rootOf(req))),
  saveExcellenceCategories: handle(async (req) => { adminOnly(req); return ins.saveCategories(await rootOf(req), req.body?.names ?? [], actorOf(req)) }),

  // campus-wide: B6-50, B6-43, B6-44
  principalDashboard: handle(async (req) => { campusReader(req); return ins.getPrincipalDashboard(campusOf(req)!, req.profile?.school_id, actorOf(req)) }),
  principalDashboardPdf: handle(async (req, res) => {
    campusReader(req)
    const [d, h] = await Promise.all([ins.getPrincipalDashboard(campusOf(req)!, req.profile?.school_id, actorOf(req)), campusHeader(req)])
    sendPdf(res, await pr.pdf(pr.principalHtml(d, h), true), 'لوحة-المدير.pdf')
  }),
  allocation: handle(async (req) => { campusReader(req); return ins.getAllocation(campusOf(req)!, req.profile?.school_id, actorOf(req), allocationQuery(req)) }),
  allocationPdf: handle(async (req, res) => {
    campusReader(req)
    const [d, h] = await Promise.all([ins.getAllocation(campusOf(req)!, req.profile?.school_id, actorOf(req), allocationQuery(req)), campusHeader(req)])
    sendPdf(res, await pr.pdf(pr.allocationHtml(d, h), true), 'توزيع-الشعب.pdf')
  }),
  fairness: handle(async (req) => { campusReader(req); return ins.getFairness(campusOf(req)!, req.profile?.school_id, actorOf(req), String(req.query.grade_level_id ?? ''), num(req.query.threshold)) }),
  fairnessPdf: handle(async (req, res) => {
    campusReader(req)
    const [d, h] = await Promise.all([ins.getFairness(campusOf(req)!, req.profile?.school_id, actorOf(req), String(req.query.grade_level_id ?? ''), num(req.query.threshold)), campusHeader(req)])
    sendPdf(res, await pr.pdf(pr.fairnessHtml(d, h), true), 'عدالة-التصحيح.pdf')
  }),

  // B6-39 public verification page (no sign-in)
  publicVerify: async (req: Request, res: Response) => {
    try {
      res.json({ success: true, data: await ins.publicVerify(String(req.params.code ?? '')) })
    } catch (err: any) {
      console.error('[jahbadh-verify]', err)
      res.status(500).json({ success: false, error: 'Unexpected error' })
    }
  },
}
