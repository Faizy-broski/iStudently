import { emptyProgress, computeStats, activityWindow, computeStreak } from './progress';
import { HADITHS } from './content';
import { HadithProgress, DailyActivity } from './types';

function progressAt(overrides: Partial<HadithProgress>): HadithProgress {
  return { ...emptyProgress(overrides.hadithNumber ?? 1), ...overrides };
}

describe('emptyProgress', () => {
  it('returns a fresh, zeroed record for the given hadith number', () => {
    expect(emptyProgress(7)).toEqual({
      hadithNumber: 7,
      repetitions: 0,
      state: 'new',
      box: 0,
      dueOn: null,
      lastReviewedOn: null,
      isFavorite: false,
      note: '',
    });
  });
});

describe('computeStats', () => {
  const today = '2026-03-10';

  it('reports zero everything for no progress at all', () => {
    const stats = computeStats([], today);
    expect(stats.mastered).toBe(0);
    expect(stats.learning).toBe(0);
    expect(stats.total).toBe(HADITHS.length);
    expect(stats.totalRepetitions).toBe(0);
    expect(stats.dueToday).toBe(0);
    expect(stats.masteryPercent).toBe(0);
  });

  it('counts mastered and learning separately', () => {
    const progress = [
      progressAt({ hadithNumber: 1, state: 'mastered' }),
      progressAt({ hadithNumber: 2, state: 'mastered' }),
      progressAt({ hadithNumber: 3, state: 'learning' }),
    ];
    const stats = computeStats(progress, today);
    expect(stats.mastered).toBe(2);
    expect(stats.learning).toBe(1);
  });

  it('sums repetitions across all progress rows', () => {
    const progress = [
      progressAt({ hadithNumber: 1, repetitions: 5 }),
      progressAt({ hadithNumber: 2, repetitions: 3 }),
    ];
    expect(computeStats(progress, today).totalRepetitions).toBe(8);
  });

  it('counts due-today items (including overdue, excluding future)', () => {
    const progress = [
      progressAt({ hadithNumber: 1, dueOn: '2026-03-09' }), // overdue
      progressAt({ hadithNumber: 2, dueOn: '2026-03-10' }), // due today
      progressAt({ hadithNumber: 3, dueOn: '2026-03-11' }), // future
      progressAt({ hadithNumber: 4, dueOn: null }), // never scheduled
    ];
    expect(computeStats(progress, today).dueToday).toBe(2);
  });

  it('computes masteryPercent rounded against the full 42-hadith universe', () => {
    const progress = [progressAt({ hadithNumber: 1, state: 'mastered' })];
    const stats = computeStats(progress, today);
    expect(stats.masteryPercent).toBe(Math.round((1 / HADITHS.length) * 100));
  });
});

describe('activityWindow', () => {
  it('always returns exactly windowDays points, oldest first', () => {
    const points = activityWindow([], '2026-03-10', 7, 20);
    expect(points).toHaveLength(7);
    expect(points[0]!.date).toBe('2026-03-04');
    expect(points[6]!.date).toBe('2026-03-10');
  });

  it('fills zero-activity days with repetitions: 0, goalMet: false', () => {
    const points = activityWindow([], '2026-03-10', 3, 20);
    for (const p of points) {
      expect(p.repetitions).toBe(0);
      expect(p.goalMet).toBe(false);
    }
  });

  it('marks goalMet true only when repetitions meet or exceed dailyGoal', () => {
    const activity: DailyActivity[] = [{ activityDate: '2026-03-10', repetitions: 20 }];
    const points = activityWindow(activity, '2026-03-10', 1, 20);
    expect(points[0]!.repetitions).toBe(20);
    expect(points[0]!.goalMet).toBe(true);
  });

  it('does not mark goalMet when just under the goal', () => {
    const activity: DailyActivity[] = [{ activityDate: '2026-03-10', repetitions: 19 }];
    const points = activityWindow(activity, '2026-03-10', 1, 20);
    expect(points[0]!.goalMet).toBe(false);
  });
});

describe('computeStreak', () => {
  it('is zero when today has no activity', () => {
    expect(computeStreak([], '2026-03-10')).toBe(0);
  });

  it('counts consecutive days back from today', () => {
    const activity: DailyActivity[] = [
      { activityDate: '2026-03-10', repetitions: 5 },
      { activityDate: '2026-03-09', repetitions: 3 },
      { activityDate: '2026-03-08', repetitions: 1 },
    ];
    expect(computeStreak(activity, '2026-03-10')).toBe(3);
  });

  it('stops counting at the first gap', () => {
    const activity: DailyActivity[] = [
      { activityDate: '2026-03-10', repetitions: 5 },
      { activityDate: '2026-03-08', repetitions: 1 }, // gap at 03-09
    ];
    expect(computeStreak(activity, '2026-03-10')).toBe(1);
  });

  it('does not count a day with zero repetitions as active', () => {
    const activity: DailyActivity[] = [{ activityDate: '2026-03-10', repetitions: 0 }];
    expect(computeStreak(activity, '2026-03-10')).toBe(0);
  });
});
