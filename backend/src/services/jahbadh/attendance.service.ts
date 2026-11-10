import { supabase } from '../../config/supabase'
import { logJgAudit } from './audit.service'
import { JgError, sectionStudents, type JgActor, type JgSectionContext, type JgStudent } from './grades.service'
import { gradeStages } from './report-cards.service'

/**
 * Daily attendance per stage («الحضور اليومي», brief B6 #26, workbook sheet of the same name).
 * One code per student per school day: غ unexcused, ع excused, ت late (ح = present, set by hand
 * over a platform absence). Days run from each stage's start to the day before the next stage
 * (the last stage to the year end), skipping weekend days and holidays. Days without a Jahbadh
 * code take the platform's own attendance (attendance_records). Saving writes each stage's
 * totals into the report-card absence fields (jg_activity_records). An alert shows when a
 * student's unexcused days reach the calendar's limit (workbook default 10).
 */

export type JgDayCode = 'غ' | 'ع' | 'ت'
export const JG_DAY_CODES: readonly JgDayCode[] = ['غ', 'ع', 'ت']
const PRESENT = 'ح'

export interface JgAttendanceCalendar {
  configured: boolean
  stage_starts: [string | null, string | null, string | null]
  year_end: string | null
  /** 0 = Sunday … 6 = Saturday. */
  weekend_days: number[]
  holidays: string[]
  alert_limit: number
}

const DEFAULT_WEEKEND = [5, 6]
const DEFAULT_ALERT = 10

const missingTable = (e: any) => e && (e.code === 'PGRST205' || e.code === '42P01')
const notMigrated = () => new JgError(503, 'Run the Jahbadh migration jahbadh_wave2_data.sql first', 'not_migrated')
const isDate = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`))

async function yearDates(yearId: string): Promise<{ start: string | null; end: string | null }> {
  const { data } = await supabase.from('academic_years').select('start_date, end_date').eq('id', yearId).maybeSingle()
  return { start: (data as any)?.start_date ?? null, end: (data as any)?.end_date ?? null }
}

export async function getCalendar(rootId: string, yearId: string): Promise<JgAttendanceCalendar> {
  const { data, error } = await supabase
    .from('jg_attendance_calendar')
    .select('stage1_start, stage2_start, stage3_start, year_end, weekend_days, holidays, alert_limit')
    .eq('school_id', rootId)
    .eq('academic_year_id', yearId)
    .maybeSingle()
  if (error && !missingTable(error)) throw error
  const yd = await yearDates(yearId)
  if (!data) {
    return { configured: false, stage_starts: [yd.start, null, null], year_end: yd.end, weekend_days: DEFAULT_WEEKEND, holidays: [], alert_limit: DEFAULT_ALERT }
  }
  const d = data as any
  return {
    configured: true,
    stage_starts: [d.stage1_start ?? null, d.stage2_start ?? null, d.stage3_start ?? null],
    year_end: d.year_end ?? yd.end,
    weekend_days: d.weekend_days ?? DEFAULT_WEEKEND,
    holidays: d.holidays ?? [],
    alert_limit: d.alert_limit ?? DEFAULT_ALERT,
  }
}

export async function saveCalendar(
  ctx: { rootId: string; yearId: string },
  body: Partial<{ stage_starts: (string | null)[]; year_end: string | null; weekend_days: number[]; holidays: string[]; alert_limit: number }>,
  actor: JgActor,
): Promise<JgAttendanceCalendar> {
  const cur = await getCalendar(ctx.rootId, ctx.yearId)
  const starts = (body.stage_starts ?? cur.stage_starts).slice(0, 3)
  while (starts.length < 3) starts.push(null)
  for (const s of starts) if (s !== null && !isDate(s)) throw new JgError(400, 'Stage start dates must be YYYY-MM-DD')
  if (!starts[0]) throw new JgError(400, 'The first stage needs a start date')
  for (let i = 1; i < 3; i++) {
    if (starts[i] && (!starts[i - 1] || starts[i]! <= starts[i - 1]!)) throw new JgError(400, 'Each stage must start after the previous one')
  }
  const yearEnd = body.year_end === undefined ? cur.year_end : body.year_end
  if (yearEnd !== null && !isDate(yearEnd)) throw new JgError(400, 'The year end must be YYYY-MM-DD')
  const lastStart = [...starts].reverse().find(Boolean)!
  if (yearEnd && yearEnd < lastStart) throw new JgError(400, 'The year end must be after the last stage start')
  const weekend = body.weekend_days ?? cur.weekend_days
  if (!Array.isArray(weekend) || weekend.some((d) => !Number.isInteger(d) || d < 0 || d > 6) || weekend.length > 3) {
    throw new JgError(400, 'Weekend days are 0 (Sunday) to 6 (Saturday), at most 3')
  }
  const holidays = body.holidays ?? cur.holidays
  if (!Array.isArray(holidays) || holidays.some((h) => !isDate(h)) || holidays.length > 120) throw new JgError(400, 'Holidays must be dates (YYYY-MM-DD)')
  const limit = body.alert_limit ?? cur.alert_limit
  if (!Number.isInteger(limit) || limit < 0 || limit > 200) throw new JgError(400, 'The alert limit must be a whole number')

  const row = {
    school_id: ctx.rootId, academic_year_id: ctx.yearId,
    stage1_start: starts[0], stage2_start: starts[1], stage3_start: starts[2], year_end: yearEnd,
    weekend_days: [...new Set(weekend)], holidays: [...new Set(holidays)].sort(), alert_limit: limit,
    updated_by: actor.profileId, updated_at: new Date().toISOString(),
  }
  const { error } = await supabase.from('jg_attendance_calendar').upsert(row, { onConflict: 'school_id,academic_year_id' })
  if (missingTable(error)) throw notMigrated()
  if (error) throw error
  await logJgAudit({ schoolId: ctx.rootId, actorId: actor.profileId, actorRole: actor.role, action: 'attendance.calendar', entity: 'jg_attendance_calendar', after: row })
  return getCalendar(ctx.rootId, ctx.yearId)
}

// ---- school days -------------------------------------------------------------------------------

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
const weekday = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay()

export interface JgStageDays { stage: number; name: string; start: string | null; end: string | null; days: string[] }

/** School days of each stage the grade has (workbook: WORKDAY.INTL skipping Friday and Saturday). */
export function stageDays(cal: JgAttendanceCalendar, stages: number[], stageNames: string[]): JgStageDays[] {
  const holidays = new Set(cal.holidays)
  const weekend = new Set(cal.weekend_days)
  return stages.map((stage) => {
    const start = cal.stage_starts[stage - 1]
    const next = cal.stage_starts.slice(stage).find(Boolean) ?? null
    const end = next ? addDays(next, -1) : cal.year_end
    const days: string[] = []
    if (start && end) {
      for (let d = start, guard = 0; d <= end && guard < 400; d = addDays(d, 1), guard++) {
        if (!weekend.has(weekday(d)) && !holidays.has(d)) days.push(d)
      }
    }
    return { stage, name: stageNames[stage - 1] ?? `${stage}`, start, end, days }
  })
}

// ---- codes -------------------------------------------------------------------------------------

interface StoredCode { student_id: string; att_date: string; code: string }

async function loadStored(ctx: JgSectionContext, from: string, to: string): Promise<StoredCode[]> {
  const out: StoredCode[] = []
  for (let page = 0; page < 50; page++) {
    const { data, error } = await supabase
      .from('jg_daily_attendance')
      .select('student_id, att_date, code')
      .eq('section_id', ctx.section.id)
      .eq('academic_year_id', ctx.yearId)
      .gte('att_date', from)
      .lte('att_date', to)
      .range(page * 1000, page * 1000 + 999)
    if (missingTable(error)) return []
    if (error) throw error
    out.push(...((data ?? []) as StoredCode[]))
    if ((data ?? []).length < 1000) break
  }
  return out
}

/**
 * Day code from the platform's per-period records: absent (or excused) in every recorded period
 * → غ (ع when all were excused); otherwise late in any period → ت; otherwise present.
 */
export function platformDayCode(statuses: string[]): JgDayCode | null {
  if (!statuses.length) return null
  if (statuses.every((s) => s === 'absent' || s === 'excused')) return statuses.every((s) => s === 'excused') ? 'ع' : 'غ'
  if (statuses.some((s) => s === 'late')) return 'ت'
  return null
}

async function loadPlatform(studentIds: string[], from: string, to: string): Promise<Map<string, JgDayCode>> {
  const byDay = new Map<string, string[]>()
  for (let i = 0; i < studentIds.length; i += 100) {
    const chunk = studentIds.slice(i, i + 100)
    for (let page = 0; page < 200; page++) {
      const { data, error } = await supabase
        .from('attendance_records')
        .select('student_id, attendance_date, status')
        .in('student_id', chunk)
        .gte('attendance_date', from)
        .lte('attendance_date', to)
        .range(page * 1000, page * 1000 + 999)
      // Platform attendance is optional: a school that doesn't take it just gets no pre-fill.
      if (error) return new Map()
      for (const r of (data ?? []) as any[]) {
        const k = `${r.student_id}|${r.attendance_date}`
        byDay.set(k, [...(byDay.get(k) ?? []), r.status ?? 'present'])
      }
      if ((data ?? []).length < 1000) break
    }
  }
  const out = new Map<string, JgDayCode>()
  for (const [k, statuses] of byDay) {
    const code = platformDayCode(statuses)
    if (code) out.set(k, code)
  }
  return out
}

export interface JgAttendanceCell { code: JgDayCode | null; source: 'jahbadh' | 'platform' | null }

export interface JgAttendanceRow {
  student: JgStudent
  /** Only the days of the requested stage (or month). */
  days: Record<string, JgAttendanceCell>
  /** Whole-year totals per stage, from every day (shown like the workbook's ع / غ / ت columns). */
  totals: Record<number, Record<JgDayCode, number>>
  unexcused_total: number
  alert: boolean
}

export interface JgDailyAttendance {
  calendar: JgAttendanceCalendar
  stage: number
  stages: JgStageDays[]
  days: string[]
  codes: readonly JgDayCode[]
  rows: JgAttendanceRow[]
  alert_count: number
  can_edit: boolean
}

function effective(stored: Map<string, string>, platform: Map<string, JgDayCode>, key: string): JgAttendanceCell {
  const s = stored.get(key)
  if (s === PRESENT) return { code: null, source: 'jahbadh' }
  if (s) return { code: s as JgDayCode, source: 'jahbadh' }
  const p = platform.get(key)
  return p ? { code: p, source: 'platform' } : { code: null, source: null }
}

async function compute(ctx: JgSectionContext) {
  const cal = await getCalendar(ctx.rootId, ctx.yearId)
  const stages = stageDays(cal, gradeStages(ctx), ctx.grade.rule.stage_names)
  const all = stages.flatMap((s) => s.days)
  const students = await sectionStudents(ctx.section.id)
  if (!all.length) return { cal, stages, students, stored: new Map<string, string>(), platform: new Map<string, JgDayCode>() }
  const from = all[0]
  const to = all[all.length - 1]
  const [storedRows, platform] = await Promise.all([loadStored(ctx, from, to), loadPlatform(students.map((s) => s.id), from, to)])
  const stored = new Map(storedRows.map((r) => [`${r.student_id}|${r.att_date}`, r.code]))
  return { cal, stages, students, stored, platform }
}

function totalsOf(studentId: string, stages: JgStageDays[], stored: Map<string, string>, platform: Map<string, JgDayCode>) {
  const totals: Record<number, Record<JgDayCode, number>> = {}
  for (const s of stages) {
    const t: Record<JgDayCode, number> = { 'غ': 0, 'ع': 0, 'ت': 0 }
    for (const d of s.days) {
      const c = effective(stored, platform, `${studentId}|${d}`).code
      if (c) t[c]++
    }
    totals[s.stage] = t
  }
  return totals
}

export async function getDailyAttendance(ctx: JgSectionContext, stage?: number, month?: string): Promise<JgDailyAttendance> {
  const { cal, stages, students, stored, platform } = await compute(ctx)
  const st = stage ?? stages.find((s) => s.days.length)?.stage ?? stages[0]?.stage ?? 1
  const sd = stages.find((s) => s.stage === st)
  if (!sd) throw new JgError(400, 'This stage does not exist in this grade')
  if (month !== undefined && !/^\d{4}-\d{2}$/.test(month)) throw new JgError(400, 'month must be YYYY-MM')
  const days = month ? sd.days.filter((d) => d.startsWith(month)) : sd.days

  const rows = students.map((student) => {
    const totals = totalsOf(student.id, stages, stored, platform)
    const unexcused = Object.values(totals).reduce((n, t) => n + t['غ'], 0)
    return {
      student,
      days: Object.fromEntries(days.map((d) => [d, effective(stored, platform, `${student.id}|${d}`)])),
      totals,
      unexcused_total: unexcused,
      alert: cal.alert_limit > 0 && unexcused >= cal.alert_limit,
    }
  })
  return {
    calendar: cal,
    stage: st,
    stages,
    days,
    codes: JG_DAY_CODES,
    rows,
    alert_count: rows.filter((r) => r.alert).length,
    can_edit: true,
  }
}

/**
 * Saves day codes. `code: null` marks the day present (also over a platform absence); `code: 'auto'`
 * removes the Jahbadh code so the platform's attendance applies again. Then writes every stage's
 * excused / unexcused totals into the report-card absence fields for the students changed.
 */
export async function saveDailyAttendance(
  ctx: JgSectionContext,
  entries: { student_id: string; date: string; code: JgDayCode | null | 'auto' }[],
  actor: JgActor,
): Promise<{ saved: number }> {
  if (!Array.isArray(entries) || !entries.length) throw new JgError(400, 'Nothing to save')
  if (entries.length > 5000) throw new JgError(400, 'At most 5000 cells per save')
  const { stages, students } = await compute(ctx)
  const enrolled = new Set(students.map((s) => s.id))
  const schoolDays = new Set(stages.flatMap((s) => s.days))
  const upserts: any[] = []
  const deletes: { student_id: string; date: string }[] = []
  const now = new Date().toISOString()
  for (const e of entries) {
    if (!enrolled.has(e.student_id)) throw new JgError(400, 'Student is not in this section')
    if (!isDate(e.date) || !schoolDays.has(e.date)) throw new JgError(400, `${e.date} is not a school day in the attendance calendar`, 'not_school_day')
    if (e.code === 'auto') { deletes.push({ student_id: e.student_id, date: e.date }); continue }
    if (e.code !== null && !JG_DAY_CODES.includes(e.code)) throw new JgError(400, 'Codes are غ (unexcused), ع (excused) or ت (late)')
    upserts.push({
      school_id: ctx.section.school_id, academic_year_id: ctx.yearId, section_id: ctx.section.id,
      student_id: e.student_id, att_date: e.date, code: e.code ?? PRESENT, updated_by: actor.profileId, updated_at: now,
    })
  }
  for (let i = 0; i < upserts.length; i += 500) {
    const { error } = await supabase.from('jg_daily_attendance').upsert(upserts.slice(i, i + 500), { onConflict: 'student_id,academic_year_id,att_date' })
    if (missingTable(error)) throw notMigrated()
    if (error) throw error
  }
  for (const d of deletes) {
    const { error } = await supabase.from('jg_daily_attendance').delete()
      .eq('student_id', d.student_id).eq('academic_year_id', ctx.yearId).eq('att_date', d.date)
    if (missingTable(error)) throw notMigrated()
    if (error) throw error
  }

  // Report-card absence = these totals (only the absence columns are written; levels and notes stay).
  const changed = [...new Set(entries.map((e) => e.student_id))]
  const after = await compute(ctx)
  const rows = changed.flatMap((sid) => {
    const totals = totalsOf(sid, after.stages, after.stored, after.platform)
    return after.stages.map((s) => ({
      school_id: ctx.section.school_id, academic_year_id: ctx.yearId, section_id: ctx.section.id, student_id: sid, stage: s.stage,
      excused_days: totals[s.stage]['ع'], unexcused_days: totals[s.stage]['غ'], updated_by: actor.profileId, updated_at: now,
    }))
  })
  if (rows.length) {
    const { error } = await supabase.from('jg_activity_records').upsert(rows, { onConflict: 'student_id,academic_year_id,stage' })
    if (error) throw error
  }
  await logJgAudit({
    schoolId: ctx.rootId, actorId: actor.profileId, actorRole: actor.role, action: 'attendance.daily', entity: 'jg_daily_attendance',
    sectionId: ctx.section.id, after: { cells: entries.length, students: changed.length },
  })
  return { saved: entries.length }
}
