import { schedule, isDue, buildSession, BOX_INTERVALS_DAYS, MAX_BOX } from './scheduler';
import { HadithProgress } from './types';
import { emptyProgress } from './progress';

function progressAt(overrides: Partial<HadithProgress>): HadithProgress {
  return { ...emptyProgress(overrides.hadithNumber ?? 1), ...overrides };
}

describe('schedule', () => {
  it('advances one box on pass and schedules the matching interval', () => {
    const result = schedule(0, 'pass', '2026-03-10');
    expect(result.box).toBe(1);
    expect(result.dueOn).toBe('2026-03-11'); // BOX_INTERVALS_DAYS[1] = 1
    expect(result.lastReviewedOn).toBe('2026-03-10');
  });

  it('resets straight to box 0 on fail, regardless of current box', () => {
    const result = schedule(4, 'fail', '2026-03-10');
    expect(result.box).toBe(0);
    expect(result.dueOn).toBe('2026-03-10'); // BOX_INTERVALS_DAYS[0] = 0
  });

  it('caps at MAX_BOX — passing again at the ceiling does not overflow', () => {
    const result = schedule(MAX_BOX, 'pass', '2026-03-10');
    expect(result.box).toBe(MAX_BOX);
    expect(result.dueOn).toBe(addExpected(MAX_BOX));
  });

  it('every box interval is non-decreasing (the ladder never gets shorter)', () => {
    for (let i = 1; i < BOX_INTERVALS_DAYS.length; i++) {
      expect(BOX_INTERVALS_DAYS[i]).toBeGreaterThan(BOX_INTERVALS_DAYS[i - 1]);
    }
  });

  function addExpected(box: number): string {
    const days = BOX_INTERVALS_DAYS[box];
    const d = new Date('2026-03-10T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  }
});

describe('isDue', () => {
  it('is false when dueOn is null (never scheduled)', () => {
    expect(isDue({ dueOn: null }, '2026-03-10')).toBe(false);
  });

  it('is true when dueOn is today', () => {
    expect(isDue({ dueOn: '2026-03-10' }, '2026-03-10')).toBe(true);
  });

  it('is true when dueOn is in the past', () => {
    expect(isDue({ dueOn: '2026-03-05' }, '2026-03-10')).toBe(true);
  });

  it('is false when dueOn is in the future', () => {
    expect(isDue({ dueOn: '2026-03-15' }, '2026-03-10')).toBe(false);
  });
});

describe('buildSession', () => {
  const today = '2026-03-10';

  it('puts due items first, earliest-due first', () => {
    const progress: HadithProgress[] = [
      progressAt({ hadithNumber: 1, state: 'learning', dueOn: '2026-03-09', box: 1 }),
      progressAt({ hadithNumber: 2, state: 'learning', dueOn: '2026-03-08', box: 1 }),
    ];
    const session = buildSession(progress, today, 10);
    expect(session[0]).toBe(2); // earlier due date first
    expect(session[1]).toBe(1);
  });

  it('fills remaining slots with untouched hadith in canonical number order', () => {
    const progress: HadithProgress[] = [];
    const session = buildSession(progress, today, 3);
    expect(session).toEqual([1, 2, 3]);
  });

  it('excludes hadith already mastered and not due', () => {
    const progress: HadithProgress[] = [
      progressAt({ hadithNumber: 1, state: 'mastered', dueOn: '2026-04-01', box: 3 }),
    ];
    const session = buildSession(progress, today, 42);
    expect(session).not.toContain(1);
  });

  it('excludes hadith in learning state that are not yet due (mid-interval)', () => {
    const progress: HadithProgress[] = [
      progressAt({ hadithNumber: 1, state: 'learning', dueOn: '2026-04-01', box: 2 }),
    ];
    const session = buildSession(progress, today, 42);
    expect(session).not.toContain(1);
  });

  it('respects the session cap', () => {
    const session = buildSession([], today, 5);
    expect(session).toHaveLength(5);
    expect(session).toEqual([1, 2, 3, 4, 5]);
  });

  it('returns an empty array for a zero session cap', () => {
    expect(buildSession([], today, 0)).toEqual([]);
  });

  it('clamps a negative session cap to empty rather than throwing', () => {
    expect(buildSession([], today, -3)).toEqual([]);
  });

  it('mixes due items and fresh fill within the cap', () => {
    const progress: HadithProgress[] = [progressAt({ hadithNumber: 5, state: 'learning', dueOn: '2026-03-01', box: 1 })];
    const session = buildSession(progress, today, 3);
    expect(session[0]).toBe(5);
    expect(session).toHaveLength(3);
  });
});
