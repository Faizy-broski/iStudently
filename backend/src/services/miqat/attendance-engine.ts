// Spec §8 — lateness and absence business rules. Pure, timezone-agnostic:
// callers resolve "minutes since local midnight" from whatever timezone the
// school operates in before calling into this module, so none of this code
// has to reason about Date/timezone conversion itself.

export interface LatenessPolicy {
  officialStartMinutes: number; // minutes since local midnight
  gracePeriodMinutes: number; // default 5
  lateCutoffMinutes: number; // default officialStartMinutes + 60 — after this, absent rather than late
}

export type ArrivalStatus = 'present' | 'late' | 'absent';

/** lateness_minutes = max(0, check_in_time - (official_start_time + grace_period_minutes)) */
export function computeLatenessMinutes(checkInMinutes: number, policy: LatenessPolicy): number {
  const threshold = policy.officialStartMinutes + policy.gracePeriodMinutes;
  return Math.max(0, checkInMinutes - threshold);
}

export function classifyArrival(checkInMinutes: number, policy: LatenessPolicy): ArrivalStatus {
  const graceThreshold = policy.officialStartMinutes + policy.gracePeriodMinutes;
  if (checkInMinutes <= graceThreshold) return 'present';
  if (checkInMinutes <= policy.lateCutoffMinutes) return 'late';
  return 'absent';
}

const DEFAULT_CONVERSION_N = 180;

/**
 * "Every N accumulated lateness minutes = 1 absence day equivalent." This is
 * a reported figure only — the caller must never apply it automatically to a
 * student's record; an admin acts on it (spec §8.1).
 */
export function convertLatenessToAbsenceDayEquivalents(
  totalLatenessMinutes: number,
  conversionN: number = DEFAULT_CONVERSION_N
): number {
  if (conversionN <= 0) return 0;
  return Math.floor(totalLatenessMinutes / conversionN);
}

export interface EscalationInput {
  consecutiveLateDays: number;
  lateEventsInRollingWeek: number;
  accumulatedLatenessMinutes: number;
}

export interface EscalationConfig {
  consecutiveLateDaysThreshold: number; // default 3
  lateEventsRollingWeekThreshold: number; // default 3
  accumulatedLatenessThresholdMinutes: number; // school-configured
}

export type EscalationTrigger =
  | 'CONSECUTIVE_LATE_DAYS'
  | 'LATENESS_IN_ROLLING_WEEK'
  | 'ACCUMULATED_LATENESS_THRESHOLD';

export const DEFAULT_ESCALATION_CONFIG: Omit<EscalationConfig, 'accumulatedLatenessThresholdMinutes'> = {
  consecutiveLateDaysThreshold: 3,
  lateEventsRollingWeekThreshold: 3,
};

/** Each configured trigger that's crossed fires independently — a day can trip more than one. */
export function checkEscalationTriggers(input: EscalationInput, config: EscalationConfig): EscalationTrigger[] {
  const triggers: EscalationTrigger[] = [];

  if (input.consecutiveLateDays >= config.consecutiveLateDaysThreshold) {
    triggers.push('CONSECUTIVE_LATE_DAYS');
  }
  if (input.lateEventsInRollingWeek >= config.lateEventsRollingWeekThreshold) {
    triggers.push('LATENESS_IN_ROLLING_WEEK');
  }
  if (input.accumulatedLatenessMinutes >= config.accumulatedLatenessThresholdMinutes) {
    triggers.push('ACCUMULATED_LATENESS_THRESHOLD');
  }

  return triggers;
}
