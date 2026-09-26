import {
  buildMonthColumns,
  classifyCode,
  computeTotals,
  countWorkingDays,
  daysInMonth,
  miqatDayToStatusInput,
  resolveStatus,
  STATUS_CODES,
  STATUS_LEGEND,
} from './sheet-model'

describe('daysInMonth', () => {
  it.each([
    [2026, 2, 28],
    [2028, 2, 29],
    [2100, 2, 28],
    [2026, 4, 30],
    [2026, 12, 31],
  ])('%i-%i has %i days', (y, m, n) => {
    expect(daysInMonth(y, m)).toBe(n)
  })
})

describe('buildMonthColumns', () => {
  it('renders one column per day with names and numbers (Mon-Fri default)', () => {
    const cols = buildMonthColumns(2026, 9)
    expect(cols).toHaveLength(30)
    expect(cols[0]).toMatchObject({ date: '2026-09-01', day: 1, dayName: 'Tue', isNonWorking: false })
    expect(cols[4]).toMatchObject({ date: '2026-09-05', dayName: 'Sat', isNonWorking: true, nonWorkingReason: 'weekend' })
    expect(countWorkingDays(cols)).toBe(22)
  })

  it('uses Arabic day names', () => {
    expect(buildMonthColumns(2026, 9, { locale: 'ar' })[0].dayName).toBe('الثلاثاء')
  })

  it('honours custom weekdays (Sun-Thu school week)', () => {
    const weekdays = [true, true, true, true, true, false, false]
    const cols = buildMonthColumns(2026, 9, { weekdays })
    expect(cols.find((c) => c.date === '2026-09-04')?.isNonWorking).toBe(true) // Friday
    expect(cols.find((c) => c.date === '2026-09-06')?.isNonWorking).toBe(false) // Sunday
  })

  it('ignores a malformed weekdays array', () => {
    expect(buildMonthColumns(2026, 9, { weekdays: [true] })[4].isNonWorking).toBe(true) // Saturday, default week
  })

  it('lets explicit calendar rows override weekdays', () => {
    const calendarDays = new Map([
      ['2026-09-01', false], // a weekday marked as non-school
      ['2026-09-05', true], // a Saturday marked as school day
    ])
    const cols = buildMonthColumns(2026, 9, { calendarDays })
    expect(cols[0]).toMatchObject({ isNonWorking: true, nonWorkingReason: 'holiday' })
    expect(cols[4]).toMatchObject({ isNonWorking: false, nonWorkingReason: null })
  })

  it('labels a calendar-closed weekend day as weekend', () => {
    const calendarDays = new Map([['2026-09-05', false]])
    expect(buildMonthColumns(2026, 9, { calendarDays })[4].nonWorkingReason).toBe('weekend')
  })

  it('always treats holidays as non-working', () => {
    const cols = buildMonthColumns(2026, 9, { holidays: new Set(['2026-09-02']), calendarDays: new Map([['2026-09-02', true]]) })
    expect(cols[1]).toMatchObject({ isNonWorking: true, nonWorkingReason: 'holiday' })
  })
})

describe('classifyCode', () => {
  it('returns all false for a missing code', () => {
    expect(classifyCode(null)).toEqual({ isExcused: false, isLate: false, isHalfDay: false })
    expect(classifyCode(undefined).isLate).toBe(false)
  })
  it('recognises excused by short name and by title', () => {
    expect(classifyCode({ short_name: 'e' }).isExcused).toBe(true)
    expect(classifyCode({ short_name: 'EA' }).isExcused).toBe(true)
    expect(classifyCode({ short_name: 'X', title: 'Excused Absence' }).isExcused).toBe(true)
  })
  it('recognises late/tardy', () => {
    expect(classifyCode({ short_name: 'L' }).isLate).toBe(true)
    expect(classifyCode({ short_name: 'T' }).isLate).toBe(true)
    expect(classifyCode({ short_name: 'X', title: 'Tardy' }).isLate).toBe(true)
  })
  it('recognises half day by state, short name and title', () => {
    expect(classifyCode({ state_code: 'H' }).isHalfDay).toBe(true)
    expect(classifyCode({ short_name: 'HD' }).isHalfDay).toBe(true)
    expect(classifyCode({ short_name: 'H' }).isHalfDay).toBe(true)
    expect(classifyCode({ title: 'Half Day' }).isHalfDay).toBe(true)
  })
  it('handles a code with no fields', () => {
    expect(classifyCode({})).toEqual({ isExcused: false, isLate: false, isHalfDay: false })
  })
})

describe('resolveStatus', () => {
  const base = { isNonWorking: false, stateValue: null as number | null }
  it('is blank on non-working days even with data', () => {
    expect(resolveStatus({ ...base, isNonWorking: true, stateValue: 1 })).toBe('')
  })
  it('is blank when nothing is recorded', () => {
    expect(resolveStatus(base)).toBe('')
  })
  it('maps present and absent from state value', () => {
    expect(resolveStatus({ ...base, stateValue: 1 })).toBe('P')
    expect(resolveStatus({ ...base, stateValue: 0 })).toBe('A')
  })
  it('maps half day from state value or flag', () => {
    expect(resolveStatus({ ...base, stateValue: 0.5 })).toBe('HD')
    expect(resolveStatus({ ...base, stateValue: 1, isHalfDay: true })).toBe('HD')
  })
  it('maps late even without a daily row', () => {
    expect(resolveStatus({ ...base, isLate: true })).toBe('L')
    expect(resolveStatus({ ...base, stateValue: 1, isLate: true })).toBe('L')
  })
  it('EA beats everything (excused flag or approved absence)', () => {
    expect(resolveStatus({ ...base, stateValue: 0, isExcused: true })).toBe('EA')
    expect(resolveStatus({ ...base, stateValue: 1, isLate: true, hasApprovedAbsence: true })).toBe('EA')
  })
  it('HD beats L, L beats P', () => {
    expect(resolveStatus({ ...base, stateValue: 1, isHalfDay: true, isLate: true })).toBe('HD')
    expect(resolveStatus({ ...base, stateValue: 1, isLate: true })).toBe('L')
  })
})

describe('miqatDayToStatusInput', () => {
  it('maps each miqat status', () => {
    expect(miqatDayToStatusInput({ status: 'excused' })).toEqual({ stateValue: 0, isExcused: true })
    expect(miqatDayToStatusInput({ status: 'absent' })).toEqual({ stateValue: 0 })
    expect(miqatDayToStatusInput({ status: 'late' })).toEqual({ stateValue: 1, isLate: true })
    expect(miqatDayToStatusInput({ status: 'present' })).toEqual({ stateValue: 1 })
    expect(miqatDayToStatusInput({ status: 'unclosed' })).toEqual({ stateValue: 1 })
  })
  it('a partial permission makes it a half day', () => {
    expect(miqatDayToStatusInput({ status: 'present', partialPermission: true })).toEqual({ stateValue: 1, isHalfDay: true })
  })
})

describe('computeTotals', () => {
  it('counts each code and computes the rate against working days', () => {
    const t = computeTotals(['P', 'P', 'P', 'A', 'EA', 'L', 'HD', ''], 8)
    expect(t).toEqual({
      totalPresent: 3,
      totalAbsentUnexcused: 1,
      totalAbsentExcused: 1,
      totalTardy: 1,
      totalHalfDay: 1,
      attendanceRate: 37.5,
    })
  })
  it('returns a 0 rate when there are no working days', () => {
    expect(computeTotals([], 0).attendanceRate).toBe(0)
  })
  it('rounds to one decimal', () => {
    expect(computeTotals(['P'], 3).attendanceRate).toBe(33.3)
  })
})

describe('legend', () => {
  it('defines every status code with EN and AR labels', () => {
    expect(STATUS_LEGEND.map((l) => l.code)).toEqual(STATUS_CODES)
    STATUS_LEGEND.forEach((l) => {
      expect(l.en).toBeTruthy()
      expect(l.ar).toBeTruthy()
    })
  })
})
