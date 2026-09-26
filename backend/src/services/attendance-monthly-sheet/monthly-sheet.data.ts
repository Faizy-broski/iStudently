// Loads everything the monthly attendance sheet needs from the database and
// turns it into a MonthlySheetModel using the pure functions in ./sheet-model.
// Queries are batched per sheet (roster, calendar, daily rows, coded records) —
// never per student or per day.

import { supabase } from '../../config/supabase'
import { getMainSchoolId } from '../../utils/campus.util'
import { getCurrentAcademicYear } from '../academics.service'
import {
  buildMonthColumns,
  classifyCode,
  computeTotals,
  countWorkingDays,
  miqatDayToStatusInput,
  resolveStatus,
  STATUS_LEGEND,
  type CellStatus,
  type MonthColumn,
  type MonthlySheetModel,
  type SheetRow,
} from './sheet-model'

export interface MonthlySheetRequest {
  scope: 'section' | 'grade' | 'staff'
  /** Effective campus/school id (students.school_id, staff.school_id). */
  schoolId: string
  campusId?: string
  sectionId?: string
  gradeId?: string
  /** Staff scope: a single department; omit for one sheet per department. */
  department?: string
  year: number
  /** 1-12 */
  month: number
  mode: 'blank' | 'filled'
  locale: 'en' | 'ar'
  supervisor?: string
  room?: string
}

const pad = (n: number): string => String(n).padStart(2, '0')

/** Supabase caps a response at 1000 rows — page through larger result sets. */
async function fetchAll<T = any>(build: (from: number, to: number) => PromiseLike<{ data: any; error: any }>): Promise<T[]> {
  const out: T[] = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    const rows = (data || []) as T[]
    out.push(...rows)
    if (rows.length < PAGE) break
  }
  return out
}

const fullName = (p: any): string =>
  [p?.first_name, p?.father_name, p?.last_name].filter(Boolean).join(' ').trim() || '—'

const unwrap = <T>(v: T | T[] | null | undefined): T | undefined => (Array.isArray(v) ? v[0] : v ?? undefined)

interface CalendarContext {
  columns: MonthColumn[]
  workingDays: number
}

async function loadCalendar(req: MonthlySheetRequest, mainSchoolId: string): Promise<CalendarContext> {
  const start = `${req.year}-${pad(req.month)}-01`
  const lastDay = new Date(Date.UTC(req.year, req.month, 0)).getUTCDate()
  const end = `${req.year}-${pad(req.month)}-${pad(lastDay)}`
  const ids = Array.from(new Set([mainSchoolId, req.schoolId]))
  const campusFilter = req.campusId ? `campus_id.eq.${req.campusId},campus_id.is.null` : null

  let calQ = supabase
    .from('attendance_calendar')
    .select('school_date, is_school_day, campus_id')
    .in('school_id', ids)
    .gte('school_date', start)
    .lte('school_date', end)
  if (campusFilter) calQ = calQ.or(campusFilter)

  let calsQ = supabase
    .from('attendance_calendars')
    .select('weekdays, campus_id, is_default')
    .in('school_id', ids)
    .eq('is_default', true)
    .eq('calendar_type', 'gregorian')

  const [calRes, calsRes, eventsRes] = await Promise.all([
    calQ,
    calsQ,
    supabase
      .from('school_events')
      .select('start_at, end_at, campus_id')
      .eq('school_id', mainSchoolId)
      .eq('category', 'holiday')
      .lte('start_at', `${end}T23:59:59Z`)
      .gte('end_at', `${start}T00:00:00Z`),
  ])
  if (calRes.error) throw new Error(calRes.error.message)

  // Campus-specific rows win over school-wide ones: apply school-wide first.
  const calendarDays = new Map<string, boolean>()
  const rows = [...(calRes.data || [])].sort((a: any, b: any) => Number(!!a.campus_id) - Number(!!b.campus_id))
  for (const r of rows as any[]) calendarDays.set(r.school_date, !!r.is_school_day)

  const cals = (calsRes.data || []) as any[]
  const chosen = cals.find((c) => req.campusId && c.campus_id === req.campusId) || cals.find((c) => !c.campus_id) || cals[0]
  const weekdays = Array.isArray(chosen?.weekdays) && chosen.weekdays.length === 7 ? (chosen.weekdays as boolean[]) : undefined

  const holidays = new Set<string>()
  for (const ev of (eventsRes.data || []) as any[]) {
    if (ev.campus_id && req.campusId && ev.campus_id !== req.campusId) continue
    const from = new Date(String(ev.start_at).slice(0, 10) + 'T00:00:00Z')
    const to = new Date(String(ev.end_at).slice(0, 10) + 'T00:00:00Z')
    for (let d = from; d <= to; d = new Date(d.getTime() + 86400000)) {
      const iso = d.toISOString().slice(0, 10)
      if (iso >= start && iso <= end) holidays.add(iso)
    }
  }

  const columns = buildMonthColumns(req.year, req.month, { calendarDays, weekdays, holidays, locale: req.locale })
  return { columns, workingDays: countWorkingDays(columns) }
}

async function loadBranding(schoolId: string, mainSchoolId: string) {
  const ids = Array.from(new Set([schoolId, mainSchoolId]))
  const { data } = await supabase.from('schools').select('id, name, logo_url, address').in('id', ids)
  const rows = (data || []) as any[]
  const own = rows.find((r) => r.id === schoolId)
  const main = rows.find((r) => r.id === mainSchoolId)
  return {
    schoolName: own?.name || main?.name || '',
    // A campus without its own logo inherits the parent school's logo.
    logoUrl: (own?.logo_url || main?.logo_url || null) as string | null,
    address: own?.address || main?.address || '',
  }
}

function monthLabel(req: MonthlySheetRequest): string {
  const locale = req.locale === 'ar' ? 'ar-u-nu-latn' : 'en-GB'
  return new Date(Date.UTC(req.year, req.month - 1, 1)).toLocaleDateString(locale, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

async function pickTeacherAndRoom(sectionId: string): Promise<{ teacher: string; room: string }> {
  const { data } = await supabase
    .from('course_periods')
    .select('teacher_id, room')
    .eq('section_id', sectionId)
    .eq('is_active', true)
  let rows = (data || []) as any[]
  // Schools that assign teachers through the timetable (not course periods) —
  // including single-class grades that use a default section — have their
  // teacher and room on timetable_entries instead.
  if (rows.length === 0) {
    const { data: entries } = await supabase
      .from('timetable_entries')
      .select('teacher_id, room_number')
      .eq('section_id', sectionId)
      .eq('is_active', true)
    rows = ((entries || []) as any[]).map((e) => ({ teacher_id: e.teacher_id, room: e.room_number }))
  }
  const mostCommon =(vals: (string | null | undefined)[]): string => {
    const counts = new Map<string, number>()
    for (const v of vals) if (v) counts.set(v, (counts.get(v) || 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || ''
  }
  const teacherId = mostCommon(rows.map((r) => r.teacher_id))
  const room = mostCommon(rows.map((r) => (r.room ? String(r.room).trim() : '')))
  let teacher = ''
  if (teacherId) {
    const { data: staff } = await supabase
      .from('staff')
      .select('profile:profiles!staff_profile_id_fkey(first_name, last_name)')
      .eq('id', teacherId)
      .maybeSingle()
    teacher = fullName(unwrap((staff as any)?.profile))
    if (teacher === '—') teacher = ''
  }
  return { teacher, room }
}

function toRow(id: string, number: string, name: string, cells: CellStatus[], workingDays: number): SheetRow {
  return { id, number, name, cells, totals: computeTotals(cells, workingDays) }
}

// ── Students ───────────────────────────────────────────────────────────────

async function buildSectionModel(
  req: MonthlySheetRequest,
  // id === null -> students of the grade who have no section assigned
  section: { id: string | null; name: string; gradeName: string; gradeId?: string },
  cal: CalendarContext,
  base: Omit<MonthlySheetModel['header'], 'groupLabel' | 'room' | 'supervisor'>
): Promise<MonthlySheetModel> {
  let studentsQuery = supabase
    .from('students')
    .select('id, student_number, profile:profiles!inner(first_name, father_name, last_name, is_active)')
    .eq('school_id', req.schoolId)
  studentsQuery = section.id
    ? studentsQuery.eq('section_id', section.id)
    : studentsQuery.eq('grade_level_id', section.gradeId as string).is('section_id', null)
  const { data: students, error } = await studentsQuery
  if (error) throw new Error(error.message)

  const roster = ((students || []) as any[])
    .filter((s) => unwrap(s.profile)?.is_active !== false)
    .map((s) => ({ id: s.id as string, number: s.student_number || '', name: fullName(unwrap(s.profile)) }))
    .sort((a, b) => a.name.localeCompare(b.name, req.locale === 'ar' ? 'ar' : 'en', { sensitivity: 'base' }))

  const dailyByKey = new Map<string, number>()
  const flagsByKey = new Map<string, { excused: boolean; late: boolean }>()

  if (req.mode === 'filled' && roster.length > 0) {
    const ids = roster.map((r) => r.id)
    const start = cal.columns[0].date
    const end = cal.columns[cal.columns.length - 1].date

    const [daily, records] = await Promise.all([
      fetchAll((from, to) =>
        supabase
          .from('attendance_daily')
          .select('student_id, attendance_date, state_value')
          .in('student_id', ids)
          .gte('attendance_date', start)
          .lte('attendance_date', end)
          .range(from, to)
      ),
      fetchAll((from, to) =>
        supabase
          .from('attendance_records')
          .select('student_id, attendance_date, status, attendance_codes(short_name, title, state_code)')
          .in('student_id', ids)
          .gte('attendance_date', start)
          .lte('attendance_date', end)
          .range(from, to)
      ),
    ])

    for (const d of daily as any[]) dailyByKey.set(`${d.student_id}:${d.attendance_date}`, Number(d.state_value))
    for (const r of records as any[]) {
      const key = `${r.student_id}:${r.attendance_date}`
      const flags = classifyCode(unwrap(r.attendance_codes))
      const cur = flagsByKey.get(key) || { excused: false, late: false }
      cur.excused = cur.excused || flags.isExcused || r.status === 'excused'
      cur.late = cur.late || flags.isLate || r.status === 'late'
      flagsByKey.set(key, cur)
    }
  }

  const rows = roster.map((s) => {
    const cells: CellStatus[] = cal.columns.map((col) => {
      if (req.mode === 'blank') return ''
      const key = `${s.id}:${col.date}`
      const state = dailyByKey.has(key) ? dailyByKey.get(key)! : null
      const flags = flagsByKey.get(key)
      return resolveStatus({
        isNonWorking: col.isNonWorking,
        stateValue: state,
        // An excused code only turns a day into EA when the day is an absence;
        // a late code only matters when the student attended.
        isExcused: !!flags?.excused && (state === 0 || state === null),
        isLate: !!flags?.late && (state === null || state > 0),
      })
    })
    return toRow(s.id, s.number, s.name, cells, cal.workingDays)
  })

  const meta = section.id ? await pickTeacherAndRoom(section.id) : { teacher: '', room: '' }
  return {
    header: {
      ...base,
      groupLabel: [section.gradeName, section.name].filter(Boolean).join(' / '),
      room: req.room?.trim() || meta.room,
      supervisor: req.supervisor?.trim() || meta.teacher,
    },
    columns: cal.columns,
    workingDays: cal.workingDays,
    rows,
    legend: STATUS_LEGEND,
    locale: req.locale,
    mode: req.mode,
  }
}

// ── Staff ──────────────────────────────────────────────────────────────────

async function buildStaffModels(
  req: MonthlySheetRequest,
  cal: CalendarContext,
  base: Omit<MonthlySheetModel['header'], 'groupLabel' | 'room' | 'supervisor'>
): Promise<MonthlySheetModel[]> {
  const { data, error } = await supabase
    .from('staff')
    .select('id, employee_number, department, is_active, profile_id, profile:profiles!staff_profile_id_fkey(first_name, father_name, last_name)')
    .eq('school_id', req.schoolId)
    .neq('is_active', false)
  if (error) throw new Error(error.message)

  const norm = (s: string | null | undefined): string => (s || '').trim().toLowerCase()
  const wanted = req.department ? norm(req.department) : null
  const groups = new Map<string, { label: string; staff: any[] }>()
  for (const s of (data || []) as any[]) {
    const key = norm(s.department) || 'general'
    if (wanted && key !== wanted) continue
    if (!groups.has(key)) groups.set(key, { label: (s.department || '').trim() || 'General', staff: [] })
    groups.get(key)!.staff.push(s)
  }

  const start = cal.columns[0].date
  const end = cal.columns[cal.columns.length - 1].date
  const miqat = new Map<string, any>()
  const absentDates = new Map<string, Set<string>>()
  const partialDates = new Map<string, Set<string>>()

  if (req.mode === 'filled' && groups.size > 0) {
    const profileIds = [...groups.values()].flatMap((g) => g.staff.map((s) => s.profile_id)).filter(Boolean) as string[]
    const [days, absences, permissions] = await Promise.all([
      fetchAll((from, to) =>
        supabase.from('miqat_days').select('person_id, date, status').in('person_id', profileIds).gte('date', start).lte('date', end).range(from, to)
      ),
      supabase
        .from('staff_absences')
        .select('staff_id, start_date, end_date')
        .in('staff_id', profileIds)
        .eq('status', 'approved')
        .lte('start_date', `${end}T23:59:59Z`)
        .gte('end_date', `${start}T00:00:00Z`),
      supabase
        .from('miqat_permissions')
        .select('person_id, type, date_from, date_to')
        .in('person_id', profileIds)
        .eq('status', 'approved')
        .lte('date_from', end)
        .gte('date_to', start),
    ])
    for (const d of days as any[]) miqat.set(`${d.person_id}:${d.date}`, d)

    const addRange = (map: Map<string, Set<string>>, who: string, from: string, to: string) => {
      const set = map.get(who) || new Set<string>()
      for (let d = new Date(from.slice(0, 10) + 'T00:00:00Z'); d <= new Date(to.slice(0, 10) + 'T00:00:00Z'); d = new Date(d.getTime() + 86400000)) {
        set.add(d.toISOString().slice(0, 10))
      }
      map.set(who, set)
    }
    for (const a of (absences.data || []) as any[]) addRange(absentDates, a.staff_id, a.start_date, a.end_date)
    for (const p of (permissions.data || []) as any[]) {
      addRange(p.type === 'full_day' ? absentDates : partialDates, p.person_id, p.date_from, p.date_to)
    }
  }

  const models: MonthlySheetModel[] = []
  for (const g of [...groups.values()].sort((a, b) => a.label.localeCompare(b.label))) {
    const rows = g.staff
      .map((s) => ({ s, name: fullName(unwrap(s.profile)) }))
      .sort((a, b) => a.name.localeCompare(b.name, req.locale === 'ar' ? 'ar' : 'en', { sensitivity: 'base' }))
      .map(({ s, name }) => {
        const cells: CellStatus[] = cal.columns.map((col) => {
          if (req.mode === 'blank') return ''
          const row = miqat.get(`${s.profile_id}:${col.date}`)
          const partial = !!partialDates.get(s.profile_id)?.has(col.date)
          const approvedAbsence = !!absentDates.get(s.profile_id)?.has(col.date)
          if (!row) return resolveStatus({ isNonWorking: col.isNonWorking, stateValue: null, hasApprovedAbsence: approvedAbsence })
          return resolveStatus({
            isNonWorking: col.isNonWorking,
            hasApprovedAbsence: approvedAbsence,
            ...miqatDayToStatusInput({ status: row.status, partialPermission: partial }),
          })
        })
        return toRow(s.id, s.employee_number || '', name, cells, cal.workingDays)
      })
    models.push({
      header: { ...base, groupLabel: g.label, room: req.room?.trim() || '', supervisor: req.supervisor?.trim() || '' },
      columns: cal.columns,
      workingDays: cal.workingDays,
      rows,
      legend: STATUS_LEGEND,
      locale: req.locale,
      mode: req.mode,
    })
  }
  return models
}

// ── Entry point ────────────────────────────────────────────────────────────

/** Builds one model per section (students) or per department (staff). */
export async function buildMonthlySheets(req: MonthlySheetRequest): Promise<MonthlySheetModel[]> {
  const mainSchoolId = await getMainSchoolId(req.schoolId)
  const [cal, branding, year] = await Promise.all([
    loadCalendar(req, mainSchoolId),
    loadBranding(req.schoolId, mainSchoolId),
    getCurrentAcademicYear(req.schoolId).catch(() => null),
  ])

  const base = {
    logoUrl: branding.logoUrl,
    schoolName: branding.schoolName,
    address: branding.address,
    title: req.locale === 'ar' ? 'كشف الحضور الشهري' : 'Monthly Attendance Sheet',
    academicYear: (year as any)?.data?.name || '',
    monthLabel: monthLabel(req),
  }

  if (req.scope === 'staff') return buildStaffModels(req, cal, base)

  let sectionRows: any[] = []
  if (req.scope === 'section') {
    if (!req.sectionId) throw new Error('section_id is required')
    const { data } = await supabase.from('sections').select('id, name, grade_levels(name)').eq('id', req.sectionId)
    sectionRows = data || []
  } else {
    if (!req.gradeId) throw new Error('grade_id is required')
    const { data } = await supabase
      .from('sections')
      .select('id, name, grade_levels(name)')
      .eq('grade_level_id', req.gradeId)
      .eq('is_active', true)
      .order('name', { ascending: true })
    sectionRows = data || []
  }

  const sections: { id: string | null; name: string; gradeName: string; gradeId?: string }[] = sectionRows.map((s) => ({
    id: s.id as string,
    name: s.name as string,
    gradeName: unwrap(s.grade_levels)?.name || '',
  }))

  // Grades without sections (or students not yet placed in one): include the
  // grade's unassigned students as their own sheet so a whole-grade export
  // always works, even for grades that have no sections defined.
  if (req.scope === 'grade') {
    const { data: grade } = await supabase.from('grade_levels').select('name').eq('id', req.gradeId as string).maybeSingle()
    const gradeName = (grade as any)?.name || ''
    const { count } = await supabase
      .from('students')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', req.schoolId)
      .eq('grade_level_id', req.gradeId as string)
      .is('section_id', null)
    if ((count || 0) > 0 || sections.length === 0) {
      sections.push({ id: null, name: '', gradeName, gradeId: req.gradeId })
    }
  }
  if (sections.length === 0) throw new Error('No sections found for the selected filters')
  return Promise.all(sections.map((s) => buildSectionModel(req, s, cal, base)))
}
