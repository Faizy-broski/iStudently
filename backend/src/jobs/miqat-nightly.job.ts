// Standalone node-cron schedule, deliberately decoupled from the legacy
// monolithic cron.service.ts (CronService's jobs are its own minute-grain
// schedules; this is a clean, independent daily job with nothing to share)
// — started separately from app.ts's app.listen() callback, alongside (not
// inside) cronService.init(), matching the precedent already set by
// fina/jobs-runner.service.ts's own comment on why it stays decoupled too.

import cron from 'node-cron';
import { supabase } from '../config/supabase';
import { miqatService, MIQAT_PHOTOS_BUCKET } from '../services/miqat/miqat.service';
import { classifyArrival, LatenessPolicy } from '../services/miqat/attendance-engine';
import { MIQAT_FLAG } from '../services/miqat/verification-flags';
import { onMiqatMarkedAbsent } from '../listeners/fina-miqat-absence.listener';

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
    } catch (err) {
      console.error(`Miqat nightly recompute failed for school ${schoolId}:`, err);
    }
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
