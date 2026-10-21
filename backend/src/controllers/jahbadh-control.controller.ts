import { Response } from 'express'

import { AuthRequest } from '../middlewares/auth.middleware'
import { supabase } from '../config/supabase'
import { JgError } from '../services/jahbadh/grades.service'
import * as core from '../services/jahbadh/control/core'
import * as plan from '../services/jahbadh/control/planning'
import * as day from '../services/jahbadh/control/examday'
import * as sc from '../services/jahbadh/control/scores'
import { renderDoc, type JcDoc } from '../services/jahbadh/control/print'
import { parseQrPayload, type JcQrKind } from '../services/jahbadh/control/qr'

const handle = (fn: (req: AuthRequest, res: Response) => Promise<unknown>) => async (req: AuthRequest, res: Response) => {
  try {
    const data = await fn(req, res)
    if (!res.headersSent) res.json({ success: true, data })
  } catch (err: any) {
    if (err instanceof JgError) return res.status(err.status).json({ success: false, error: err.message, code: err.code, details: err.details })
    // A Jahbadh table that does not exist yet: a migration has not been run on this database.
    const missing = err?.code === 'PGRST205' || err?.code === '42P01' ? String(err?.message ?? '').match(/(jg|jc)_[a-z0-9_]+/)?.[0] : null
    if (missing) {
      return res.status(503).json({ success: false, error: `Database update missing: table ${missing} does not exist. Run the Jahbadh migrations (backend/migrations/jahbadh_*.sql).`, code: 'not_migrated' })
    }
    console.error('[jahbadh-control]', err)
    return res.status(500).json({ success: false, error: err?.message || 'Unexpected error' })
  }
}

const actorOf = (req: AuthRequest): core.JcActor => ({ profileId: req.profile?.id, role: req.profile?.role, schoolId: req.profile?.school_id })
const ctxOf = (req: AuthRequest) => core.sessionContext(req.params.sessionId, actorOf(req))
/** Names and seats: control staff and the chief only (never grade-entry users). */
const managed = async (req: AuthRequest) => {
  const ctx = await ctxOf(req)
  core.need(ctx.can.manage)
  return ctx
}

export const jahbadhControlController = {
  listSessions: handle(async (req) => core.listSessions(actorOf(req), (req.query.campus_id as string) || null)),
  createSession: handle(async (req) => core.createSession(actorOf(req), req.body ?? {})),
  overview: handle(async (req) => core.getOverview(await ctxOf(req))),
  updateSession: handle(async (req) => core.updateSession(await ctxOf(req), req.body ?? {})),
  deleteSession: handle(async (req) => core.deleteSession(await ctxOf(req))),
  setKey: handle(async (req) => core.setKey(await ctxOf(req), Number(req.body?.key), Number(req.body?.offset))),
  members: handle(async (req) => core.listMembers(await managed(req))),
  setMembers: handle(async (req) => core.setMembers(await ctxOf(req), req.body?.members ?? [])),
  gradeChoices: handle(async (req) => {
    const ctx = await managed(req)
    const campus = ctx.session.campus_id ?? ctx.rootId
    const { data: levels } = await supabase.from('grade_levels').select('id, name, order_index').eq('school_id', campus).eq('is_active', true).order('order_index')
    const { data: map } = await supabase.from('jg_grade_level_map').select('grade_level_id, grade_code').eq('school_id', campus)
    const code = new Map((map ?? []).map((m: any) => [m.grade_level_id, m.grade_code]))
    return (levels ?? []).map((l: any) => ({ grade_level_id: l.id, name: l.name, grade_code: code.get(l.id) ?? null }))
  }),
  grades: handle(async (req) => core.getGrades(await ctxOf(req))),
  setGrades: handle(async (req) => core.setGrades(await ctxOf(req), req.body?.grade_level_ids ?? [], req.body?.overrides ?? [])),
  students: handle(async (req) => core.loadStudents(await managed(req))),
  pullStudents: handle(async (req) => core.pullStudents(await ctxOf(req))),
  updateStudents: handle(async (req) => core.updateStudents(await ctxOf(req), req.body?.students ?? [])),
  generateNumbers: handle(async (req) => core.generateNumbers(await ctxOf(req))),
  committees: handle(async (req) => core.listCommittees(await managed(req))),
  saveCommittees: handle(async (req) => core.saveCommittees(await ctxOf(req), req.body?.committees ?? [])),
  committeeStatus: handle(async (req) => plan.committeeStatus(await managed(req))),
  distribute: handle(async (req) => core.distribute(await ctxOf(req))),
  lock: handle(async (req) => core.lockCommittees(await ctxOf(req), true)),
  unlock: handle(async (req) => core.lockCommittees(await ctxOf(req), false)),
  alerts: handle(async (req) => {
    const ctx = await managed(req)
    return plan.alerts(ctx, await sc.scoreAlerts(ctx))
  }),
  days: handle(async (req) => plan.listDays(await ctxOf(req))),
  saveDays: handle(async (req) => plan.saveDays(await ctxOf(req), req.body?.days ?? [])),
  invigilators: handle(async (req) => plan.listInvigilators(await managed(req))),
  saveInvigilators: handle(async (req) => plan.saveInvigilators(await ctxOf(req), req.body?.invigilators ?? [])),
  staff: handle(async (req) => plan.staffChoices(await managed(req))),
  invigilation: handle(async (req) => plan.listInvigilation(await ctxOf(req))),
  generateInvigilation: handle(async (req) => plan.generateInvigilation(await ctxOf(req))),
  setDuty: handle(async (req) => plan.setDuty(await ctxOf(req), req.body ?? {})),
  print: handle(async (req, res) => {
    const { pdf, name } = await renderDoc(await ctxOf(req), req.params.doc as JcDoc, {
      committee_id: (req.query.committee_id as string) || null,
      day_id: (req.query.day_id as string) || null,
    })
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `inline; filename="${name}"`)
    res.send(pdf)
  }),
  dayDashboard: handle(async (req) => day.dashboard(await ctxOf(req), req.params.dayId)),
  attendance: handle(async (req) => day.attendance(await ctxOf(req), req.params.dayId, (req.query.committee_id as string) || null)),
  saveAttendance: handle(async (req) => day.saveAttendance(await ctxOf(req), req.params.dayId, req.body?.entries ?? [])),
  bySeat: handle(async (req) => day.bySeat(await ctxOf(req), Number(req.params.seat))),
  violations: handle(async (req) => day.listViolations(await ctxOf(req), (req.query.day_id as string) || null)),
  addViolation: handle(async (req) => day.addViolation(await ctxOf(req), req.body ?? {})),
  deleteViolation: handle(async (req) => day.deleteViolation(await ctxOf(req), req.params.violationId)),
  envelopes: handle(async (req) => day.envelopes(await ctxOf(req), req.params.dayId)),
  saveEnvelope: handle(async (req) => day.saveEnvelope(await ctxOf(req), req.params.dayId, req.body ?? {})),
  entryGrid: handle(async (req) => sc.entryGrid(await ctxOf(req), String(req.query.grade_level_id ?? ''), Number(req.query.entry) === 2 ? 2 : 1)),
  saveEntry: handle(async (req) => sc.saveEntry(await ctxOf(req), Number(req.body?.entry) === 2 ? 2 : 1, req.body?.cells ?? [])),
  mismatches: handle(async (req) => sc.mismatches(await ctxOf(req))),
  gate: handle(async (req) => sc.gate(await ctxOf(req))),
  approveUnmask: handle(async (req) => sc.approveUnmask(await ctxOf(req))),
  unmask: handle(async (req) => sc.unmask(await ctxOf(req))),
  revokeUnmask: handle(async (req) => sc.revokeUnmask(await ctxOf(req))),
  appeals: handle(async (req) => sc.listAppeals(await ctxOf(req))),
  addAppeal: handle(async (req) => sc.addAppeal(await ctxOf(req), req.body ?? {})),
  auditSample: handle(async (req) => sc.getAuditSample(await ctxOf(req))),
  drawAuditSample: handle(async (req) => sc.drawAuditSample(await ctxOf(req))),
  reviewAuditSample: handle(async (req) => sc.reviewAuditSample(await ctxOf(req), req.body ?? {})),
  graders: handle(async (req) => sc.listGraders(await managed(req))),
  saveGraders: handle(async (req) => sc.saveGraders(await ctxOf(req), req.body?.graders ?? [])),
  quality: handle(async (req) => sc.quality(await ctxOf(req), (req.query.grade_level_id as string) || null)),
  results: handle(async (req) => sc.results(await ctxOf(req))),
  secondRound: handle(async (req) => sc.createSecondRound(await ctxOf(req))),
  messages: handle(async (req) => sc.messages(await ctxOf(req), { note: (req.query.note as string) || undefined })),
  sendMessages: handle(async (req) => sc.messages(await ctxOf(req), { note: req.body?.note, send: true })),
  exportPreview: handle(async (req) => sc.exportToGrades(await ctxOf(req), false)),
  exportCommit: handle(async (req) => sc.exportToGrades(await ctxOf(req), true)),
  /**
   * Resolves a scanned QR (C7.4). Booklets resolve to the secret only (entry / exam day); cards to the
   * student (exam day; with day_id, the student must sit that exam); stubs to both (secret right).
   */
  scan: handle(async (req) => {
    const ctx = await ctxOf(req)
    const parsed = parseQrPayload(String(req.body?.payload ?? ''), ctx.session.session_code, (req.body?.expect as JcQrKind) || undefined)
    if (!parsed.ok) {
      const reason = (parsed as { reason: string }).reason
      throw new JgError(400, `Invalid code (${reason})`, `scan_${reason}`)
    }
    if (parsed.kind === 'booklet') {
      core.need(ctx.can.entry || ctx.can.examday)
      const secrets = await core.loadSecrets(ctx)
      if (![...secrets.values()].some((x) => x.secret === parsed.secret)) throw new JgError(404, 'Unknown secret number', 'unknown_secret')
      return { kind: parsed.kind, secret: parsed.secret }
    }
    if (parsed.kind === 'stub') {
      core.need(ctx.can.secret)
      return { kind: parsed.kind, secret: parsed.secret, student: await day.studentBySeat(ctx, parsed.seat!) }
    }
    const student = await day.bySeat(ctx, parsed.seat!)
    const dayId = (req.body?.day_id as string) || null
    if (dayId) {
      const d = (await plan.listDays(ctx)).find((x) => x.id === dayId)
      const s = (await core.loadStudents(ctx)).find((x) => x.id === student.id)
      if (d && s && !d.grade_codes.includes(s.grade_code)) throw new JgError(409, 'This student does not sit this exam', 'scan_not_today')
    }
    return { kind: parsed.kind, student }
  }),
  envelopeCheck: handle(async (req) =>
    day.envelopeCheck(await ctxOf(req), req.params.dayId, String(req.body?.committee_id ?? ''), Array.isArray(req.body?.payloads) ? req.body.payloads : []),
  ),
  regenerateCode: handle(async (req) => core.regenerateSessionCode(await ctxOf(req))),
  timerFeed: handle(async (req) => day.timerFeed(await ctxOf(req), (req.query.date as string) || null, (req.query.committee_id as string) || null)),
  timerMinutes: handle(async (req) => day.listTimerMinutes(await ctxOf(req), req.params.dayId)),
  saveTimerMinutes: handle(async (req) => day.saveTimerMinutes(await ctxOf(req), req.params.dayId, req.body ?? {})),
  auditLog: handle(async (req) => {
    const ctx = await ctxOf(req)
    core.need(ctx.chief)
    const { data, error } = await supabase.from('jc_audit_log').select('*').eq('session_id', ctx.session.id).order('created_at', { ascending: false }).limit(500)
    if (error) throw error
    const ids = [...new Set((data ?? []).map((r: any) => r.actor_id).filter(Boolean))]
    const { data: people } = ids.length ? await supabase.from('profiles').select('id, first_name, last_name').in('id', ids) : { data: [] }
    const names = new Map((people ?? []).map((p: any) => [p.id, [p.first_name, p.last_name].filter(Boolean).join(' ')]))
    return (data ?? []).map((r: any) => ({ ...r, actor_name: names.get(r.actor_id) ?? '' }))
  }),
}
