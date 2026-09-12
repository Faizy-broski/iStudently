import {
  detectSameWeekdayAbsences,
  detectGatePresentButPeriodAbsent,
  detectChronicEarlyCheckout,
  detectTeacherNotScanning,
} from './pattern-detection';

describe('detectSameWeekdayAbsences', () => {
  it('flags a weekday absent 3+ times', () => {
    // 2026-09-04, 11, 18, 25 are all Fridays (weekday 5)
    const days = [
      { date: '2026-09-04', status: 'absent' as const },
      { date: '2026-09-11', status: 'absent' as const },
      { date: '2026-09-18', status: 'absent' as const },
      { date: '2026-09-07', status: 'present' as const },
    ];
    const result = detectSameWeekdayAbsences(days);
    expect(result).toEqual([{ weekday: 5, count: 3 }]);
  });

  it('does not flag under the threshold', () => {
    const days = [
      { date: '2026-09-04', status: 'absent' as const },
      { date: '2026-09-11', status: 'absent' as const },
    ];
    expect(detectSameWeekdayAbsences(days)).toEqual([]);
  });

  it('ignores non-absent statuses', () => {
    const days = [
      { date: '2026-09-04', status: 'late' as const },
      { date: '2026-09-11', status: 'excused' as const },
      { date: '2026-09-18', status: 'present' as const },
    ];
    expect(detectSameWeekdayAbsences(days)).toEqual([]);
  });

  it('respects a custom threshold', () => {
    const days = [
      { date: '2026-09-04', status: 'absent' as const },
      { date: '2026-09-11', status: 'absent' as const },
    ];
    expect(detectSameWeekdayAbsences(days, 2)).toEqual([{ weekday: 5, count: 2 }]);
  });
});

describe('detectGatePresentButPeriodAbsent', () => {
  it('flags days with gate presence but a period absence', () => {
    const records = [
      { date: '2026-09-04', gatePresent: true, periodsAbsent: 1 },
      { date: '2026-09-05', gatePresent: true, periodsAbsent: 0 },
      { date: '2026-09-06', gatePresent: false, periodsAbsent: 2 },
    ];
    expect(detectGatePresentButPeriodAbsent(records)).toEqual(['2026-09-04']);
  });

  it('returns empty when nothing matches', () => {
    expect(detectGatePresentButPeriodAbsent([{ date: '2026-09-04', gatePresent: false, periodsAbsent: 0 }])).toEqual([]);
  });
});

describe('detectChronicEarlyCheckout', () => {
  it('flags when short-checkout days meet the minimum occurrence count', () => {
    const pairs = [
      { date: '2026-09-04', checkInMinutes: 420, checkOutMinutes: 430 },
      { date: '2026-09-05', checkInMinutes: 420, checkOutMinutes: 435 },
      { date: '2026-09-06', checkInMinutes: 420, checkOutMinutes: 440 },
    ];
    expect(detectChronicEarlyCheckout(pairs)).toEqual(['2026-09-04', '2026-09-05', '2026-09-06']);
  });

  it('does not flag a single early checkout', () => {
    const pairs = [{ date: '2026-09-04', checkInMinutes: 420, checkOutMinutes: 430 }];
    expect(detectChronicEarlyCheckout(pairs)).toEqual([]);
  });

  it('does not flag a normal full day', () => {
    const pairs = [
      { date: '2026-09-04', checkInMinutes: 420, checkOutMinutes: 900 },
      { date: '2026-09-05', checkInMinutes: 420, checkOutMinutes: 900 },
      { date: '2026-09-06', checkInMinutes: 420, checkOutMinutes: 900 },
    ];
    expect(detectChronicEarlyCheckout(pairs)).toEqual([]);
  });

  it('excludes a pair where checkout is before checkin (data anomaly, not this detector\'s job) from the count', () => {
    const pairs = [
      { date: '2026-09-04', checkInMinutes: 420, checkOutMinutes: 400 }, // excluded: checkout before checkin
      { date: '2026-09-05', checkInMinutes: 420, checkOutMinutes: 430 },
      { date: '2026-09-06', checkInMinutes: 420, checkOutMinutes: 435 },
    ];
    // only 2 valid short-checkout days remain once the anomaly is excluded — below the default minOccurrences of 3
    expect(detectChronicEarlyCheckout(pairs)).toEqual([]);
  });

  it('flags once a third valid short-checkout day joins the two above', () => {
    const pairs = [
      { date: '2026-09-04', checkInMinutes: 420, checkOutMinutes: 400 }, // excluded: checkout before checkin
      { date: '2026-09-05', checkInMinutes: 420, checkOutMinutes: 430 },
      { date: '2026-09-06', checkInMinutes: 420, checkOutMinutes: 435 },
      { date: '2026-09-07', checkInMinutes: 420, checkOutMinutes: 440 },
    ];
    expect(detectChronicEarlyCheckout(pairs)).toEqual(['2026-09-05', '2026-09-06', '2026-09-07']);
  });
});

describe('detectTeacherNotScanning', () => {
  it('flags a period with 3+ missed scans', () => {
    const records = [
      { date: '2026-09-04', periodId: 'p1', scanned: false },
      { date: '2026-09-05', periodId: 'p1', scanned: false },
      { date: '2026-09-06', periodId: 'p1', scanned: false },
      { date: '2026-09-07', periodId: 'p1', scanned: true },
    ];
    expect(detectTeacherNotScanning(records)).toEqual([{ periodId: 'p1', missedDates: ['2026-09-04', '2026-09-05', '2026-09-06'] }]);
  });

  it('does not flag under the threshold', () => {
    const records = [
      { date: '2026-09-04', periodId: 'p1', scanned: false },
      { date: '2026-09-05', periodId: 'p1', scanned: true },
    ];
    expect(detectTeacherNotScanning(records)).toEqual([]);
  });

  it('tracks multiple periods independently', () => {
    const records = [
      { date: '2026-09-04', periodId: 'p1', scanned: false },
      { date: '2026-09-05', periodId: 'p1', scanned: false },
      { date: '2026-09-06', periodId: 'p1', scanned: false },
      { date: '2026-09-04', periodId: 'p2', scanned: false },
    ];
    expect(detectTeacherNotScanning(records)).toEqual([{ periodId: 'p1', missedDates: ['2026-09-04', '2026-09-05', '2026-09-06'] }]);
  });
});
