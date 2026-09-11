// Spec §6 — anti-replay/anomaly rules, independent of the verification
// layers. All pure: the caller supplies "now" and the person's recent event
// history, nothing here reads a clock or the DB directly.

export interface MiqatEventLike {
  schoolId: string;
  eventType: 'check_in' | 'check_out' | 'period_present' | 'period_absent';
  deviceTime: Date;
}

const DEFAULT_DEDUPE_WINDOW_SECONDS = 120;
const DEFAULT_MAX_DRIFT_MINUTES = 5;
const IMPOSSIBLE_CROSS_SCHOOL_WINDOW_MINUTES = 15;

/**
 * The same person cannot produce a second event of the same type within the
 * dedupe window. A repeated scan inside the window is "already recorded",
 * not a new row.
 */
export function isDuplicateScan(
  lastEventOfSameType: MiqatEventLike | null,
  newEventTime: Date,
  dedupeWindowSeconds = DEFAULT_DEDUPE_WINDOW_SECONDS
): boolean {
  if (!lastEventOfSameType) return false;
  const diffSeconds = (newEventTime.getTime() - lastEventOfSameType.deviceTime.getTime()) / 1000;
  return diffSeconds >= 0 && diffSeconds < dedupeWindowSeconds;
}

/**
 * If the last event of the day for a person is CHECK_IN, the next gate scan
 * is CHECK_OUT, and vice versa — the operator never selects a direction.
 * With no prior event today, the first gate scan of the day is a check-in.
 */
export function inferDirection(lastGateEventToday: MiqatEventLike | null): 'check_in' | 'check_out' {
  if (!lastGateEventToday) return 'check_in';
  return lastGateEventToday.eventType === 'check_in' ? 'check_out' : 'check_in';
}

export interface ClockDriftResult {
  flagged: boolean;
  driftMinutes: number;
}

/**
 * The device timestamp is trusted for policy evaluation (§11 — offline
 * events are evaluated as of device_time), but if it deviates too far from
 * server receive time at sync, the batch is flagged TIME_DRIFT for admin
 * review rather than silently trusted.
 */
export function checkClockDrift(
  deviceTime: Date,
  serverTime: Date,
  maxDriftMinutes = DEFAULT_MAX_DRIFT_MINUTES
): ClockDriftResult {
  const driftMinutes = Math.abs(serverTime.getTime() - deviceTime.getTime()) / 60000;
  return { flagged: driftMinutes > maxDriftMinutes, driftMinutes };
}

export interface AnomalyResult {
  anomaly: boolean;
  reason?: 'CROSS_SCHOOL_IMPOSSIBLE' | 'REPEATED_SAME_DIRECTION';
}

/**
 * Physically impossible sequences: a check-in at School A and a check-in at
 * School B within a few minutes, or a check-out immediately following a
 * check-out. Flagged, not blocked — see spec §17, real timetables change.
 */
export function checkImpossibleSequence(previous: MiqatEventLike | null, next: MiqatEventLike): AnomalyResult {
  if (!previous) return { anomaly: false };

  if (previous.schoolId !== next.schoolId) {
    const diffMinutes = Math.abs(next.deviceTime.getTime() - previous.deviceTime.getTime()) / 60000;
    if (diffMinutes < IMPOSSIBLE_CROSS_SCHOOL_WINDOW_MINUTES) {
      return { anomaly: true, reason: 'CROSS_SCHOOL_IMPOSSIBLE' };
    }
  }

  const gateTypes: Array<MiqatEventLike['eventType']> = ['check_in', 'check_out'];
  if (
    gateTypes.includes(previous.eventType) &&
    gateTypes.includes(next.eventType) &&
    previous.eventType === next.eventType
  ) {
    return { anomaly: true, reason: 'REPEATED_SAME_DIRECTION' };
  }

  return { anomaly: false };
}
