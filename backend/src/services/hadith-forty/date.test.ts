import { todayIn, addDays, daysBetween, isBeforeOrEqual } from './date';

describe('todayIn', () => {
  it('shifts by the given UTC offset before reading the date', () => {
    // 23:30 UTC + 120 minutes (UTC+2) rolls into the next calendar day
    const now = new Date('2026-03-10T23:30:00Z');
    expect(todayIn(120, now)).toBe('2026-03-11');
  });

  it('does not roll over when the offset keeps it on the same day', () => {
    const now = new Date('2026-03-10T10:00:00Z');
    expect(todayIn(120, now)).toBe('2026-03-10');
  });

  it('handles a negative offset', () => {
    const now = new Date('2026-03-10T01:00:00Z');
    expect(todayIn(-120, now)).toBe('2026-03-09');
  });

  it('defaults to the current time when no `now` is passed', () => {
    expect(todayIn(0)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('addDays', () => {
  it('adds whole days within a month', () => {
    expect(addDays('2026-03-10', 5)).toBe('2026-03-15');
  });

  it('subtracts for a negative n', () => {
    expect(addDays('2026-03-10', -5)).toBe('2026-03-05');
  });

  it('crosses a month boundary', () => {
    expect(addDays('2026-03-30', 3)).toBe('2026-04-02');
  });

  it('crosses a year boundary', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
  });

  it('handles a leap year correctly (2028 is a leap year)', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2028-02-29', 1)).toBe('2028-03-01');
  });

  it('does not treat a non-leap year the same way', () => {
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
  });

  it('is a no-op for n=0', () => {
    expect(addDays('2026-03-10', 0)).toBe('2026-03-10');
  });
});

describe('daysBetween', () => {
  it('is positive when b is later than a', () => {
    expect(daysBetween('2026-03-10', '2026-03-15')).toBe(5);
  });

  it('is negative when b is earlier than a', () => {
    expect(daysBetween('2026-03-15', '2026-03-10')).toBe(-5);
  });

  it('is zero for the same date', () => {
    expect(daysBetween('2026-03-10', '2026-03-10')).toBe(0);
  });

  it('crosses a year boundary correctly', () => {
    expect(daysBetween('2026-12-30', '2027-01-02')).toBe(3);
  });
});

describe('isBeforeOrEqual', () => {
  it('is true when a is before b', () => {
    expect(isBeforeOrEqual('2026-03-10', '2026-03-11')).toBe(true);
  });

  it('is true when a equals b', () => {
    expect(isBeforeOrEqual('2026-03-10', '2026-03-10')).toBe(true);
  });

  it('is false when a is after b', () => {
    expect(isBeforeOrEqual('2026-03-11', '2026-03-10')).toBe(false);
  });
});
