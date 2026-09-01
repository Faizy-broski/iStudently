// ============================================================================
// Per-school local time helpers, built on the native Intl API (no new
// timezone library dependency) — used by any Hifzi cron-style job that must
// act at a particular local time-of-day for each school individually
// (schools.timezone, added in 261_add_schools_timezone.sql). See
// backend/src/services/hifzi/attendance-alert.service.ts and
// backend/src/services/hifzi/plans.service.ts's nightly assignment trigger.
// ============================================================================

const WEEKDAY_MAP: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 }

export interface LocalDayTime {
  dayOfWeek: number // 0=Monday..6=Sunday, matching this codebase's DayOfWeek convention
  date: string // YYYY-MM-DD
  time: string // HH:mm, 24-hour
}

export function getLocalDayAndTime(timeZone: string, now: Date): LocalDayTime {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''

  return {
    dayOfWeek: WEEKDAY_MAP[get('weekday')] ?? 0,
    date: `${get('year')}-${get('month')}-${get('day')}`,
    time: `${get('hour')}:${get('minute')}`,
  }
}

/** Subtracts `minutes` from an HH:mm time string, wrapping across midnight. */
export function minutesBefore(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number)
  const total = h * 60 + m - minutes
  const wrapped = ((total % 1440) + 1440) % 1440
  return `${String(Math.floor(wrapped / 60)).padStart(2, '0')}:${String(wrapped % 60).padStart(2, '0')}`
}

/** True if a school's local time-of-day currently falls within [00:00, windowMinutes) — i.e. "it just turned local midnight". */
export function isLocalMidnightWindow(timeZone: string, now: Date, windowMinutes: number): boolean {
  const { time } = getLocalDayAndTime(timeZone, now)
  const [h, m] = time.split(':').map(Number)
  return h === 0 && m < windowMinutes
}
