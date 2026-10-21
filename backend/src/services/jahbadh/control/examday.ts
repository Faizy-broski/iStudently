import { supabase } from '../../../config/supabase'
import { classifyEnvelope, type JcAttendanceState } from '../../../lib/jahbadh'
import { JgError } from '../grades.service'
import { parseQrPayload } from './qr'
import { listCommittees, loadSecrets, loadStudents, logJc, need, type JcContext, type JcStudentRow } from './core'
import { listDays, type JcDay } from './planning'

async function dayOf(ctx: JcContext, dayId: string): Promise<JcDay> {
  const day = (await listDays(ctx)).find((d) => d.id === dayId)
  if (!day) throw new JgError(404, 'Exam day not found')
  return day
}

/** Participating students sitting this day's exam (their grade is on the day). */
async function dayStudents(ctx: JcContext, day: JcDay): Promise<JcStudentRow[]> {
  return (await loadStudents(ctx)).filter((s) => s.status === 'participating' && day.grade_codes.includes(s.grade_code) && s.committee_id)
}

const pub = (s: JcStudentRow) => ({
  id: s.id, name: s.name, seat_number: s.seat_number, grade_level_name: s.grade_level_name, committee_id: s.committee_id,
  seat_index: s.seat_index, special_case: s.special_case, extra_minutes: s.extra_minutes,
})

export async function attendance(ctx: JcContext, dayId: string, committeeId: string | null) {
  need(ctx.can.examday)
  const day = await dayOf(ctx, dayId)
  const students = (await dayStudents(ctx, day)).filter((s) => !committeeId || s.committee_id === committeeId).sort((a, b) => (a.seat_index ?? 0) - (b.seat_index ?? 0))
  const { data, error } = await supabase.from('jc_attendance').select('session_student_id, state, minutes_late').eq('exam_day_id', dayId)
  if (error) throw error
  const by = new Map((data ?? []).map((a: any) => [a.session_student_id, a]))
  return {
    day,
    rows: students.map((s) => ({ ...pub(s), state: (by.get(s.id)?.state ?? 'present') as JcAttendanceState, minutes_late: by.get(s.id)?.minutes_late ?? null })),
  }
}

/** Empty = present; only non-present states are stored (absent غ, late ت, temporary exit خ). */
export async function saveAttendance(ctx: JcContext, dayId: string, entries: { id: string; state: JcAttendanceState; minutes_late?: number | null }[]) {
  need(ctx.can.examday)
  const day = await dayOf(ctx, dayId)
  const allowed = new Set((await dayStudents(ctx, day)).map((s) => s.id))
  const states = ['present', 'absent', 'late', 'exit']
  for (const e of entries) {
    if (!allowed.has(e.id)) throw new JgError(400, 'This student does not sit this exam')
    if (!states.includes(e.state)) throw new JgError(400, 'Unknown attendance state')
  }
  const present = entries.filter((e) => e.state === 'present').map((e) => e.id)
  if (present.length) {
    const { error } = await supabase.from('jc_attendance').delete().eq('exam_day_id', dayId).in('session_student_id', present)
    if (error) throw error
  }
  const rows = entries.filter((e) => e.state !== 'present').map((e) => ({
    exam_day_id: dayId, session_student_id: e.id, state: e.state,
    minutes_late: e.state === 'late' ? Math.max(0, Math.round(Number(e.minutes_late) || 0)) : null,
    recorded_by: ctx.actor.profileId, recorded_at: new Date().toISOString(),
  }))
  if (rows.length) {
    const { error } = await supabase.from('jc_attendance').upsert(rows, { onConflict: 'exam_day_id,session_student_id' })
    if (error) throw error
  }
  await logJc(ctx, 'attendance.save', 'jc_attendance', dayId, null, entries)
  return attendance(ctx, dayId, null)
}

/** Seat number → student of the session (rejects unknown numbers). */
export async function bySeat(ctx: JcContext, seat: number) {
  need(ctx.can.examday)
  return studentBySeat(ctx, seat)
}

/** Same lookup without the exam-day right (callers check theirs: stub scans need the secret right). */
export async function studentBySeat(ctx: JcContext, seat: number) {
  const s = (await loadStudents(ctx)).find((x) => x.seat_number === seat && x.status === 'participating')
  if (!s) throw new JgError(404, 'Unknown seat number in this session', 'unknown_seat')
  const committees = await listCommittees(ctx)
  return { ...pub(s), committee_name: committees.find((c) => c.id === s.committee_id)?.name ?? null }
}

export async function listViolations(ctx: JcContext, dayId?: string | null) {
  need(ctx.can.examday)
  let q = supabase.from('jc_violations').select('*').eq('session_id', ctx.session.id).order('recorded_at', { ascending: false })
  if (dayId) q = q.eq('exam_day_id', dayId)
  const { data, error } = await q
  if (error) throw error
  const students = new Map((await loadStudents(ctx)).map((s) => [s.id, s]))
  const counts = new Map<string, number>()
  for (const v of data ?? []) counts.set(v.session_student_id, (counts.get(v.session_student_id) ?? 0) + 1)
  return (data ?? []).map((v: any) => {
    const s = students.get(v.session_student_id)
    return { ...v, seat_number: s?.seat_number ?? null, name: s?.name ?? '', grade_level_name: s?.grade_level_name ?? '', committee_id: s?.committee_id ?? null, repeat: (counts.get(v.session_student_id) ?? 0) >= 2 }
  })
}

export async function addViolation(ctx: JcContext, body: { exam_day_id: string; seat_number: number; type: string; action_taken?: string; invigilator_id?: string | null; notes?: string }) {
  need(ctx.can.examday)
  await dayOf(ctx, body.exam_day_id)
  const s = await bySeat(ctx, Number(body.seat_number))
  const type = String(body.type ?? '').trim()
  if (!type) throw new JgError(400, 'Choose the violation type')
  const { data, error } = await supabase
    .from('jc_violations')
    .insert({
      session_id: ctx.session.id, exam_day_id: body.exam_day_id, session_student_id: s.id, type: type.slice(0, 120),
      action_taken: body.action_taken ? String(body.action_taken).slice(0, 200) : null, invigilator_id: body.invigilator_id || null,
      notes: body.notes ? String(body.notes).slice(0, 500) : null, recorded_by: ctx.actor.profileId,
    })
    .select('id')
    .single()
  if (error) throw error
  await logJc(ctx, 'violation.add', 'jc_violations', data.id, null, body)
  return listViolations(ctx, body.exam_day_id)
}

export async function deleteViolation(ctx: JcContext, id: string) {
  need(ctx.can.manage)
  const { error } = await supabase.from('jc_violations').delete().eq('id', id).eq('session_id', ctx.session.id)
  if (error) throw error
  await logJc(ctx, 'violation.delete', 'jc_violations', id)
  return listViolations(ctx)
}

export async function envelopes(ctx: JcContext, dayId: string) {
  need(ctx.can.examday)
  const day = await dayOf(ctx, dayId)
  const [committees, students, { data: env }, { data: att }] = await Promise.all([
    listCommittees(ctx),
    dayStudents(ctx, day),
    supabase.from('jc_envelopes').select('*').eq('exam_day_id', dayId),
    supabase.from('jc_attendance').select('session_student_id, state').eq('exam_day_id', dayId),
  ])
  const absent = new Set((att ?? []).filter((a: any) => a.state === 'absent').map((a: any) => a.session_student_id))
  return committees
    .filter((c) => students.some((s) => s.committee_id === c.id))
    .map((c) => {
      const inside = students.filter((s) => s.committee_id === c.id)
      const present = inside.filter((s) => !absent.has(s.id)).length
      const e: any = (env ?? []).find((x: any) => x.committee_id === c.id)
      return {
        committee_id: c.id, committee_name: c.name, students: inside.length, present,
        booklet_count: e?.booklet_count ?? null, received_at: e?.received_at ?? null, sealed: !!e?.sealed,
        match: e?.booklet_count === null || e?.booklet_count === undefined ? null : e.booklet_count === present,
      }
    })
}

export async function saveEnvelope(ctx: JcContext, dayId: string, body: { committee_id: string; booklet_count: number | null; sealed?: boolean; scanned?: number[] }) {
  need(ctx.can.examday)
  await dayOf(ctx, dayId)
  const count = body.booklet_count === null || body.booklet_count === undefined ? null : Math.max(0, Math.round(Number(body.booklet_count)))
  const { error } = await supabase.from('jc_envelopes').upsert(
    {
      exam_day_id: dayId, committee_id: body.committee_id, booklet_count: count, sealed: !!body.sealed,
      received_at: count === null ? null : new Date().toISOString(), received_by: ctx.actor.profileId,
    },
    { onConflict: 'exam_day_id,committee_id' },
  )
  if (error) throw error
  await logJc(ctx, 'envelope.save', 'jc_envelopes', `${dayId}:${body.committee_id}`, null, body)
  return envelopes(ctx, dayId)
}

/** Live dashboard of one exam day (C6.6): tiles and a row per committee. */
export async function dashboard(ctx: JcContext, dayId: string) {
  need(ctx.can.examday)
  const day = await dayOf(ctx, dayId)
  const [students, env, { data: att }, { data: vio }] = await Promise.all([
    dayStudents(ctx, day),
    envelopes(ctx, dayId),
    supabase.from('jc_attendance').select('session_student_id, state').eq('exam_day_id', dayId),
    supabase.from('jc_violations').select('session_student_id').eq('exam_day_id', dayId),
  ])
  const state = new Map((att ?? []).map((a: any) => [a.session_student_id, a.state]))
  const count = (pred: (s: JcStudentRow) => boolean) => students.filter(pred).length
  const vioBy = new Map<string, number>()
  for (const v of vio ?? []) vioBy.set(v.session_student_id, (vioBy.get(v.session_student_id) ?? 0) + 1)
  return {
    day,
    tiles: {
      students: students.length,
      present: count((s) => state.get(s.id) !== 'absent'),
      absent: count((s) => state.get(s.id) === 'absent'),
      late: count((s) => state.get(s.id) === 'late'),
      envelopes: env.filter((e) => e.booklet_count !== null).length,
      envelopes_total: env.length,
      violations: (vio ?? []).length,
    },
    committees: env.map((e) => {
      const inside = students.filter((s) => s.committee_id === e.committee_id)
      return {
        ...e,
        absent: inside.filter((s) => state.get(s.id) === 'absent').length,
        late: inside.filter((s) => state.get(s.id) === 'late').length,
        violations: inside.reduce((a, s) => a + (vioBy.get(s.id) ?? 0), 0),
      }
    }),
  }
}

// ---- QR envelope receipt (C7.4 #2) ----------------------------------------------------------------------

/**
 * Checks the booklets scanned into one committee's envelope: received, missing, duplicates, booklets of
 * another committee, of an absent student or of a student not sitting today, and unreadable codes.
 * Stateless: the scanning screen keeps the list and sends it whole; sealing logs it (saveEnvelope).
 */
export async function envelopeCheck(ctx: JcContext, dayId: string, committeeId: string, payloads: string[]) {
  need(ctx.can.examday)
  const day = await dayOf(ctx, dayId)
  const [students, secrets, committees, { data: att }] = await Promise.all([
    loadStudents(ctx),
    loadSecrets(ctx),
    listCommittees(ctx),
    supabase.from('jc_attendance').select('session_student_id, state').eq('exam_day_id', dayId),
  ])
  if (!committees.some((c) => c.id === committeeId)) throw new JgError(404, 'Committee not found')
  const absent = new Set((att ?? []).filter((a: any) => a.state === 'absent').map((a: any) => a.session_student_id))
  const invalid: { index: number; reason: string }[] = []
  const scanned: number[] = []
  payloads.slice(0, 500).forEach((p, index) => {
    const r = parseQrPayload(String(p), ctx.session.session_code, 'booklet')
    if (r.ok) scanned.push((r as { secret: number }).secret)
    else invalid.push({ index, reason: (r as { reason: string }).reason })
  })
  const rows = students
    .filter((s) => s.status === 'participating' && secrets.has(s.id))
    .map((s) => ({
      secret: secrets.get(s.id)!.secret,
      committeeId: s.committee_id,
      committeeName: committees.find((c) => c.id === s.committee_id)?.name ?? null,
      sitsToday: day.grade_codes.includes(s.grade_code),
      absent: absent.has(s.id),
    }))
  return { ...classifyEnvelope(committeeId, scanned, rows), invalid }
}

// ---- exam timer link (Part D, Part E #4–5) ------------------------------------------------------------

/**
 * What the room timer imports from the control: exam days (subject, grades, times) and, per date, the
 * seats with extra time (special cases), optionally for one committee. No names.
 */
export async function timerFeed(ctx: JcContext, date: string | null, committeeId: string | null) {
  need(ctx.can.examday || ctx.can.manage)
  const days = await listDays(ctx)
  const grades = new Map<number, string>()
  for (const s of await loadStudents(ctx)) grades.set(s.grade_code, s.grade_level_name)
  const out = {
    session: { id: ctx.session.id, name: ctx.session.name },
    committees: (await listCommittees(ctx)).map((c) => ({ id: c.id, name: c.name })),
    days: days.map((d) => ({ ...d, grade_names: d.grade_codes.map((c) => grades.get(c) ?? String(c)) })),
    extras: [] as { seat: number; minutes: number; day_id: string; special_case: string | null }[],
  }
  if (date) {
    const today = days.filter((d) => d.exam_date === date)
    const students = (await loadStudents(ctx)).filter(
      (s) => s.status === 'participating' && s.special_case && (s.extra_minutes ?? 0) > 0 && s.seat_number !== null && (!committeeId || s.committee_id === committeeId),
    )
    for (const s of students) {
      const d = today.find((x) => x.grade_codes.includes(s.grade_code))
      if (d) out.extras.push({ seat: s.seat_number!, minutes: s.extra_minutes!, day_id: d.id, special_case: s.special_case })
    }
  }
  return out
}

/** Attaches the timer's minutes to the committee's exam-day record (append-only, in the session log). */
export async function saveTimerMinutes(ctx: JcContext, dayId: string, body: { committee_id?: string | null; text?: string; events?: unknown[] }) {
  need(ctx.can.examday)
  await dayOf(ctx, dayId)
  const text = String(body.text ?? '').trim()
  if (!text) throw new JgError(400, 'The minutes are empty')
  await logJc(ctx, 'timer.minutes', 'jc_exam_days', `${dayId}:${body.committee_id ?? ''}`, null, {
    committee_id: body.committee_id ?? null,
    text: text.slice(0, 20000),
    events: Array.isArray(body.events) ? body.events.slice(0, 500) : [],
  })
  return listTimerMinutes(ctx, dayId)
}

export async function listTimerMinutes(ctx: JcContext, dayId: string) {
  need(ctx.can.examday || ctx.can.manage)
  const { data, error } = await supabase
    .from('jc_audit_log')
    .select('id, created_at, actor_id, after')
    .eq('session_id', ctx.session.id)
    .eq('action', 'timer.minutes')
    .like('entity_id', `${dayId}:%`)
    .order('created_at', { ascending: false })
  if (error) throw error
  const committees = await listCommittees(ctx)
  return (data ?? []).map((r: any) => ({
    id: r.id,
    created_at: r.created_at,
    committee_id: r.after?.committee_id ?? null,
    committee_name: committees.find((c) => c.id === r.after?.committee_id)?.name ?? null,
    text: r.after?.text ?? '',
  }))
}
