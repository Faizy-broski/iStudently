// Pure model for the monthly attendance sheet — no DB, no I/O. Everything that
// decides *what the sheet says* (which days exist, which are non-working, what
// code a day maps to, the totals and attendance rate) lives here so the Excel
// and PDF renderers can never disagree and the logic is exhaustively testable.

export type StatusCode = 'P' | 'A' | 'EA' | 'L' | 'HD'
export type CellStatus = StatusCode | ''

export const STATUS_CODES: StatusCode[] = ['P', 'A', 'EA', 'L', 'HD']

export const STATUS_LEGEND: { code: StatusCode; en: string; ar: string }[] = [
  { code: 'P', en: 'Present', ar: 'حاضر' },
  { code: 'A', en: 'Unexcused Absence', ar: 'غائب' },
  { code: 'EA', en: 'Excused Absence', ar: 'غياب بعذر' },
  { code: 'L', en: 'Late / Tardy', ar: 'متأخر' },
  { code: 'HD', en: 'Half-Day / Early Dismissal', ar: 'خروج مبكر' },
]

export const DAY_NAMES_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const DAY_NAMES_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']

export interface MonthColumn {
  /** YYYY-MM-DD */
  date: string
  day: number
  /** 0 = Sunday */
  dow: number
  dayName: string
  isNonWorking: boolean
  nonWorkingReason: 'weekend' | 'holiday' | null
}

export interface BuildColumnsOptions {
  /** date -> is_school_day, from attendance_calendar rows that exist for the month */
  calendarDays?: Map<string, boolean>
  /** Fallback when a date has no calendar row: weekdays[0] = Sunday. Defaults to Mon-Fri. */
  weekdays?: boolean[]
  /** Dates flagged as holidays (school events) — always non-working. */
  holidays?: Set<string>
  locale?: 'en' | 'ar'
}

const DEFAULT_WEEKDAYS = [false, true, true, true, true, true, false]

const pad = (n: number): string => String(n).padStart(2, '0')

/** Number of days in a month (month is 1-12). Handles leap years. */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/** Builds one column per calendar day of the month (28-31), shaded when non-working. */
export function buildMonthColumns(year: number, month: number, opts: BuildColumnsOptions = {}): MonthColumn[] {
  const { calendarDays, holidays, locale = 'en' } = opts
  const weekdays = opts.weekdays && opts.weekdays.length === 7 ? opts.weekdays : DEFAULT_WEEKDAYS
  const names = locale === 'ar' ? DAY_NAMES_AR : DAY_NAMES_EN

  const columns: MonthColumn[] = []
  for (let day = 1; day <= daysInMonth(year, month); day++) {
    const date = `${year}-${pad(month)}-${pad(day)}`
    const dow = new Date(Date.UTC(year, month - 1, day)).getUTCDay()

    let isNonWorking: boolean
    let reason: MonthColumn['nonWorkingReason'] = null
    if (holidays?.has(date)) {
      isNonWorking = true
      reason = 'holiday'
    } else if (calendarDays?.has(date)) {
      isNonWorking = !calendarDays.get(date)
      reason = isNonWorking ? (weekdays[dow] ? 'holiday' : 'weekend') : null
    } else {
      isNonWorking = !weekdays[dow]
      reason = isNonWorking ? 'weekend' : null
    }
    columns.push({ date, day, dow, dayName: names[dow], isNonWorking, nonWorkingReason: reason })
  }
  return columns
}

export interface CodeFlags {
  isExcused: boolean
  isLate: boolean
  isHalfDay: boolean
}

/**
 * Interprets a school's own attendance code. Codes differ per school (the
 * migration seeds P,A,L,E,H; the runtime auto-seed creates P,A,E,T), so this
 * goes by state_code + short_name/title rather than assuming letters.
 */
export function classifyCode(code: { short_name?: string | null; title?: string | null; state_code?: string | null } | null | undefined): CodeFlags {
  if (!code) return { isExcused: false, isLate: false, isHalfDay: false }
  const short = (code.short_name || '').trim().toUpperCase()
  const title = (code.title || '').toLowerCase()
  return {
    isExcused: short === 'E' || short === 'EA' || /excus/.test(title),
    isLate: short === 'L' || short === 'T' || /late|tard/.test(title),
    isHalfDay: code.state_code === 'H' || short === 'H' || short === 'HD' || /half/.test(title),
  }
}

export interface StatusInput {
  isNonWorking: boolean
  /** attendance_daily.state_value: 1 present, 0.5 half day, 0 absent; null = no record */
  stateValue: number | null
  isExcused?: boolean
  isLate?: boolean
  isHalfDay?: boolean
  /** An approved leave/absence covers this date. */
  hasApprovedAbsence?: boolean
}

/**
 * Maps one person-day to a sheet code. Priority: EA > HD > L > P > A.
 * Non-working days and days with no recorded information stay blank (a blank
 * cell in a filled sheet means "attendance not taken").
 */
export function resolveStatus(input: StatusInput): CellStatus {
  if (input.isNonWorking) return ''
  if (input.isExcused || input.hasApprovedAbsence) return 'EA'
  if (input.isHalfDay || input.stateValue === 0.5) return 'HD'
  if (input.isLate) return 'L'
  if (input.stateValue === null) return ''
  return input.stateValue > 0 ? 'P' : 'A'
}

export interface MiqatDayInput {
  status: 'present' | 'late' | 'absent' | 'excused' | 'unclosed'
  /** An approved early_departure / late_arrival permission covers the day. */
  partialPermission?: boolean
}

/** Translates a miqat_days row (staff) into StatusInput fields. */
export function miqatDayToStatusInput(day: MiqatDayInput): Pick<StatusInput, 'stateValue' | 'isExcused' | 'isLate' | 'isHalfDay'> {
  if (day.status === 'excused') return { stateValue: 0, isExcused: true }
  if (day.status === 'absent') return { stateValue: 0 }
  if (day.partialPermission) return { stateValue: 1, isHalfDay: true }
  if (day.status === 'late') return { stateValue: 1, isLate: true }
  return { stateValue: 1 }
}

export interface Totals {
  totalPresent: number
  totalAbsentUnexcused: number
  totalAbsentExcused: number
  totalTardy: number
  totalHalfDay: number
  /** Present / working days x 100, one decimal. */
  attendanceRate: number
}

export function computeTotals(cells: CellStatus[], workingDays: number): Totals {
  const count = (c: StatusCode): number => cells.filter((x) => x === c).length
  const totalPresent = count('P')
  return {
    totalPresent,
    totalAbsentUnexcused: count('A'),
    totalAbsentExcused: count('EA'),
    totalTardy: count('L'),
    totalHalfDay: count('HD'),
    attendanceRate: workingDays > 0 ? Math.round((totalPresent / workingDays) * 1000) / 10 : 0,
  }
}

export interface SheetRow {
  id: string
  /** Student number / employee number */
  number: string
  name: string
  cells: CellStatus[]
  totals: Totals
}

export interface SheetHeader {
  logoUrl: string | null
  schoolName: string
  address: string
  title: string
  academicYear: string
  monthLabel: string
  /** "Grade 5 / Section A" or the department name */
  groupLabel: string
  room: string
  supervisor: string
}

export interface MonthlySheetModel {
  header: SheetHeader
  columns: MonthColumn[]
  workingDays: number
  rows: SheetRow[]
  legend: typeof STATUS_LEGEND
  locale: 'en' | 'ar'
  mode: 'blank' | 'filled'
}

/** Counts the school days (non-shaded columns) in a month. */
export function countWorkingDays(columns: MonthColumn[]): number {
  return columns.filter((c) => !c.isNonWorking).length
}
