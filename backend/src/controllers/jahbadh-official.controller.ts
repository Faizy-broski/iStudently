import { Response } from 'express'

import { AuthRequest } from '../middlewares/auth.middleware'
import * as jg from '../services/jahbadh/grades.service'
import * as off from '../services/jahbadh/official.service'
import { printHeader, renderReportCardPdf, renderReportCardsPdf } from '../services/jahbadh/print.service'
import { signCode } from '../services/jahbadh/print-layout'
import * as pr from '../services/jahbadh/print-official.service'
import { renderMonthlyCardsPdf, renderMonthlyCurvePdf } from '../services/jahbadh/print-monthly.service'
import * as rc from '../services/jahbadh/report-cards.service'
import { buildZip, safeFileName } from '../utils/zip.util'

/**
 * Wave 2 official outputs (brief B6-17 … B6-28, B6-47): JSON for the screens and A4 PDFs, same
 * section access as the rest of the plugin (teachers: the sections they teach or are homeroom of).
 */

type Handler = (req: AuthRequest, res: Response) => Promise<unknown>

const handle = (fn: Handler) => async (req: AuthRequest, res: Response) => {
  try {
    const data = await fn(req, res)
    if (!res.headersSent) res.json({ success: true, data })
  } catch (err: any) {
    if (err instanceof jg.JgError) return res.status(err.status).json({ success: false, error: err.message, code: err.code, details: err.details })
    if (jg.isNotMigrated(err)) {
      return res.status(503).json({ success: false, error: 'Database update missing: run backend/migrations/jahbadh_wave2.sql', code: 'not_migrated' })
    }
    console.error('[jahbadh-official]', err)
    return res.status(500).json({ success: false, error: err?.message || 'Unexpected error' })
  }
}

const actorOf = (req: AuthRequest): jg.JgActor => ({ profileId: req.profile?.id, role: req.profile?.role, staffId: req.profile?.staff_id ?? null })
const ctxOf = (req: AuthRequest) =>
  jg.sectionContext(req.params.sectionId, req.profile?.school_id, actorOf(req), (req.query.academic_year_id as string) || null)
const headerOf = (ctx: jg.JgSectionContext) => printHeader(ctx.section.school_id, ctx.settings, { sectionId: ctx.section.id, yearId: ctx.yearId })
const label = (ctx: jg.JgSectionContext) => `${ctx.gradeLevelName}-${ctx.section.name}`
const num = (v: unknown) => (v === undefined || v === '' ? undefined : Number(v))
const rangeOf = (req: AuthRequest) => ({
  from: Number(req.query.from) || undefined,
  to: Number(req.query.to) || undefined,
  studentIds: typeof req.query.student_id === 'string' && req.query.student_id ? [req.query.student_id] : undefined,
})

function sendFile(res: Response, buf: Buffer, filename: string, type = 'application/pdf') {
  res.setHeader('Content-Type', type)
  res.setHeader('Content-Disposition', `${type === 'application/pdf' ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(filename)}`)
  res.send(buf)
}

function requireStage(req: AuthRequest, ctx: jg.JgSectionContext): number {
  const stage = Number(req.query.stage)
  if (!rc.gradeStages(ctx).includes(stage)) throw new jg.JgError(400, 'stage must be a stage of this grade')
  return stage
}

const adminOnly = (req: AuthRequest) => {
  if (!['admin', 'super_admin'].includes(req.profile?.role ?? '')) throw new jg.JgError(403, 'Admins only')
}

/** Teachers print sheets only for their own subjects (homeroom teachers: every subject, as on screen). */
function sheetSubject(req: AuthRequest, ctx: jg.JgSectionContext): string {
  const subject = (req.query.subject as string) || 'all'
  if (req.profile?.role === 'teacher' && !ctx.homeroom && subject !== 'all' && !ctx.enterable.has(subject)) {
    throw new jg.JgError(403, 'You can only print sheets for your own subjects')
  }
  return subject
}
async function markingSheets(req: AuthRequest, ctx: jg.JgSectionContext) {
  const data = await off.getMarkingSheets(ctx, sheetSubject(req, ctx), requireStage(req, ctx), signCode)
  if (req.profile?.role === 'teacher' && !ctx.homeroom) data.sheets = data.sheets.filter((s) => ctx.enterable.has(s.subject_id))
  return data
}

export const jahbadhOfficialController = {
  // B6-17 statistics
  statistics: handle(async (req) => off.getStatistics(await ctxOf(req))),
  statisticsPdf: handle(async (req, res) => {
    const ctx = await ctxOf(req)
    const [d, h] = await Promise.all([off.getStatistics(ctx), headerOf(ctx)])
    sendFile(res, await pr.renderStatisticsPdf(d, h, ctx.settings), `statistics-${label(ctx)}.pdf`)
  }),

  // B6-22 top students
  topStudents: handle(async (req) => off.getTopStudents(await ctxOf(req), Number(req.query.n) || 10)),
  topStudentsPdf: handle(async (req, res) => {
    const ctx = await ctxOf(req)
    const [d, h] = await Promise.all([off.getTopStudents(ctx, Number(req.query.n) || 10), headerOf(ctx)])
    sendFile(res, await pr.renderTopStudentsPdf(d, h), `top-students-${label(ctx)}.pdf`)
  }),

  // B6-28 final result sheet
  finalSheet: handle(async (req) => off.getFinalSheet(await ctxOf(req))),
  finalSheetPdf: handle(async (req, res) => {
    const ctx = await ctxOf(req)
    const [d, h] = await Promise.all([off.getFinalSheet(ctx), headerOf(ctx)])
    sendFile(res, await pr.renderFinalSheetPdf(d, h, ctx.settings), `final-result-${label(ctx)}.pdf`)
  }),

  // B6-19 review sheet
  reviewSheet: handle(async (req) => off.getReviewSheet(await ctxOf(req))),
  reviewSheetPdf: handle(async (req, res) => {
    const ctx = await ctxOf(req)
    const [d, h] = await Promise.all([off.getReviewSheet(ctx), headerOf(ctx)])
    sendFile(res, await pr.renderReviewSheetPdf(d, h, ctx.settings), `review-${label(ctx)}.pdf`)
  }),

  // B6-20 second-round entry sheet
  round2Sheet: handle(async (req) => off.getRound2EntrySheet(await ctxOf(req))),
  round2SheetPdf: handle(async (req, res) => {
    const ctx = await ctxOf(req)
    const [d, h] = await Promise.all([off.getRound2EntrySheet(ctx), headerOf(ctx)])
    sendFile(res, await pr.renderRound2EntrySheetPdf(d, h, ctx.settings), `second-round-entry-${label(ctx)}.pdf`)
  }),

  // B6-18 second-round timetable and notices
  round2Timetable: handle(async (req) => off.getRound2Timetable(await ctxOf(req))),
  saveRound2Timetable: handle(async (req) => {
    adminOnly(req)
    return off.saveRound2Timetable(await ctxOf(req), req.body?.entries ?? [], actorOf(req))
  }),
  round2Notices: handle(async (req) => off.getRound2Notices(await ctxOf(req))),
  round2NoticesPdf: handle(async (req, res) => {
    const ctx = await ctxOf(req)
    const [d, h] = await Promise.all([off.getRound2Notices(ctx), headerOf(ctx)])
    sendFile(res, await pr.renderRound2NoticesPdf(d, h), `second-round-notices-${label(ctx)}.pdf`)
  }),
  sendRound2Notices: handle(async (req) => {
    adminOnly(req)
    const ctx = await ctxOf(req)
    const d = await off.getRound2Notices(ctx)
    return off.sendNotices(
      ctx,
      d.notices.map((n) => ({
        student_id: n.student.id,
        title: 'إشعار بدخول امتحان الدور الثاني',
        body: `${n.student.name}: ${n.subjects.map((s) => `${s.name}${s.exam_date ? ` (${[s.day, s.exam_date].filter(Boolean).join(' ')})` : ''}`).join('، ')}`,
      })),
      'round2_notice',
      actorOf(req),
    )
  }),

  // B6-27 guardian follow-up notices
  guardianNotices: handle(async (req) => {
    const ctx = await ctxOf(req)
    return off.getGuardianNotices(ctx, requireStage(req, ctx))
  }),
  guardianNoticesPdf: handle(async (req, res) => {
    const ctx = await ctxOf(req)
    const [d, h] = await Promise.all([off.getGuardianNotices(ctx, requireStage(req, ctx)), headerOf(ctx)])
    sendFile(res, await pr.renderGuardianNoticesPdf(d, h), `guardian-notices-${label(ctx)}.pdf`)
  }),
  sendGuardianNotices: handle(async (req) => {
    adminOnly(req)
    const ctx = await ctxOf(req)
    const stage = Number(req.body?.stage ?? req.query.stage)
    if (!rc.gradeStages(ctx).includes(stage)) throw new jg.JgError(400, 'stage must be a stage of this grade')
    const d = await off.getGuardianNotices(ctx, stage)
    return off.sendNotices(ctx, d.notices.map((n) => ({ student_id: n.student.id, title: `إشعار متابعة — ${d.stage_name}`, body: n.message })), 'guardian_notice', actorOf(req))
  }),

  // B6-21 monthly report card and monthly curve
  monthlyCards: handle(async (req) => off.getMonthlyCards(await ctxOf(req), { stage: num(req.query.stage), month: num(req.query.month) }, rangeOf(req))),
  monthlyCardsPdf: handle(async (req, res) => {
    const ctx = await ctxOf(req)
    const [d, h] = await Promise.all([off.getMonthlyCards(ctx, { stage: num(req.query.stage), month: num(req.query.month) }, rangeOf(req)), headerOf(ctx)])
    sendFile(res, await renderMonthlyCardsPdf(d, h), `monthly-cards-${label(ctx)}-${d.month_name}.pdf`)
  }),
  monthlyCurve: handle(async (req) => off.getMonthlyCurve(await ctxOf(req), (req.query.student_id as string) || null)),
  monthlyCurvePdf: handle(async (req, res) => {
    const ctx = await ctxOf(req)
    const [d, h] = await Promise.all([off.getMonthlyCurve(ctx, (req.query.student_id as string) || null), headerOf(ctx)])
    sendFile(res, await renderMonthlyCurvePdf(d, h), `monthly-curve-${label(ctx)}.pdf`)
  }),

  // B6-23 teacher's blank marking sheet
  markingSheets: handle(async (req) => markingSheets(req, await ctxOf(req))),
  markingSheetsPdf: handle(async (req, res) => {
    const ctx = await ctxOf(req)
    const [d, h] = await Promise.all([markingSheets(req, ctx), headerOf(ctx)])
    if (!d.sheets.length) throw new jg.JgError(404, 'No sheet to print')
    sendFile(res, await pr.renderMarkingSheetsPdf(d, h, ctx.settings), `marking-sheets-${label(ctx)}-stage${d.sheets[0].stage}.pdf`)
  }),

  // B6-47 one PDF per student ("NN - name.pdf") plus the merged PDF, in one ZIP
  reportCardsBundle: handle(async (req, res) => {
    const ctx = await ctxOf(req)
    const scope = rc.parseScope(ctx, req.query.scope)
    const { cards, options } = await rc.buildReportCards(ctx, scope, rangeOf(req))
    if (!cards.length) throw new jg.JgError(404, 'No report cards in this range')
    const files = []
    for (const card of cards) {
      files.push({ name: `PDF/${String(card.student.listNumber).padStart(2, '0')} - ${safeFileName(card.student.name)}.pdf`, data: await renderReportCardPdf(card, options) })
    }
    files.push({ name: `${safeFileName(`الصحائف - ${ctx.gradeLevelName} ${ctx.section.name}`)}.pdf`, data: await renderReportCardsPdf(cards, options) })
    sendFile(res, buildZip(files), `report-cards-${label(ctx)}-${scope}.zip`, 'application/zip')
  }),
}
