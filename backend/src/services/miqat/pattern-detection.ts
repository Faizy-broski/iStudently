// Spec §8.3 — nightly pattern-detection flags. Pure functions only: no DB,
// no clock reads. The nightly job (miqat-nightly.job.ts) gathers the input
// arrays and persists whatever comes back as miqat_pattern_flags rows.

export interface DayRecord {
  date: string; // YYYY-MM-DD
  status: 'present' | 'late' | 'absent' | 'excused' | 'unclosed';
}

/** Same weekday absent 3+ times in a term — systematic avoidance (e.g. always "sick" on PE day). */
export function detectSameWeekdayAbsences(days: DayRecord[], threshold = 3): { weekday: number; count: number }[] {
  const counts = new Map<number, number>();
  for (const day of days) {
    if (day.status !== 'absent') continue;
    const weekday = new Date(`${day.date}T00:00:00Z`).getUTCDay();
    counts.set(weekday, (counts.get(weekday) ?? 0) + 1);
  }
  return [...counts.entries()].filter(([, count]) => count >= threshold).map(([weekday, count]) => ({ weekday, count }));
}

export interface PeriodAttendanceRecord {
  date: string;
  gatePresent: boolean;
  periodsAbsent: number;
}

/** Present at the gate but absent from one or more periods — a high-value signal (class-skipping), surfaced prominently per spec. */
export function detectGatePresentButPeriodAbsent(records: PeriodAttendanceRecord[]): string[] {
  return records.filter((r) => r.gatePresent && r.periodsAbsent > 0).map((r) => r.date);
}

export interface GateEventPair {
  date: string;
  checkInMinutes: number; // minutes since local midnight
  checkOutMinutes: number;
}

/** Chronic check-out shortly after check-in — flagged if it recurs, not on a single occurrence (spec §8.3). */
export function detectChronicEarlyCheckout(pairs: GateEventPair[], thresholdMinutes = 30, minOccurrences = 3): string[] {
  const shortDays = pairs.filter((p) => p.checkOutMinutes - p.checkInMinutes < thresholdMinutes && p.checkOutMinutes >= p.checkInMinutes);
  return shortDays.length >= minOccurrences ? shortDays.map((d) => d.date) : [];
}

export interface TeacherScanRecord {
  date: string;
  periodId: string;
  scanned: boolean;
}

/** A teacher repeatedly not scanning class attendance for their own period(s). */
export function detectTeacherNotScanning(records: TeacherScanRecord[], minOccurrences = 3): { periodId: string; missedDates: string[] }[] {
  const missedByPeriod = new Map<string, string[]>();
  for (const r of records) {
    if (r.scanned) continue;
    if (!missedByPeriod.has(r.periodId)) missedByPeriod.set(r.periodId, []);
    missedByPeriod.get(r.periodId)!.push(r.date);
  }
  return [...missedByPeriod.entries()]
    .filter(([, dates]) => dates.length >= minOccurrences)
    .map(([periodId, missedDates]) => ({ periodId, missedDates }));
}
