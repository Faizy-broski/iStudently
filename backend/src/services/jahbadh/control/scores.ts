import { supabase } from '../../../config/supabase'
import { pushNotificationsService } from '../../push-notifications.service'
import {
  auditSample,
  compareEntries,
  honorBoard,
  JC_LEVEL_BANDS,
  markerBias,
  secondRoundCandidates,
  thresholdClustering,
  unmaskGate,
  type JcScoreCell,
} from '../../../lib/jahbadh'
import { logJgAudit } from '../audit.service'
import { JgError } from '../grades.service'
import { cleanSettings, getGrades, listCommittees, loadSecrets, loadStudents, logJc, need, sessionContext, uniqueSessionCode, type JcContext, type JcGradeRow, type JcStudentRow } from './core'
import type { JcAlert } from './planning'

const EPS = 1e-9
const num = (v: unknown) => (v === null || v === undefined ? null : Number(v))

interface ScoreRow {
  session_student_id: string
  subject_key: string
  entry: 1 | 2
  score: number | null
  is_absent: boolean
  entered_by: string | null
}

async function loadScores(ctx: JcContext): Promise<ScoreRow[]> {
  const out: ScoreRow[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('jc_scores')
      .select('session_student_id, subject_key, entry, score, is_absent, entered_by')
      .eq('session_id', ctx.session.id)
      .range(from, from + 999)
    if (error) throw error
    out.push(...(data ?? []).map((r: any) => ({ ...r, score: num(r.score) })))
    if (!data || data.length < 1000) break
  }
  return out
}

async function loadAppeals(ctx: JcContext) {
  const { data, error } = await supabase.from('jc_appeals').select('*').eq('session_id', ctx.session.id).order('created_at')
  if (error) throw error
  return (data ?? []).map((a: any) => ({ ...a, before_score: num(a.before_score), after_score: Number(a.after_score) }))
}

const toCell = (r: ScoreRow): JcScoreCell => ({ ssId: r.session_student_id, subjectKey: r.subject_key, score: r.score, absent: r.is_absent })

/** Everything the integrity checks need: entries, comparison, official scores, expected cells. */
async function scoreState(ctx: JcContext) {
  const [grades, students, rows, appeals, secrets] = await Promise.all([getGrades(ctx), loadStudents(ctx), loadScores(ctx), loadAppeals(ctx), loadSecrets(ctx)])
  const part = students.filter((s) => s.status === 'participating' && secrets.has(s.id))
  const gradeOf = new Map(grades.map((g) => [g.grade_level_id, g]))
  const first = rows.filter((r) => r.entry === 1).map(toCell)
  const second = rows.filter((r) => r.entry === 2).map(toCell)
  const cmp = compareEntries(first, second)
  const official = new Map<string, { score: number | null; absent: boolean }>()
  const k = (ss: string, subj: string) => `${ss}|${subj}`
  const secondBy = new Map(second.map((c) => [k(c.ssId, c.subjectKey), c]))
  for (const c of first) {
    if (!ctx.session.settings.double_entry) official.set(k(c.ssId, c.subjectKey), { score: c.score, absent: c.absent })
    else {
      const y = secondBy.get(k(c.ssId, c.subjectKey))
      if (y && y.absent === c.absent && (c.absent || Math.abs((c.score ?? 0) - (y.score ?? 0)) < EPS)) official.set(k(c.ssId, c.subjectKey), { score: c.score, absent: c.absent })
    }
  }
  for (const a of appeals) official.set(k(a.session_student_id, a.subject_key), { score: a.after_score, absent: false })
  const expectedCells = part.flatMap((s) => (gradeOf.get(s.grade_level_id)?.subjects ?? []).map((sub) => k(s.id, sub.key)))
  return { grades, gradeOf, students: part, rows, cmp, official, appeals, secrets, expectedCells, k }
}

// ---- blind entry (C6.7) ----------------------------------------------------------------------------

/**
 * Entry grid of one grade by secret number. Before unmasking, rows carry only the secret number, the
 * grade and the committee — no names, no seat numbers, no student ids (enforced here, not in the UI).
 */
export async function entryGrid(ctx: JcContext, gradeLevelId: string, entry: 1 | 2) {
  need(ctx.can.entry)
  if (entry === 2 && !ctx.session.settings.double_entry) throw new JgError(400, 'Double entry is off for this session')
  const st = await scoreState(ctx)
  const grade = st.gradeOf.get(gradeLevelId)
  if (!grade) throw new JgError(404, 'This grade is not in the session')
  const committees = new Map((await listCommittees(ctx)).map((c) => [c.id, c.name]))
  const mine = st.rows.filter((r) => r.entry === entry)
  const other = st.rows.filter((r) => r.entry !== entry)
  const reveal = ctx.unmasked
  const rows = st.students
    .filter((s) => s.grade_level_id === gradeLevelId)
    .map((s) => ({ s, secret: st.secrets.get(s.id)!.secret }))
    .sort((a, b) => a.secret - b.secret)
    .map(({ s, secret }) => ({
      secret,
      committee: s.committee_id ? committees.get(s.committee_id) ?? null : null,
      ...(reveal ? { name: s.name, seat_number: s.seat_number } : {}),
      cells: Object.fromEntries(
        grade.subjects.map((sub) => {
          const m = mine.find((r) => r.session_student_id === s.id && r.subject_key === sub.key)
          const o = other.find((r) => r.session_student_id === s.id && r.subject_key === sub.key)
          const mismatch = !!m && !!o && (m.is_absent !== o.is_absent || (!m.is_absent && Math.abs((m.score ?? 0) - (o.score ?? 0)) > EPS))
          return [sub.key, { score: m?.score ?? null, absent: !!m?.is_absent, entered: !!m, mismatch, single: ctx.session.settings.double_entry && (!!m !== !!o) }]
        }),
      ),
    }))
  return { grade: { grade_level_id: grade.grade_level_id, name: grade.grade_level_name, subjects: grade.subjects }, entry, unmasked: reveal, rows }
}

/** Saves scores by secret number; refuses the same user doing both entries of a subject. */
export async function saveEntry(ctx: JcContext, entry: 1 | 2, cells: { secret: number; subject_key: string; score: number | null; absent?: boolean }[]) {
  need(ctx.can.entry)
  if (![1, 2].includes(entry)) throw new JgError(400, 'Entry must be 1 or 2')
  if (entry === 2 && !ctx.session.settings.double_entry) throw new JgError(400, 'Double entry is off for this session')
  if (ctx.unmasked || ['unmasked', 'published', 'archived'].includes(ctx.session.status)) {
    throw new JgError(409, 'The session is unmasked; changes go through the appeals log', 'unmasked')
  }
  const st = await scoreState(ctx)
  const bySecret = new Map([...st.secrets.entries()].map(([ss, x]) => [x.secret, ss]))
  const studentBy = new Map(st.students.map((s) => [s.id, s]))
  const subjects = [...new Set(cells.map((c) => c.subject_key))]
  const otherEntry = entry === 1 ? 2 : 1
  for (const subj of subjects) {
    const conflict = st.rows.some((r) => r.entry === otherEntry && r.subject_key === subj && r.entered_by === ctx.actor.profileId)
    if (conflict) throw new JgError(403, 'The same person cannot do both entries of a subject', 'same_user_both_entries')
  }
  const rows: any[] = []
  const deletes: { ss: string; subj: string }[] = []
  for (const c of cells) {
    const ss = bySecret.get(Number(c.secret))
    if (!ss) throw new JgError(400, `Unknown secret number ${c.secret}`, 'unknown_secret')
    const s = studentBy.get(ss)!
    const sub = st.gradeOf.get(s.grade_level_id)?.subjects.find((x) => x.key === c.subject_key)
    if (!sub) throw new JgError(400, `This grade does not take ${c.subject_key}`, 'subject_not_taken')
    if (!c.absent && (c.score === null || c.score === undefined)) {
      deletes.push({ ss, subj: c.subject_key })
      continue
    }
    const score = c.absent ? null : Number(c.score)
    if (score !== null && (!Number.isFinite(score) || score < 0 || score > sub.max)) throw new JgError(400, `The score must be between 0 and ${sub.max}`, 'invalid_score', { secret: c.secret, max: sub.max })
    rows.push({ session_student_id: ss, session_id: ctx.session.id, subject_key: c.subject_key, entry, score, is_absent: !!c.absent, entered_by: ctx.actor.profileId, entered_at: new Date().toISOString() })
  }
  for (const d of deletes) {
    const { error } = await supabase.from('jc_scores').delete().eq('session_student_id', d.ss).eq('subject_key', d.subj).eq('entry', entry)
    if (error) throw error
  }
  if (rows.length) {
    const { error } = await supabase.from('jc_scores').upsert(rows, { onConflict: 'session_student_id,subject_key,entry' })
    if (error) throw error
  }
  if (ctx.session.status !== 'grading') await supabase.from('jc_sessions').update({ status: 'grading' }).eq('id', ctx.session.id)
  await logJc(ctx, `scores.entry${entry}`, 'jc_scores', null, null, { count: rows.length, cleared: deletes.length, subjects })
  return { saved: rows.length, cleared: deletes.length }
}

/** Mismatches and cells entered once, by secret number (blind). */
export async function mismatches(ctx: JcContext) {
  need(ctx.can.entry)
  const st = await scoreState(ctx)
  const secretOf = (ss: string) => st.secrets.get(ss)?.secret ?? null
  return {
    double_entry: ctx.session.settings.double_entry,
    mismatches: st.cmp.mismatches.map((m) => ({ secret: secretOf(m.ssId), subject_key: m.subjectKey, first: m.first, second: m.second })),
    only_first: st.cmp.onlyFirst.map((m) => ({ secret: secretOf(m.ssId), subject_key: m.subjectKey })),
    only_second: st.cmp.onlySecond.map((m) => ({ secret: secretOf(m.ssId), subject_key: m.subjectKey })),
    agreed: st.cmp.agreed,
  }
}

// ---- unmasking gate ---------------------------------------------------------------------------------

export async function gate(ctx: JcContext) {
  const st = await scoreState(ctx)
  const { data: events } = await supabase.from('jc_unmask_events').select('kind, approved_by, created_at').eq('session_id', ctx.session.id).order('created_at')
  const last = (kind: string) => [...(events ?? [])].reverse().find((e: any) => e.kind === kind || e.kind === 'revoke')
  const approved = last('approve')?.kind === 'approve' || last('approve')?.kind === 'unmask'
  const entered = st.expectedCells.filter((c) => st.official.has(c)).length
  const input = {
    expected: st.expectedCells.length,
    entered,
    doubleEntry: ctx.session.settings.double_entry,
    mismatches: st.cmp.mismatches.length,
    pendingSecond: st.cmp.onlyFirst.length + st.cmp.onlySecond.length,
    chiefApproved: !!approved,
    showNames: ctx.session.settings.show_names,
  }
  return { ...unmaskGate(input), input, unmasked: ctx.unmasked, events: events ?? [] }
}

export async function approveUnmask(ctx: JcContext) {
  need(ctx.chief, 'Only the control chief can approve unmasking')
  const g = await gate(ctx)
  await supabase.from('jc_unmask_events').insert({ session_id: ctx.session.id, kind: 'approve', approved_by: ctx.actor.profileId, snapshot: g.input })
  await logJc(ctx, 'unmask.approve', 'jc_unmask_events', null, null, g.input)
  return gate(await sessionContext(ctx.session.id, ctx.actor))
}

export async function unmask(ctx: JcContext) {
  need(ctx.chief, 'Only the control chief can unmask')
  const g = await gate(ctx)
  if (!g.open) throw new JgError(409, 'Names are still locked', 'gate_closed', g.missing)
  await supabase.from('jc_unmask_events').insert({ session_id: ctx.session.id, kind: 'unmask', approved_by: ctx.actor.profileId, snapshot: g.input })
  await supabase.from('jc_sessions').update({ status: 'unmasked' }).eq('id', ctx.session.id)
  await logJc(ctx, 'unmask', 'jc_unmask_events', null, null, g.input)
  return gate(await sessionContext(ctx.session.id, ctx.actor))
}

export async function revokeUnmask(ctx: JcContext) {
  need(ctx.chief, 'Only the control chief can lock names again')
  await supabase.from('jc_unmask_events').insert({ session_id: ctx.session.id, kind: 'revoke', approved_by: ctx.actor.profileId, snapshot: {} })
  await supabase.from('jc_sessions').update({ status: 'grading' }).eq('id', ctx.session.id)
  await logJc(ctx, 'unmask.revoke', 'jc_unmask_events', null)
  return gate(await sessionContext(ctx.session.id, ctx.actor))
}

// ---- appeals ----------------------------------------------------------------------------------------

export async function listAppeals(ctx: JcContext) {
  need(ctx.can.manage || ctx.can.entry)
  const st = await scoreState(ctx)
  const studentBy = new Map(st.students.map((s) => [s.id, s]))
  return st.appeals.map((a) => {
    const s = studentBy.get(a.session_student_id)
    const latest = [...st.appeals].reverse().find((x) => x.session_student_id === a.session_student_id && x.subject_key === a.subject_key)
    const off = st.official.get(st.k(a.session_student_id, a.subject_key))
    return {
      id: a.id, secret: st.secrets.get(a.session_student_id)?.secret ?? null,
      ...(ctx.unmasked || ctx.can.secret ? { name: s?.name ?? '', seat_number: s?.seat_number ?? null } : {}),
      subject_key: a.subject_key, before: a.before_score, after: a.after_score, reason: a.reason, approved_by: a.approved_by, created_at: a.created_at,
      applied: latest?.id === a.id && off?.score === a.after_score,
    }
  })
}

export async function addAppeal(ctx: JcContext, body: { secret: number; subject_key: string; after: number; reason: string }) {
  need(ctx.chief, 'Only the control chief can approve a score change')
  const st = await scoreState(ctx)
  const ss = [...st.secrets.entries()].find(([, x]) => x.secret === Number(body.secret))?.[0]
  if (!ss) throw new JgError(400, 'Unknown secret number', 'unknown_secret')
  const s = st.students.find((x) => x.id === ss)!
  const sub = st.gradeOf.get(s.grade_level_id)?.subjects.find((x) => x.key === body.subject_key)
  if (!sub) throw new JgError(400, 'This grade does not take this subject')
  const after = Number(body.after)
  if (!Number.isFinite(after) || after < 0 || after > sub.max) throw new JgError(400, `The score must be between 0 and ${sub.max}`)
  const reason = String(body.reason ?? '').trim()
  if (!reason) throw new JgError(400, 'A reason is required')
  const before = st.official.get(st.k(ss, sub.key))?.score ?? null
  const { error } = await supabase.from('jc_appeals').insert({ session_id: ctx.session.id, session_student_id: ss, subject_key: sub.key, before_score: before, after_score: after, reason: reason.slice(0, 500), approved_by: ctx.actor.profileId })
  if (error) throw error
  await logJc(ctx, 'appeal.add', 'jc_appeals', ss, { score: before }, { score: after, reason })
  return listAppeals(ctx)
}

// ---- audit sample and graders ------------------------------------------------------------------------

export async function getAuditSample(ctx: JcContext) {
  need(ctx.can.manage || ctx.can.entry)
  const [{ data, error }, secrets] = await Promise.all([supabase.from('jc_audit_sample').select('*').eq('session_id', ctx.session.id), loadSecrets(ctx)])
  if (error) throw error
  return (data ?? [])
    .map((r: any) => ({ secret: secrets.get(r.session_student_id)?.secret ?? null, reviewed: r.reviewed, notes: r.notes, reviewer: r.reviewer }))
    .sort((a, b) => (a.secret ?? 0) - (b.secret ?? 0))
}

export async function drawAuditSample(ctx: JcContext) {
  need(ctx.can.manage)
  const st = await scoreState(ctx)
  const ids = auditSample(st.students.map((s) => s.id), ctx.session.settings.audit_percent, `${ctx.session.settings.audit_seed}|${ctx.session.id}`)
  await supabase.from('jc_audit_sample').delete().eq('session_id', ctx.session.id)
  if (ids.length) {
    const { error } = await supabase.from('jc_audit_sample').insert(ids.map((id) => ({ session_id: ctx.session.id, session_student_id: id })))
    if (error) throw error
  }
  await logJc(ctx, 'audit_sample.draw', 'jc_audit_sample', null, null, { count: ids.length, seed: ctx.session.settings.audit_seed })
  return getAuditSample(ctx)
}

export async function reviewAuditSample(ctx: JcContext, body: { secret: number; reviewed: boolean; notes?: string }) {
  need(ctx.can.manage || ctx.can.entry)
  const secrets = await loadSecrets(ctx)
  const ss = [...secrets.entries()].find(([, x]) => x.secret === Number(body.secret))?.[0]
  if (!ss) throw new JgError(400, 'Unknown secret number')
  const { error } = await supabase
    .from('jc_audit_sample')
    .update({ reviewed: !!body.reviewed, notes: body.notes ? String(body.notes).slice(0, 300) : null, reviewer: ctx.actor.profileId })
    .eq('session_id', ctx.session.id)
    .eq('session_student_id', ss)
  if (error) throw error
  await logJc(ctx, 'audit_sample.review', 'jc_audit_sample', ss, null, body)
  return getAuditSample(ctx)
}

export async function listGraders(ctx: JcContext) {
  const { data, error } = await supabase.from('jc_graders').select('*').eq('session_id', ctx.session.id)
  if (error) throw error
  return data ?? []
}

export async function saveGraders(ctx: JcContext, list: { subject_key: string; committee_id: string; staff_id: string | null }[]) {
  need(ctx.can.manage)
  for (const g of list) {
    const del = await supabase.from('jc_graders').delete().eq('session_id', ctx.session.id).eq('subject_key', g.subject_key).eq('committee_id', g.committee_id)
    if (del.error) throw del.error
    if (g.staff_id) {
      const { error } = await supabase.from('jc_graders').insert({ session_id: ctx.session.id, ...g })
      if (error) throw error
    }
  }
  await logJc(ctx, 'graders.save', 'jc_graders', null, null, list)
  return listGraders(ctx)
}

// ---- quality report (C6.7) --------------------------------------------------------------------------

function pctRows(st: Awaited<ReturnType<typeof scoreState>>) {
  return st.students.map((s) => {
    const g = st.gradeOf.get(s.grade_level_id)!
    const pcts: Record<string, number | null> = {}
    let got = 0
    let max = 0
    for (const sub of g.subjects) {
      const o = st.official.get(st.k(s.id, sub.key))
      pcts[sub.key] = !o || o.absent || o.score === null ? null : o.score / sub.max
      if (o && !o.absent && o.score !== null) {
        got += o.score
        max += sub.max
      }
    }
    return { s, g, pcts, pct: max ? got / max : null }
  })
}

export async function quality(ctx: JcContext, gradeLevelId?: string | null) {
  need(ctx.can.manage || ctx.can.entry)
  const s = ctx.session.settings
  const st = await scoreState(ctx)
  const [graders, committees] = await Promise.all([listGraders(ctx), listCommittees(ctx)])
  const staffNames = await staffNameMap(graders.map((g: any) => g.staff_id))
  const rows = pctRows(st)
  const graderOf = (ss: string, subj: string) => {
    const c = st.students.find((x) => x.id === ss)?.committee_id
    return graders.find((g: any) => g.subject_key === subj && g.committee_id === c)?.staff_id ?? null
  }
  const bias = markerBias(rows.map((r) => ({ ssId: r.s.id, pcts: r.pcts })), graderOf)
  const label = (r: (typeof rows)[number]) => (ctx.unmasked ? `${r.s.seat_number} — ${r.s.name}` : String(st.secrets.get(r.s.id)?.secret ?? ''))
  const grades = st.grades.filter((g) => !gradeLevelId || g.grade_level_id === gradeLevelId)
  const report = grades.map((g) => {
    const gr = rows.filter((r) => r.g.grade_level_id === g.grade_level_id)
    const expected = gr.length * g.subjects.length
    const entered = gr.reduce((a, r) => a + g.subjects.filter((sub) => st.official.has(st.k(r.s.id, sub.key))).length, 0)
    const subjects = g.subjects.map((sub) => {
      const vals = gr.map((r) => st.official.get(st.k(r.s.id, sub.key))).filter((o) => o && !o.absent && o.score !== null).map((o) => o!.score as number)
      const pcts = vals.map((v) => v / sub.max)
      const mean = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
      const bands = Object.fromEntries(JC_LEVEL_BANDS.map((b) => [b.label, 0]))
      for (const p of pcts) bands[JC_LEVEL_BANDS.find((b) => p + EPS >= b.from)!.label]++
      const passRate = pcts.length ? pcts.filter((p) => p + EPS >= s.exam_pass).length / pcts.length : null
      const meanPct = mean === null ? null : mean / sub.max
      const cluster = thresholdClustering(vals, sub.max, s.exam_pass)
      const teachers = [...new Set(graders.filter((x: any) => x.subject_key === sub.key).map((x: any) => staffNames.get(x.staff_id) ?? ''))].filter(Boolean)
      return {
        key: sub.key, name: sub.name, max: sub.max, teachers, entered: vals.length, missing: gr.length - vals.length, mean, meanPct, bands, passRate,
        excellenceRate: pcts.length ? pcts.filter((p) => p + EPS >= 0.85).length / pcts.length : null,
        weakRate: pcts.length ? pcts.filter((p) => p + EPS < s.weak_rate).length / pcts.length : null,
        verdict: meanPct === null ? null : meanPct >= 0.75 ? 'مستوى مرتفع' : meanPct >= 0.6 ? 'مستوى جيد' : meanPct >= 0.5 ? 'مستوى مقبول' : 'مستوى ضعيف — يحتاج خطة علاجية',
        clustering: cluster,
      }
    })
    const withPct = gr.filter((r) => r.pct !== null)
    return {
      grade_level_id: g.grade_level_id,
      name: g.grade_level_name,
      tiles: {
        students: gr.length,
        completion: expected ? entered / expected : null,
        average: withPct.length ? withPct.reduce((a, r) => a + r.pct!, 0) / withPct.length : null,
        top: withPct.filter((r) => r.pct! + EPS >= 0.85).length,
        support: withPct.filter((r) => r.pct! + EPS < s.weak_rate).length,
        errors: st.cmp.mismatches.filter((m) => gr.some((r) => r.s.id === m.ssId)).length + st.cmp.onlyFirst.filter((m) => gr.some((r) => r.s.id === m.ssId)).length + st.cmp.onlySecond.filter((m) => gr.some((r) => r.s.id === m.ssId)).length,
      },
      subjects,
      top: [...withPct].sort((a, b) => b.pct! - a.pct!).slice(0, 10).map((r) => ({ label: label(r), pct: r.pct })),
      support: withPct.filter((r) => r.pct! + EPS < s.weak_rate).sort((a, b) => a.pct! - b.pct!).map((r) => ({ label: label(r), pct: r.pct })),
    }
  })
  return {
    grades: report,
    bias: bias.map((b) => ({ ...b, grader: staffNames.get(b.graderId) ?? '', committees: graders.filter((g: any) => g.staff_id === b.graderId && g.subject_key === b.subjectKey).map((g: any) => committees.find((c) => c.id === g.committee_id)?.name ?? '') })),
    teacher_performance: [...new Set(graders.map((g: any) => g.staff_id))].map((id) => {
      const mine = rows.flatMap((r) => Object.entries(r.pcts).filter(([k, p]) => p !== null && graderOf(r.s.id, k) === id).map(([, p]) => p as number))
      return { staff_id: id, name: staffNames.get(id) ?? '', students: mine.length, meanPct: mine.length ? mine.reduce((a, b) => a + b, 0) / mine.length : null }
    }),
  }
}

async function staffNameMap(ids: string[]) {
  const uniq = [...new Set(ids)].filter(Boolean)
  if (!uniq.length) return new Map<string, string>()
  const { data } = await supabase.from('staff').select('id, profile:profiles(first_name, last_name)').in('id', uniq)
  return new Map((data ?? []).map((s: any) => {
    const p = Array.isArray(s.profile) ? s.profile[0] : s.profile
    return [s.id, [p?.first_name, p?.last_name].filter(Boolean).join(' ')]
  }))
}

/** Score-based checks of the alerts page (after grading). */
export async function scoreAlerts(ctx: JcContext): Promise<JcAlert[]> {
  const st = await scoreState(ctx)
  const s = ctx.session.settings
  const missing = st.expectedCells.filter((c) => !st.rows.some((r) => `${r.session_student_id}|${r.subject_key}` === c && r.entry === 1)).length
  const over = st.rows.filter((r) => {
    const stu = st.students.find((x) => x.id === r.session_student_id)
    const sub = stu ? st.gradeOf.get(stu.grade_level_id)?.subjects.find((x) => x.key === r.subject_key) : null
    return !sub || (r.score !== null && r.score > sub.max)
  }).length
  const appeals = await listAppeals(ctx)
  const q = await quality(ctx)
  const clustering = q.grades.flatMap((g) => g.subjects.filter((x) => x.clustering.flagged).map((x) => `${g.name} — ${x.name}`))
  const biased = q.bias.filter((b) => b.verdict !== 'normal')
  const candidates = secondRoundCandidates(pctRows(st).filter((r) => r.g.grade_code > 3).map((r) => ({ ssId: r.s.id, pcts: r.pcts })), s.exam_pass)
  const mk = (key: string, count: number, info = false, details?: string[]): JcAlert => ({ key, phase: 'after', count, status: count === 0 ? 'ok' : info ? 'info' : 'error', details })
  return [
    mk('missing_scores', st.rows.length ? missing : 0),
    mk('invalid_scores', over),
    mk('entry_mismatches', s.double_entry ? st.cmp.mismatches.length : 0),
    mk('single_entries', s.double_entry ? st.cmp.onlyFirst.length + st.cmp.onlySecond.length : 0),
    mk('threshold_clustering', clustering.length, false, clustering),
    mk('marker_bias', biased.length, true, biased.map((b) => `${b.grader} — ${b.subjectKey} (${b.deviation > 0 ? '+' : ''}${b.deviation}%)`)),
    mk('appeals_not_applied', appeals.filter((a) => !a.applied).length, true),
    mk('second_round_candidates', candidates.length, true),
  ]
}

// ---- results, second round, honor board, messages ---------------------------------------------------

export async function results(ctx: JcContext) {
  need(ctx.can.manage || ctx.can.entry)
  if (!ctx.unmasked) throw new JgError(409, 'Results with names are available after unmasking', 'not_unmasked')
  const st = await scoreState(ctx)
  const rows = pctRows(st)
  const s = ctx.session.settings
  const board = honorBoard(rows.map((r) => ({ ssId: r.s.id, gradeCode: r.g.number_code, pct: r.pct })), s.top_n)
  const candidates = secondRoundCandidates(rows.filter((r) => r.g.grade_code > 3).map((r) => ({ ssId: r.s.id, pcts: r.pcts })), s.exam_pass)
  return {
    grades: st.grades.map((g) => ({ grade_level_id: g.grade_level_id, name: g.grade_level_name, subjects: g.subjects })),
    students: rows.map((r) => ({
      id: r.s.id, student_id: r.s.student_id, name: r.s.name, seat_number: r.s.seat_number, grade_level_id: r.g.grade_level_id, grade_level_name: r.g.grade_level_name,
      scores: Object.fromEntries(r.g.subjects.map((sub) => [sub.key, st.official.get(st.k(r.s.id, sub.key)) ?? null])),
      pct: r.pct,
    })),
    honor_board: board.map((b) => ({ id: b.ssId, place: b.place, pct: b.pct, name: rows.find((r) => r.s.id === b.ssId)!.s.name, grade_level_name: rows.find((r) => r.s.id === b.ssId)!.g.grade_level_name })),
    second_round_candidates: candidates.map((c) => ({ id: c.ssId, name: rows.find((r) => r.s.id === c.ssId)!.s.name, subjects: c.subjects })),
  }
}

/** Creates the linked second-round session with the (provisional) candidates; new numbers are generated there. */
export async function createSecondRound(ctx: JcContext) {
  need(ctx.chief, 'Only the control chief can create the second-round session')
  if (ctx.session.round === 'second') throw new JgError(400, 'This is already a second-round session')
  const r = await results(ctx)
  if (!r.second_round_candidates.length) throw new JgError(400, 'No second-round candidates')
  const grades = await getGrades(ctx)
  const { data: created, error } = await supabase
    .from('jc_sessions')
    .insert({
      school_id: ctx.session.school_id, campus_id: ctx.session.campus_id, academic_year_id: ctx.session.academic_year_id,
      name: `${ctx.session.name} — الدور الثاني`, round: 'second', parent_session_id: ctx.session.id, stage: ctx.session.stage, session_code: await uniqueSessionCode(ctx.session.school_id),
      settings: cleanSettings({ ...ctx.session.settings, show_names: false }), status: 'draft', created_by: ctx.actor.profileId,
    })
    .select('id')
    .single()
  if (error) throw error
  const used = new Set(r.second_round_candidates.map((c) => r.students.find((s) => s.id === c.id)!.grade_level_id))
  await supabase.from('jc_session_grades').insert(grades.filter((g) => used.has(g.grade_level_id)).map((g) => ({ session_id: created.id, grade_level_id: g.grade_level_id, grade_code: g.grade_code, number_code: g.number_code, subjects: g.subjects })))
  const students = await loadStudents(ctx)
  await supabase.from('jc_students').insert(
    r.second_round_candidates.map((c) => {
      const s = students.find((x) => x.id === c.id)!
      return { session_id: created.id, student_id: s.student_id, grade_level_id: s.grade_level_id, section_id: s.section_id, special_case: s.special_case, special_note: s.special_note, extra_minutes: s.extra_minutes }
    }),
  )
  await logJc(ctx, 'second_round.create', 'jc_sessions', created.id, null, { students: r.second_round_candidates.length })
  return { session_id: created.id, students: r.second_round_candidates.length }
}

/** Per-student result message with the guardian's phone and a WhatsApp link; optional in-app notification. */
export async function messages(ctx: JcContext, opts: { note?: string; send?: boolean } = {}) {
  const r = await results(ctx)
  const ids = r.students.map((s) => s.student_id)
  const { data: links } = await supabase
    .from('parent_student_links')
    .select('student_id, parent:parents(profile_id, profile:profiles(phone, first_name))')
    .in('student_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000'])
    .eq('is_active', true)
  const tpl = ctx.session.settings.message_template
  const out = r.students.map((s) => {
    const g = r.grades.find((x) => x.grade_level_id === s.grade_level_id)!
    const parts = g.subjects.map((sub) => {
      const v = s.scores[sub.key]
      return `${sub.name}: ${!v ? '—' : v.absent ? 'غ' : `${Number(v.score)}/${sub.max}`}`
    })
    const text = tpl.replace('{name}', s.name).replace('{grade}', s.grade_level_name).replace('{results}', parts.join('، ')).replace('{note}', opts.note ?? '').trim()
    const parents = (links ?? []).filter((l: any) => l.student_id === s.student_id).map((l: any) => {
      const p = Array.isArray(l.parent) ? l.parent[0] : l.parent
      const pp = Array.isArray(p?.profile) ? p.profile[0] : p?.profile
      return { profile_id: p?.profile_id as string | undefined, phone: (pp?.phone as string | undefined) ?? null }
    })
    const phone = parents.find((p) => p.phone)?.phone ?? null
    const digits = phone ? phone.replace(/[^\d]/g, '') : null
    return { id: s.id, name: s.name, phone, text, whatsapp: digits ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}` : null, parent_profiles: parents.map((p) => p.profile_id).filter(Boolean) as string[] }
  })
  if (opts.send) {
    need(ctx.chief, 'Only the control chief can send results')
    for (const m of out) {
      if (m.parent_profiles.length) {
        pushNotificationsService.sendToProfiles(m.parent_profiles, { title: `نتائج ${ctx.session.name}`, body: m.text.slice(0, 180), tag: `jc-${ctx.session.id}-${m.id}` }).catch(() => undefined)
      }
    }
    await logJc(ctx, 'messages.send', 'jc_sessions', ctx.session.id, null, { count: out.length })
  }
  return out.map(({ parent_profiles: _p, ...m }) => m)
}

// ---- export to the grades module (Part E) ------------------------------------------------------------

/**
 * Writes each official exam score into its grade-sheet component (by student id), source
 * control_import; absent → is_absent. Second-round sessions write the second-round mark (papers of a
 * subject are summed). Idempotent: unchanged values are skipped. Preview first, then commit.
 */
export async function exportToGrades(ctx: JcContext, commit: boolean) {
  need(ctx.chief, 'Only the control chief can export scores to the grade sheets')
  if (!ctx.unmasked) throw new JgError(409, 'Export after unmasking', 'not_unmasked')
  const st = await scoreState(ctx)
  const second = ctx.session.round === 'second'
  const changes: { student: string; name: string; subject: string; target: string; before: string | null; after: string; action: 'new' | 'change' | 'same' }[] = []
  const markRows: any[] = []
  const round2Rows: any[] = []
  const { data: sections } = await supabase.from('students').select('id, section_id, school_id').in('id', st.students.map((s) => s.student_id).length ? st.students.map((s) => s.student_id) : ['00000000-0000-0000-0000-000000000000'])
  const sectionOf = new Map((sections ?? []).map((s: any) => [s.id, s]))
  const fmt = (o: { score: number | null; absent: boolean } | null | undefined) => (!o ? null : o.absent ? 'غ' : String(o.score))
  for (const s of st.students) {
    const g = st.gradeOf.get(s.grade_level_id)!
    const home = sectionOf.get(s.student_id)
    if (!home?.section_id) continue
    if (!second) {
      const compIds = g.subjects.map((sub) => sub.component_id).filter(Boolean) as string[]
      const { data: existing } = await supabase.from('jg_marks').select('component_id, value, is_absent').eq('student_id', s.student_id).eq('academic_year_id', ctx.session.academic_year_id).in('component_id', compIds.length ? compIds : ['00000000-0000-0000-0000-000000000000'])
      for (const sub of g.subjects) {
        const o = st.official.get(st.k(s.id, sub.key))
        if (!o || !sub.component_id) continue
        const e = (existing ?? []).find((x: any) => x.component_id === sub.component_id)
        const before = e ? (e.is_absent ? 'غ' : String(Number(e.value))) : null
        const after = fmt(o)!
        changes.push({ student: s.id, name: s.name, subject: sub.name, target: sub.component_id, before, after, action: before === null ? 'new' : before === after ? 'same' : 'change' })
        if (before !== after) {
          markRows.push({
            school_id: home.school_id, academic_year_id: ctx.session.academic_year_id, section_id: home.section_id, student_id: s.student_id, component_id: sub.component_id,
            value: o.absent ? null : o.score, is_absent: o.absent, source: 'control_import', entered_by: ctx.actor.profileId, entered_at: new Date().toISOString(),
          })
        }
      }
    } else {
      const byBase = new Map<string, { total: number; any: boolean }>()
      for (const sub of g.subjects) {
        const o = st.official.get(st.k(s.id, sub.key))
        if (!o) continue
        const base = sub.key.split('#')[0]
        const cur = byBase.get(base) ?? { total: 0, any: false }
        byBase.set(base, { total: cur.total + (o.absent ? 0 : o.score ?? 0), any: true })
      }
      const { data: jgSubjects } = await supabase.from('jg_grade_subjects').select('id, key, rule:jg_grade_rules!inner(school_id, grade_code)').eq('rule.school_id', ctx.rootId).eq('rule.grade_code', g.grade_code)
      for (const [base, v] of byBase) {
        const jgSub = (jgSubjects ?? []).find((x: any) => x.key === base)
        if (!jgSub) continue
        const { data: e } = await supabase.from('jg_round2_marks').select('value').eq('student_id', s.student_id).eq('jg_subject_id', jgSub.id).eq('academic_year_id', ctx.session.academic_year_id).maybeSingle()
        const before = e ? String(Number(e.value)) : null
        const after = String(Math.round(v.total * 100) / 100)
        changes.push({ student: s.id, name: s.name, subject: base, target: jgSub.id, before, after, action: before === null ? 'new' : before === after ? 'same' : 'change' })
        if (before !== after) {
          round2Rows.push({
            school_id: home.school_id, academic_year_id: ctx.session.academic_year_id, section_id: home.section_id, student_id: s.student_id, jg_subject_id: jgSub.id,
            value: v.total, source: 'control_import', entered_by: ctx.actor.profileId, entered_at: new Date().toISOString(),
          })
        }
      }
    }
  }
  const summary = { new: changes.filter((c) => c.action === 'new').length, change: changes.filter((c) => c.action === 'change').length, same: changes.filter((c) => c.action === 'same').length }
  if (commit) {
    for (let i = 0; i < markRows.length; i += 500) {
      const { error } = await supabase.from('jg_marks').upsert(markRows.slice(i, i + 500), { onConflict: 'student_id,component_id,academic_year_id' })
      if (error) throw error
    }
    for (let i = 0; i < round2Rows.length; i += 500) {
      const { error } = await supabase.from('jg_round2_marks').upsert(round2Rows.slice(i, i + 500), { onConflict: 'student_id,jg_subject_id,academic_year_id' })
      if (error) throw error
    }
    await supabase.from('jc_sessions').update({ status: 'published' }).eq('id', ctx.session.id)
    await logJc(ctx, 'export.grades', 'jg_marks', null, null, summary)
    await logJgAudit({ schoolId: ctx.rootId, actorId: ctx.actor.profileId, actorRole: 'chief', action: 'control.import', entity: second ? 'jg_round2_marks' : 'jg_marks', after: { session: ctx.session.id, ...summary } })
  }
  return { committed: commit, summary, changes: changes.filter((c) => c.action !== 'same').slice(0, 500) }
}

export type { JcGradeRow, JcStudentRow }
