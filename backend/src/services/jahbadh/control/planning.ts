import { supabase } from '../../../config/supabase'
import { adjacentPairs, assignInvigilation, seatingMap } from '../../../lib/jahbadh'
import { JgError } from '../grades.service'
import { getGrades, listCommittees, loadSecrets, loadStudents, logJc, need, type JcContext } from './core'

// ---- timetable (exam days) --------------------------------------------------------------------------

export interface JcDay {
  id: string
  exam_date: string
  subject_key: string
  subject_name: string
  grade_codes: number[]
  start_time: string | null
  end_time: string | null
  duration_minutes: number | null
}

export async function listDays(ctx: JcContext): Promise<JcDay[]> {
  const { data, error } = await supabase.from('jc_exam_days').select('*').eq('session_id', ctx.session.id).order('exam_date').order('start_time')
  if (error) throw error
  return (data ?? []) as JcDay[]
}

export async function saveDays(ctx: JcContext, list: Partial<JcDay>[]) {
  need(ctx.can.manage)
  const grades = await getGrades(ctx)
  const codes = new Set(grades.map((g) => g.grade_code))
  const current = await listDays(ctx)
  const keep = new Set(list.map((d) => d.id).filter(Boolean))
  const remove = current.filter((d) => !keep.has(d.id)).map((d) => d.id)
  if (remove.length) {
    const { error } = await supabase.from('jc_exam_days').delete().in('id', remove)
    if (error) throw error
  }
  for (const d of list) {
    if (!d.exam_date || !/^\d{4}-\d{2}-\d{2}$/.test(d.exam_date)) throw new JgError(400, 'Each exam day needs a date')
    const gc = (d.grade_codes ?? []).map(Number).filter((c) => codes.has(c))
    if (!gc.length) throw new JgError(400, 'Each exam day needs at least one grade of the session')
    if (!d.subject_key) throw new JgError(400, 'Each exam day needs a subject')
    const name = d.subject_name || grades.find((g) => gc.includes(g.grade_code))?.subjects.find((s) => s.key === d.subject_key)?.name || d.subject_key
    let duration = d.duration_minutes ?? null
    if (!duration && d.start_time && d.end_time) {
      const [h1, m1] = d.start_time.split(':').map(Number)
      const [h2, m2] = d.end_time.split(':').map(Number)
      duration = h2 * 60 + m2 - (h1 * 60 + m1)
    }
    const row = {
      session_id: ctx.session.id, exam_date: d.exam_date, subject_key: d.subject_key, subject_name: String(name).slice(0, 120), grade_codes: gc,
      start_time: d.start_time || null, end_time: d.end_time || null, duration_minutes: duration && duration > 0 ? duration : null,
    }
    const { error } = d.id ? await supabase.from('jc_exam_days').update(row).eq('id', d.id) : await supabase.from('jc_exam_days').insert(row)
    if (error) throw error
  }
  await logJc(ctx, 'schedule.save', 'jc_exam_days', null, current, list)
  return listDays(ctx)
}

// ---- invigilators and fair invigilation (C9) --------------------------------------------------------

export async function listInvigilators(ctx: JcContext) {
  const { data, error } = await supabase
    .from('jc_invigilators')
    .select('staff_id, specialization, available, unavailable_days, staff:staff(id, profile:profiles(first_name, last_name))')
    .eq('session_id', ctx.session.id)
  if (error) throw error
  return (data ?? []).map((r: any) => {
    const st = Array.isArray(r.staff) ? r.staff[0] : r.staff
    const p = Array.isArray(st?.profile) ? st.profile[0] : st?.profile
    return { staff_id: r.staff_id, name: [p?.first_name, p?.last_name].filter(Boolean).join(' '), specialization: r.specialization, available: r.available, unavailable_days: r.unavailable_days ?? [] }
  })
}

export async function saveInvigilators(ctx: JcContext, list: { staff_id: string; specialization?: string | null; available?: boolean; unavailable_days?: string[] }[]) {
  need(ctx.can.manage)
  const { error: de } = await supabase.from('jc_invigilators').delete().eq('session_id', ctx.session.id)
  if (de) throw de
  if (list.length) {
    const { error } = await supabase.from('jc_invigilators').insert(
      list.map((x) => ({ session_id: ctx.session.id, staff_id: x.staff_id, specialization: x.specialization || null, available: x.available !== false, unavailable_days: x.unavailable_days ?? [] })),
    )
    if (error) throw error
  }
  await logJc(ctx, 'invigilators.save', 'jc_invigilators', null, null, list)
  return listInvigilators(ctx)
}

/** Teachers of the school with their main subject (for adding invigilators). */
export async function staffChoices(ctx: JcContext) {
  let q = supabase.from('staff').select('id, profile_id, school_id, profile:profiles(first_name, last_name, role, is_active)')
  const { data: campuses } = await supabase.from('schools').select('id').or(`id.eq.${ctx.rootId},parent_school_id.eq.${ctx.rootId}`)
  q = q.in('school_id', (campuses ?? []).map((c: any) => c.id))
  const { data, error } = await q
  if (error) throw error
  return (data ?? [])
    .map((s: any) => ({ id: s.id, profile_id: s.profile_id as string, p: Array.isArray(s.profile) ? s.profile[0] : s.profile }))
    .filter(({ p }) => p?.is_active !== false && ['teacher', 'staff', 'admin'].includes(p?.role))
    .map(({ id, profile_id, p }) => ({ id, profile_id, name: [p?.first_name, p?.last_name].filter(Boolean).join(' '), role: p?.role }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ar'))
}

export async function listInvigilation(ctx: JcContext) {
  const { data, error } = await supabase.from('jc_invigilation').select('*').eq('session_id', ctx.session.id)
  if (error) throw error
  return data ?? []
}

export async function generateInvigilation(ctx: JcContext) {
  need(ctx.can.manage)
  const s = ctx.session.settings
  const [days, committees, invs] = await Promise.all([listDays(ctx), listCommittees(ctx), listInvigilators(ctx)])
  if (!days.length) throw new JgError(400, 'Add the exam timetable first')
  const students = await loadStudents(ctx)
  const active = committees.filter((c) => students.some((x) => x.committee_id === c.id))
  // Days are numbered in timetable order; each day only needs the committees of its grades.
  const result = assignInvigilation(
    days.map((d) => ({ id: d.id, subjectKey: d.subject_key.split('#')[0] })),
    active.map((c) => c.id),
    invs.map((t) => ({ id: t.staff_id, specialization: t.specialization, available: t.available, unavailableDays: t.unavailable_days })),
    s.obs_per_committee,
    s.reserve_per_day,
  )
  const before = await listInvigilation(ctx)
  const { error: de } = await supabase.from('jc_invigilation').delete().eq('session_id', ctx.session.id)
  if (de) throw de
  if (result.duties.length) {
    const { error } = await supabase.from('jc_invigilation').insert(
      result.duties.map((x) => ({ session_id: ctx.session.id, exam_day_id: x.dayId, committee_id: x.committeeId, staff_id: x.teacherId, slot: x.slot, is_reserve: x.reserve })),
    )
    if (error) throw error
  }
  await logJc(ctx, 'invigilation.generate', 'jc_invigilation', null, { count: before.length }, { count: result.duties.length })
  return { duties: await listInvigilation(ctx), short_days: result.shortDays, loads: result.loads }
}

/** Manual change of one duty (logged). */
export async function setDuty(ctx: JcContext, body: { exam_day_id: string; committee_id: string | null; slot: number; is_reserve?: boolean; staff_id: string | null }) {
  need(ctx.can.manage)
  const match = supabase.from('jc_invigilation').delete().eq('session_id', ctx.session.id).eq('exam_day_id', body.exam_day_id).eq('slot', body.slot).eq('is_reserve', !!body.is_reserve)
  const { error: de } = body.committee_id ? await match.eq('committee_id', body.committee_id) : await match.is('committee_id', null)
  if (de) throw de
  if (body.staff_id) {
    const { error } = await supabase.from('jc_invigilation').insert({
      session_id: ctx.session.id, exam_day_id: body.exam_day_id, committee_id: body.committee_id, staff_id: body.staff_id, slot: body.slot, is_reserve: !!body.is_reserve, is_manual: true,
    })
    if (error) throw error
  }
  await logJc(ctx, 'invigilation.manual', 'jc_invigilation', null, null, body)
  return listInvigilation(ctx)
}

// ---- committee status and alerts (C6.3, C6.4) -------------------------------------------------------

export async function committeeStatus(ctx: JcContext) {
  const [students, committees] = await Promise.all([loadStudents(ctx), listCommittees(ctx)])
  return committees.map((c) => {
    const inside = students.filter((s) => s.committee_id === c.id && s.status === 'participating').sort((a, b) => (a.seat_index ?? 0) - (b.seat_index ?? 0))
    const grades = [...new Set(inside.map((s) => s.grade_level_name))]
    const flags: string[] = []
    if (!c.capacity) flags.push('no_capacity')
    if (inside.length > c.capacity) flags.push('over_capacity')
    if (!c.invigilator1_id && !c.invigilator2_id) flags.push('no_invigilator')
    if (grades.length === 1 && new Set(students.map((s) => s.grade_level_id)).size > 1 && inside.length > 1) flags.push('single_grade')
    return {
      ...c,
      count: inside.length,
      from_seat: inside.length ? Math.min(...inside.map((s) => s.seat_number ?? Infinity)) : null,
      to_seat: inside.length ? Math.max(...inside.map((s) => s.seat_number ?? 0)) : null,
      grades,
      occupancy: c.capacity ? inside.length / c.capacity : null,
      special: inside.filter((s) => s.special_case).length,
      flags,
    }
  })
}

export interface JcAlert {
  key: string
  phase: 'before' | 'examday' | 'after'
  count: number
  status: 'ok' | 'error' | 'info'
  details?: string[]
}

/** Every check of the alerts page (C6.4) that does not need scores; score checks are added by quality(). */
export async function alerts(ctx: JcContext, extra: JcAlert[] = []): Promise<JcAlert[]> {
  const s = ctx.session.settings
  const [students, committees, days, duties, invs, { data: violations }, secrets] = await Promise.all([
    loadStudents(ctx), listCommittees(ctx), listDays(ctx), listInvigilation(ctx), listInvigilators(ctx),
    supabase.from('jc_violations').select('session_student_id, exam_day_id').eq('session_id', ctx.session.id),
    loadSecrets(ctx),
  ])
  const part = students.filter((x) => x.status === 'participating')
  const list: JcAlert[] = []
  const add = (key: string, phase: JcAlert['phase'], count: number, details?: string[], infoOnly = false) =>
    list.push({ key, phase, count, status: count === 0 ? 'ok' : infoOnly ? 'info' : 'error', details: details?.slice(0, 50) })

  add('unassigned', 'before', part.filter((x) => !x.committee_id).length, part.filter((x) => !x.committee_id).map((x) => x.name))
  const status = await committeeStatus(ctx)
  add('over_capacity', 'before', status.filter((c) => c.flags.includes('over_capacity')).length, status.filter((c) => c.flags.includes('over_capacity')).map((c) => c.name))
  add('no_invigilator', 'before', status.filter((c) => c.count && c.flags.includes('no_invigilator') && !duties.some((d) => d.committee_id === c.id)).length)
  // Same invigilator in two committees of the same day.
  const doubleBooked = new Set<string>()
  for (const d of days) {
    const seen = new Map<string, string>()
    for (const x of duties.filter((y: any) => y.exam_day_id === d.id && !y.is_reserve)) {
      if (seen.has(x.staff_id) && seen.get(x.staff_id) !== x.committee_id) doubleBooked.add(`${d.exam_date}:${x.staff_id}`)
      seen.set(x.staff_id, x.committee_id)
    }
  }
  add('double_booked', 'before', doubleBooked.size)
  add('single_grade', 'before', status.filter((c) => c.flags.includes('single_grade')).length, status.filter((c) => c.flags.includes('single_grade')).map((c) => c.name), true)
  add('no_capacity', 'before', committees.filter((c) => !c.capacity).length, committees.filter((c) => !c.capacity).map((c) => c.name))
  add('over_print_limit', 'before', status.filter((c) => c.count > s.max_list).length, status.filter((c) => c.count > s.max_list).map((c) => c.name), true)
  add('missing_grade', 'before', students.filter((x) => !x.grade_code).length)
  const dupNames = new Map<string, number>()
  for (const x of part) dupNames.set(`${x.grade_level_id}|${x.name}`, (dupNames.get(`${x.grade_level_id}|${x.name}`) ?? 0) + 1)
  add('duplicate_names', 'before', [...dupNames.values()].filter((n) => n > 1).length, [...dupNames.entries()].filter(([, n]) => n > 1).map(([k]) => k.split('|')[1]))
  // Same-grade neighbours in the seating maps (can be accepted).
  let sameNeighbours = 0
  for (const c of committees) {
    const inside = part.filter((x) => x.committee_id === c.id)
    const byIdx = new Map(inside.map((x) => [x.seat_index, x.grade_level_id]))
    for (const [a, b] of adjacentPairs(seatingMap(inside.length, c.seat_columns))) if (byIdx.get(a) && byIdx.get(a) === byIdx.get(b)) sameNeighbours++
  }
  add('same_grade_neighbours', 'before', sameNeighbours, undefined, true)
  const seats = part.map((x) => x.seat_number).filter((n): n is number => n !== null)
  const secretValues = [...secrets.values()].map((x) => x.secret)
  add('duplicate_numbers', 'before', seats.length - new Set(seats).size + (secretValues.length - new Set(secretValues).size))
  add('numbers_missing', 'before', part.filter((x) => x.seat_number === null || !secrets.has(x.id)).length)
  const needed = committees.filter((c) => status.find((x) => x.id === c.id)?.count).length * s.obs_per_committee + s.reserve_per_day
  const shortDays = days.filter((d) => invs.filter((t) => t.available && !t.unavailable_days.includes(d.id) && t.specialization !== d.subject_key.split('#')[0]).length < needed)
  add('short_invigilators', 'before', invs.length ? shortDays.length : 0, shortDays.map((d) => `${d.exam_date} ${d.subject_name}`))
  add('map_too_small', 'before', status.filter((c) => Math.ceil(c.count / Math.max(1, c.seat_columns)) > 8).length, status.filter((c) => Math.ceil(c.count / Math.max(1, c.seat_columns)) > 8).map((c) => c.name), true)
  add('special_mixed', 'before', committees.filter((c) => {
    const inside = part.filter((x) => x.committee_id === c.id)
    return inside.some((x) => x.special_case) && inside.some((x) => !x.special_case)
  }).length, undefined, true)

  const perStudent = new Map<string, number>()
  for (const v of violations ?? []) perStudent.set(v.session_student_id, (perStudent.get(v.session_student_id) ?? 0) + 1)
  add('violations', 'examday', (violations ?? []).length, undefined, true)
  add('repeat_offenders', 'examday', [...perStudent.values()].filter((n) => n >= 2).length, part.filter((x) => (perStudent.get(x.id) ?? 0) >= 2).map((x) => `${x.seat_number} ${x.name}`))
  const { data: envelopes } = await supabase.from('jc_envelopes').select('exam_day_id, committee_id, booklet_count').in('exam_day_id', days.map((d) => d.id).length ? days.map((d) => d.id) : ['00000000-0000-0000-0000-000000000000'])
  const { data: att } = await supabase.from('jc_attendance').select('exam_day_id, session_student_id, state').in('exam_day_id', days.map((d) => d.id).length ? days.map((d) => d.id) : ['00000000-0000-0000-0000-000000000000'])
  let envelopeMismatch = 0
  for (const e of envelopes ?? []) {
    if (e.booklet_count === null) continue
    const day = days.find((d) => d.id === e.exam_day_id)
    const expected = part.filter((x) => x.committee_id === e.committee_id && day?.grade_codes.includes(x.grade_code))
    const absent = new Set((att ?? []).filter((a: any) => a.exam_day_id === e.exam_day_id && a.state === 'absent').map((a: any) => a.session_student_id))
    if (e.booklet_count !== expected.filter((x) => !absent.has(x.id)).length) envelopeMismatch++
  }
  add('envelope_mismatch', 'examday', envelopeMismatch)
  add('special_reminder', 'after', part.filter((x) => x.special_case).length, part.filter((x) => x.special_case).map((x) => `${x.seat_number} ${x.name}`), true)
  return [...list, ...extra]
}

export { seatingMap }
