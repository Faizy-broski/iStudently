import {
  computeLatenessMinutes,
  classifyArrival,
  convertLatenessToAbsenceDayEquivalents,
  checkEscalationTriggers,
  LatenessPolicy,
  EscalationConfig,
} from './attendance-engine';

const policy: LatenessPolicy = {
  officialStartMinutes: 7 * 60, // 07:00
  gracePeriodMinutes: 5,
  lateCutoffMinutes: 8 * 60, // 08:00 (start + 60)
};

describe('computeLatenessMinutes', () => {
  it('is 0 for an on-time arrival', () => {
    expect(computeLatenessMinutes(7 * 60, policy)).toBe(0);
  });

  it('is 0 within the grace period', () => {
    expect(computeLatenessMinutes(7 * 60 + 5, policy)).toBe(0);
  });

  it('is 0 for an early arrival', () => {
    expect(computeLatenessMinutes(6 * 60 + 45, policy)).toBe(0);
  });

  it('counts minutes past grace, not past official start', () => {
    expect(computeLatenessMinutes(7 * 60 + 20, policy)).toBe(15); // 20 min late - 5 grace = 15
  });

  it('never returns negative', () => {
    expect(computeLatenessMinutes(0, policy)).toBe(0);
  });
});

describe('classifyArrival', () => {
  it('is present at or before the grace threshold', () => {
    expect(classifyArrival(7 * 60, policy)).toBe('present');
    expect(classifyArrival(7 * 60 + 5, policy)).toBe('present');
  });

  it('is late between grace threshold and cutoff', () => {
    expect(classifyArrival(7 * 60 + 6, policy)).toBe('late');
    expect(classifyArrival(8 * 60, policy)).toBe('late'); // exactly at cutoff boundary is still late
  });

  it('is absent after the late cutoff', () => {
    expect(classifyArrival(8 * 60 + 1, policy)).toBe('absent');
  });
});

describe('convertLatenessToAbsenceDayEquivalents', () => {
  it('converts using the default N=180', () => {
    expect(convertLatenessToAbsenceDayEquivalents(0)).toBe(0);
    expect(convertLatenessToAbsenceDayEquivalents(179)).toBe(0);
    expect(convertLatenessToAbsenceDayEquivalents(180)).toBe(1);
    expect(convertLatenessToAbsenceDayEquivalents(359)).toBe(1);
    expect(convertLatenessToAbsenceDayEquivalents(360)).toBe(2);
  });

  it('respects a custom conversion N', () => {
    expect(convertLatenessToAbsenceDayEquivalents(100, 50)).toBe(2);
  });

  it('does not divide by zero for a misconfigured N', () => {
    expect(convertLatenessToAbsenceDayEquivalents(100, 0)).toBe(0);
  });
});

describe('checkEscalationTriggers', () => {
  const config: EscalationConfig = {
    consecutiveLateDaysThreshold: 3,
    lateEventsRollingWeekThreshold: 3,
    accumulatedLatenessThresholdMinutes: 300,
  };

  it('fires nothing when under every threshold', () => {
    expect(checkEscalationTriggers({ consecutiveLateDays: 1, lateEventsInRollingWeek: 1, accumulatedLatenessMinutes: 10 }, config)).toEqual([]);
  });

  it('fires CONSECUTIVE_LATE_DAYS at the threshold', () => {
    const triggers = checkEscalationTriggers({ consecutiveLateDays: 3, lateEventsInRollingWeek: 0, accumulatedLatenessMinutes: 0 }, config);
    expect(triggers).toEqual(['CONSECUTIVE_LATE_DAYS']);
  });

  it('fires LATENESS_IN_ROLLING_WEEK at the threshold', () => {
    const triggers = checkEscalationTriggers({ consecutiveLateDays: 0, lateEventsInRollingWeek: 3, accumulatedLatenessMinutes: 0 }, config);
    expect(triggers).toEqual(['LATENESS_IN_ROLLING_WEEK']);
  });

  it('fires ACCUMULATED_LATENESS_THRESHOLD at the threshold', () => {
    const triggers = checkEscalationTriggers({ consecutiveLateDays: 0, lateEventsInRollingWeek: 0, accumulatedLatenessMinutes: 300 }, config);
    expect(triggers).toEqual(['ACCUMULATED_LATENESS_THRESHOLD']);
  });

  it('fires all three simultaneously when all thresholds are crossed', () => {
    const triggers = checkEscalationTriggers({ consecutiveLateDays: 5, lateEventsInRollingWeek: 5, accumulatedLatenessMinutes: 500 }, config);
    expect(triggers).toEqual(['CONSECUTIVE_LATE_DAYS', 'LATENESS_IN_ROLLING_WEEK', 'ACCUMULATED_LATENESS_THRESHOLD']);
  });
});
