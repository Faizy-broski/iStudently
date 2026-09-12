// Standalone node-cron schedule, deliberately decoupled from the legacy
// monolithic cron.service.ts (CronService's jobs are its own minute-grain
// schedules; this is a clean, independent daily job with nothing to share)
// — started separately from app.ts's app.listen() callback, alongside (not
// inside) cronService.init(), matching the precedent already set by
// fina/jobs-runner.service.ts's own comment on why it stays decoupled too.

import cron from 'node-cron';
import { supabase } from '../config/supabase';
import { miqatService, MIQAT_PHOTOS_BUCKET } from '../services/miqat/miqat.service';
import { classifyArrival, checkEscalationTriggers, DEFAULT_ESCALATION_CONFIG, LatenessPolicy } from '../services/miqat/attendance-engine';
import { MIQAT_FLAG } from '../services/miqat/verification-flags';
import { onMiqatMarkedAbsent } from '../listeners/fina-miqat-absence.listener';
import { onMiqatEscalationTriggered } from '../listeners/fina-miqat-escalation.listener';
import { onAttendanceStreakAchieved } from '../listeners/mizan-miqat-streak.listener';
import { mizanService } from '../services/mizan/mizan.service';
import { detectSameWeekdayAbsences, detectGatePresentButPeriodAbsent, detectChronicEarlyCheckout, detectTeacherNotScanning } from '../services/miqat/pattern-detection';

const DEFAULT_TIMEZONE = 'Asia/Karachi'; // matches cron.service.ts's existing TODO: no per-school timezone column exists yet

function minutesSinceMidnightUTC(iso: string): number {
  const d = new Date(iso);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

function yesterdayDateString(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

async function recomputeDayForSchool(schoolId: string, date: string): Promise<void> {
  const config = await miqatService.getSchoolConfig(schoolId);
  if (!config) return;

  const policy: LatenessPolicy = {
    officialStartMinutes: config.policy_json?.official_start_minutes ?? 7 * 60,
    gracePeriodMinutes: config.policy_json?.grace_period_minutes ?? 5,
    lateCutoffMinutes: config.policy_json?.late_cutoff_minutes ?? 8 * 60,
  };

  const events = await miqatService.listEventsForDay(schoolId, date);
  const approvedFullDayPermissions = await getApprovedFullDayPermissions(schoolId, date);

  const byPerson = new Map<string, typeof events>();
  for (const e of events as any[]) {
    if (!byPerson.has(e.person_id)) byPerson.set(e.person_id, []);
    byPerson.get(e.person_id)!.push(e);
  }

  for (const [personId, personEvents] of byPerson) {
    const gateEvents = personEvents.filter((e: any) => e.scope === 'gate');
    const periodEvents = personEvents.filter((e: any) => e.scope === 'period');

    const checkIns = gateEvents.filter((e: any) => e.event_type === 'check_in').sort((a: any, b: any) => a.device_time.localeCompare(b.device_time));
    const checkOuts = gateEvents.filter((e: any) => e.event_type === 'check_out').sort((a: any, b: any) => a.device_time.localeCompare(b.device_time));

    const firstCheckIn = checkIns[0]?.device_time ?? null;
    const lastCheckOut = checkOuts[checkOuts.length - 1]?.device_time ?? null;

    let status: string;
    if (approvedFullDayPermissions.has(personId)) {
      status = 'excused';
    } else if (!firstCheckIn) {
      status = 'absent';
    } else if (!lastCheckOut) {
      status = 'unclosed'; // spec §17 — checked in, never checked out
    } else {
      status = classifyArrival(minutesSinceMidnightUTC(firstCheckIn), policy);
    }

    const latenessMinutes = firstCheckIn
      ? Math.max(0, minutesSinceMidnightUTC(firstCheckIn) - (policy.officialStartMinutes + policy.gracePeriodMinutes))
      : 0;

    const hasAnomaly = personEvents.some((e: any) => (e.verification_flags & MIQAT_FLAG.ANOMALY) !== 0);

    await miqatService.upsertDay({
      school_id: schoolId,
      person_id: personId,
      date,
      first_check_in: firstCheckIn,
      last_check_out: lastCheckOut,
      status,
      lateness_minutes: latenessMinutes,
      early_departure_minutes: 0, // requires official end-of-day time in policy — left at 0 until that's configured (see open questions)
      periods_present: periodEvents.filter((e: any) => e.event_type === 'period_present').length,
      periods_absent: periodEvents.filter((e: any) => e.event_type === 'period_absent').length,
      has_anomaly: hasAnomaly,
      recomputed_at: new Date().toISOString(),
    });

    if (status === 'absent') {
      await onMiqatMarkedAbsent(schoolId, personId, date);
    }

    await checkAndNotifyEscalation(schoolId, personId, date, config.policy_json);
    await checkAndFlagPatterns(schoolId, personId, date);

    if (config.policy_json?.mizan_rewards_enabled) {
      await checkAndCreditPunctualityStreak(schoolId, personId, date);
    }
  }
}

// School days off (weekends/holidays) never get a miqat_days row at all, so
// "exactly 7 rows" would almost never be true — this codebase's
// attendance_calendar integration isn't wired into Miqat, so there's no
// authoritative school-day count to check against. MIN_SCHOOL_DAYS is a
// documented heuristic (a typical school week), not an exact calendar match.
const MIN_SCHOOL_DAYS_FOR_STREAK = 5;

const STREAK_REASON = 'miqat_zero_lateness_week';

/**
 * Spec §14: a full week with zero lateness/absence credits Nuqra. Disabled
 * by default per school. This job runs nightly against a rolling 7-day
 * window, so without a guard it would re-credit the same ongoing streak
 * every single night — hasRecentCredit() enforces "at most once per
 * 7-day period" instead.
 */
async function checkAndCreditPunctualityStreak(schoolId: string, personId: string, date: string): Promise<void> {
  const weekStart = daysBefore(date, 6);
  const days = await miqatService.getDaysForPerson(personId, weekStart, date);
  const allPresent = days.length >= MIN_SCHOOL_DAYS_FOR_STREAK && days.every((d: any) => d.status === 'present');
  if (!allPresent) return;

  const alreadyCredited = await mizanService.hasRecentCredit(personId, STREAK_REASON, `${weekStart}T00:00:00Z`);
  if (alreadyCredited) return;

  await onAttendanceStreakAchieved(schoolId, personId, 'zero_lateness_week');
}

function daysBefore(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

/**
 * Escalation figures, spec §8.1: consecutive late days, late events in a
 * rolling 7-day window, and accumulated lateness. "Accumulated" has no
 * defined window in the spec (it implies a running per-term/year total, and
 * this codebase has no term-boundary integration for Miqat yet) — approximated
 * here as a rolling 90-day sum, a documented simplification, not a claim of
 * exact per-term accounting.
 */
async function checkAndNotifyEscalation(schoolId: string, personId: string, date: string, policyJson: Record<string, any>): Promise<void> {
  const history = await miqatService.getDaysForPerson(personId, daysBefore(date, 90), date);
  const sorted = [...history].sort((a: any, b: any) => b.date.localeCompare(a.date)); // newest first

  let consecutiveLateDays = 0;
  for (const day of sorted) {
    if (day.status === 'late') consecutiveLateDays++;
    else break;
  }

  const rollingWeekStart = daysBefore(date, 6);
  const lateEventsInRollingWeek = sorted.filter((d: any) => d.date >= rollingWeekStart && d.status === 'late').length;
  const accumulatedLatenessMinutes = sorted.reduce((sum: number, d: any) => sum + (d.lateness_minutes || 0), 0);

  const triggers = checkEscalationTriggers(
    { consecutiveLateDays, lateEventsInRollingWeek, accumulatedLatenessMinutes },
    {
      ...DEFAULT_ESCALATION_CONFIG,
      accumulatedLatenessThresholdMinutes: policyJson?.accumulated_lateness_threshold_minutes ?? 300,
    }
  );

  if (triggers.length > 0) {
    await onMiqatEscalationTriggered(schoolId, personId, triggers);
  }
}

const PATTERN_FLAG_COOLDOWN_DAYS = 14; // re-raising the same flag every single night once true would just be noise

/**
 * Spec §8.3 pattern detection, run nightly over a rolling ~6-week window
 * (long enough for same-weekday and chronic patterns to surface, short
 * enough to stay a cheap per-person query). teacher_not_scanning is NOT
 * implemented here — it needs a join against timetable/attendance_records
 * that Miqat's own tables don't carry, and is left as documented follow-up
 * rather than faked.
 */
async function checkAndFlagPatterns(schoolId: string, personId: string, date: string): Promise<void> {
  const windowStart = daysBefore(date, 42);
  const history = await miqatService.getDaysForPerson(personId, windowStart, date);

  const weekdayFlags = detectSameWeekdayAbsences(history.map((d: any) => ({ date: d.date, status: d.status })));
  if (weekdayFlags.length > 0 && !(await miqatService.hasRecentPatternFlag(personId, 'same_weekday_absences', daysBefore(date, PATTERN_FLAG_COOLDOWN_DAYS)))) {
    await miqatService.insertPatternFlag(schoolId, personId, 'same_weekday_absences', { flags: weekdayFlags });
  }

  const periodAbsentDays = detectGatePresentButPeriodAbsent(
    history.map((d: any) => ({ date: d.date, gatePresent: !!d.first_check_in, periodsAbsent: d.periods_absent }))
  );
  if (periodAbsentDays.length > 0 && !(await miqatService.hasRecentPatternFlag(personId, 'gate_present_period_absent', daysBefore(date, PATTERN_FLAG_COOLDOWN_DAYS)))) {
    await miqatService.insertPatternFlag(schoolId, personId, 'gate_present_period_absent', { dates: periodAbsentDays });
  }

  const checkoutPairs = history
    .filter((d: any) => d.first_check_in && d.last_check_out)
    .map((d: any) => ({ date: d.date, checkInMinutes: minutesSinceMidnightUTC(d.first_check_in), checkOutMinutes: minutesSinceMidnightUTC(d.last_check_out) }));
  const earlyCheckoutDays = detectChronicEarlyCheckout(checkoutPairs);
  if (earlyCheckoutDays.length > 0 && !(await miqatService.hasRecentPatternFlag(personId, 'chronic_early_checkout', daysBefore(date, PATTERN_FLAG_COOLDOWN_DAYS)))) {
    await miqatService.insertPatternFlag(schoolId, personId, 'chronic_early_checkout', { dates: earlyCheckoutDays });
  }
}

async function getApprovedFullDayPermissions(schoolId: string, date: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('miqat_permissions')
    .select('person_id')
    .eq('school_id', schoolId)
    .eq('type', 'full_day')
    .eq('status', 'approved')
    .lte('date_from', date)
    .gte('date_to', date);
  if (error) throw error;
  return new Set((data || []).map((r) => r.person_id));
}

async function runNightlyRecompute(): Promise<void> {
  const date = yesterdayDateString();
  const schoolIds = await miqatService.listSchoolIdsWithMiqatConfig();
  for (const schoolId of schoolIds) {
    try {
      await recomputeDayForSchool(schoolId, date);
      await checkTeacherScanningForSchool(schoolId, date);
    } catch (err) {
      console.error(`Miqat nightly recompute failed for school ${schoolId}:`, err);
    }
  }
}

/**
 * Spec §8.3 — "a teacher repeatedly not scanning class attendance." Checked
 * against the last 4 occurrences of `date`'s weekday within a 28-day
 * lookback (a period on the same weekday recurs weekly, so this
 * approximates "the last 4 times this class was timetabled"). Requires
 * class-period scanning to actually be in use — before that ships, every
 * timetabled period simply has zero scans and nothing here should be
 * mistaken for teacher-specific data until it is.
 */
async function checkTeacherScanningForSchool(schoolId: string, date: string): Promise<void> {
  const dayOfWeek = (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7; // Monday=0..Sunday=6, matching timetable.service.ts's existing convention
  const expected = await miqatService.getExpectedPeriodScans(schoolId, dayOfWeek);
  if (expected.length === 0) return;

  const lookbackStart = daysBefore(date, 28);
  const scannedKeys = await miqatService.listScannedPeriodDateKeys(schoolId, lookbackStart, date);

  const candidateDates: string[] = [];
  for (let i = 0; i < 28; i++) {
    const d = daysBefore(date, i);
    if ((new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7 === dayOfWeek) candidateDates.push(d);
  }
  const recentFour = candidateDates.slice(0, 4);

  const byTeacher = new Map<string, { date: string; periodId: string; scanned: boolean }[]>();
  for (const { teacherProfileId, periodId } of expected) {
    const records = recentFour.map((d) => ({ date: d, periodId, scanned: scannedKeys.has(`${periodId}:${d}`) }));
    byTeacher.set(teacherProfileId, [...(byTeacher.get(teacherProfileId) ?? []), ...records]);
  }

  for (const [teacherProfileId, records] of byTeacher) {
    const flags = detectTeacherNotScanning(records);
    if (flags.length === 0) continue;
    if (await miqatService.hasRecentPatternFlag(teacherProfileId, 'teacher_not_scanning', daysBefore(date, PATTERN_FLAG_COOLDOWN_DAYS))) continue;
    await miqatService.insertPatternFlag(schoolId, teacherProfileId, 'teacher_not_scanning', { flags });
  }
}

async function runPhotoRetention(): Promise<void> {
  const schoolIds = await miqatService.listSchoolIdsWithMiqatConfig();
  for (const schoolId of schoolIds) {
    try {
      const config = await miqatService.getSchoolConfig(schoolId);
      if (!config) continue;
      const deleted = await miqatService.deleteExpiredPhotos(schoolId, config.photo_retention_days, MIQAT_FLAG.FLAGGED_FOR_INVESTIGATION);
      if (deleted > 0) console.log(`Miqat: deleted ${deleted} expired photo(s) from ${MIQAT_PHOTOS_BUCKET} for school ${schoolId}`);
    } catch (err) {
      console.error(`Miqat photo retention failed for school ${schoolId}:`, err);
    }
  }
}

let started = false;

export function startMiqatNightlyJobs(): void {
  if (started) return;
  started = true;
  // 02:00 local — after the school day has fully closed, before the next
  // morning's arrivals begin.
  cron.schedule('0 2 * * *', () => void runNightlyRecompute(), { scheduled: true, timezone: DEFAULT_TIMEZONE });
  cron.schedule('30 2 * * *', () => void runPhotoRetention(), { scheduled: true, timezone: DEFAULT_TIMEZONE });
}

// Exported for manual/admin-triggered recompute (e.g. spec §17's "school
// closure declared retroactively" — recompute a specific date on demand)
// and for tests.
export { recomputeDayForSchool, runNightlyRecompute, runPhotoRetention };
