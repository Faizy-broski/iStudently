// School-offset date arithmetic. "Today" for this module is never the
// device's local date (a server has one timezone, students and staff have
// many) — it's computed from a fixed UTC offset in minutes, applied to the
// server's current instant. Per-school configurability is a known
// simplification, flagged in the plan rather than silently assumed correct.

import { IsoDate } from './types';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** "Today" at the given UTC offset, as YYYY-MM-DD. */
export function todayIn(offsetMinutes: number, now: Date = new Date()): IsoDate {
  const shifted = new Date(now.getTime() + offsetMinutes * 60_000);
  return `${shifted.getUTCFullYear()}-${pad2(shifted.getUTCMonth() + 1)}-${pad2(shifted.getUTCDate())}`;
}

/** Adds (or subtracts, for negative n) whole days to an ISO date, handling month/year/leap-year boundaries via the Date object itself. */
export function addDays(date: IsoDate, n: number): IsoDate {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

/** Whole-day difference, b - a, positive when b is later. */
export function daysBetween(a: IsoDate, b: IsoDate): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  const msPerDay = 86_400_000;
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / msPerDay);
}

export function isBeforeOrEqual(a: IsoDate, b: IsoDate): boolean {
  return a <= b; // ISO YYYY-MM-DD strings compare correctly lexically
}
