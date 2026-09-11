import { isDuplicateScan, inferDirection, checkClockDrift, checkImpossibleSequence, MiqatEventLike } from './anti-replay';

const school = 'school-1';

function event(overrides: Partial<MiqatEventLike> = {}): MiqatEventLike {
  return { schoolId: school, eventType: 'check_in', deviceTime: new Date('2026-09-11T07:00:00Z'), ...overrides };
}

describe('isDuplicateScan', () => {
  it('is not a duplicate when there is no prior event', () => {
    expect(isDuplicateScan(null, new Date('2026-09-11T07:00:00Z'))).toBe(false);
  });

  it('is a duplicate inside the dedupe window', () => {
    const last = event({ deviceTime: new Date('2026-09-11T07:00:00Z') });
    const now = new Date('2026-09-11T07:01:00Z'); // 60s later
    expect(isDuplicateScan(last, now)).toBe(true);
  });

  it('is not a duplicate exactly at the window boundary', () => {
    const last = event({ deviceTime: new Date('2026-09-11T07:00:00Z') });
    const now = new Date('2026-09-11T07:02:00Z'); // exactly 120s later
    expect(isDuplicateScan(last, now, 120)).toBe(false);
  });

  it('is not a duplicate just past the window', () => {
    const last = event({ deviceTime: new Date('2026-09-11T07:00:00Z') });
    const now = new Date('2026-09-11T07:02:01Z');
    expect(isDuplicateScan(last, now, 120)).toBe(false);
  });

  it('treats an out-of-order (earlier) new event as not a duplicate', () => {
    const last = event({ deviceTime: new Date('2026-09-11T07:05:00Z') });
    const now = new Date('2026-09-11T07:00:00Z');
    expect(isDuplicateScan(last, now)).toBe(false);
  });
});

describe('inferDirection', () => {
  it('defaults to check_in with no prior event today', () => {
    expect(inferDirection(null)).toBe('check_in');
  });

  it('infers check_out after a check_in', () => {
    expect(inferDirection(event({ eventType: 'check_in' }))).toBe('check_out');
  });

  it('infers check_in after a check_out', () => {
    expect(inferDirection(event({ eventType: 'check_out' }))).toBe('check_in');
  });
});

describe('checkClockDrift', () => {
  it('does not flag when device and server clocks agree', () => {
    const t = new Date('2026-09-11T07:00:00Z');
    expect(checkClockDrift(t, t)).toEqual({ flagged: false, driftMinutes: 0 });
  });

  it('does not flag drift under the default threshold', () => {
    const device = new Date('2026-09-11T07:00:00Z');
    const server = new Date('2026-09-11T07:04:00Z');
    const result = checkClockDrift(device, server);
    expect(result.flagged).toBe(false);
    expect(result.driftMinutes).toBe(4);
  });

  it('flags drift over the default 5 minute threshold', () => {
    const device = new Date('2026-09-11T07:00:00Z');
    const server = new Date('2026-09-11T07:06:00Z');
    const result = checkClockDrift(device, server);
    expect(result.flagged).toBe(true);
    expect(result.driftMinutes).toBe(6);
  });

  it('flags drift symmetrically when device clock is ahead', () => {
    const device = new Date('2026-09-11T07:10:00Z');
    const server = new Date('2026-09-11T07:00:00Z');
    expect(checkClockDrift(device, server).flagged).toBe(true);
  });

  it('respects a custom threshold', () => {
    const device = new Date('2026-09-11T07:00:00Z');
    const server = new Date('2026-09-11T07:03:00Z');
    expect(checkClockDrift(device, server, 2).flagged).toBe(true);
    expect(checkClockDrift(device, server, 10).flagged).toBe(false);
  });
});

describe('checkImpossibleSequence', () => {
  it('flags nothing with no previous event', () => {
    expect(checkImpossibleSequence(null, event()).anomaly).toBe(false);
  });

  it('flags two check-ins at different schools within the impossible window', () => {
    const prev = event({ schoolId: 'school-A', deviceTime: new Date('2026-09-11T07:00:00Z') });
    const next = event({ schoolId: 'school-B', deviceTime: new Date('2026-09-11T07:05:00Z') });
    const result = checkImpossibleSequence(prev, next);
    expect(result.anomaly).toBe(true);
    expect(result.reason).toBe('CROSS_SCHOOL_IMPOSSIBLE');
  });

  it('does not flag cross-school events well outside the impossible window', () => {
    // different event types so the repeated-same-direction rule can't also fire here
    const prev = event({ schoolId: 'school-A', eventType: 'check_in', deviceTime: new Date('2026-09-11T07:00:00Z') });
    const next = event({ schoolId: 'school-B', eventType: 'check_out', deviceTime: new Date('2026-09-11T09:00:00Z') });
    expect(checkImpossibleSequence(prev, next).anomaly).toBe(false);
  });

  it('flags a check-out immediately following a check-out', () => {
    const prev = event({ eventType: 'check_out' });
    const next = event({ eventType: 'check_out', deviceTime: new Date('2026-09-11T07:10:00Z') });
    const result = checkImpossibleSequence(prev, next);
    expect(result.anomaly).toBe(true);
    expect(result.reason).toBe('REPEATED_SAME_DIRECTION');
  });

  it('flags a check-in immediately following a check-in', () => {
    const prev = event({ eventType: 'check_in' });
    const next = event({ eventType: 'check_in', deviceTime: new Date('2026-09-11T07:10:00Z') });
    expect(checkImpossibleSequence(prev, next).anomaly).toBe(true);
  });

  it('does not flag a normal check_in -> check_out sequence', () => {
    const prev = event({ eventType: 'check_in' });
    const next = event({ eventType: 'check_out', deviceTime: new Date('2026-09-11T15:00:00Z') });
    expect(checkImpossibleSequence(prev, next).anomaly).toBe(false);
  });

  it('does not apply the repeated-direction check to period events', () => {
    const prev = event({ eventType: 'period_present' });
    const next = event({ eventType: 'period_present', deviceTime: new Date('2026-09-11T07:10:00Z') });
    expect(checkImpossibleSequence(prev, next).anomaly).toBe(false);
  });
});
