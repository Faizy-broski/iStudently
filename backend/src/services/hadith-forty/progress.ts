// Progress/activity derivations. Pure — no DOM, no React, no DB.

import { HADITHS } from './content';
import { addDays } from './date';
import { ActivityPoint, DailyActivity, HadithProgress, IsoDate, ProgressStats } from './types';

export function emptyProgress(hadithNumber: number): HadithProgress {
  return {
    hadithNumber,
    repetitions: 0,
    state: 'new',
    box: 0,
    dueOn: null,
    lastReviewedOn: null,
    isFavorite: false,
    note: '',
  };
}

export function computeStats(progress: readonly HadithProgress[], today: IsoDate): ProgressStats {
  const total = HADITHS.length;
  const mastered = progress.filter((p) => p.state === 'mastered').length;
  const learning = progress.filter((p) => p.state === 'learning').length;
  const totalRepetitions = progress.reduce((sum, p) => sum + p.repetitions, 0);
  const dueToday = progress.filter((p) => p.dueOn !== null && p.dueOn <= today).length;
  return {
    mastered,
    learning,
    total,
    totalRepetitions,
    dueToday,
    masteryPercent: total > 0 ? Math.round((mastered / total) * 100) : 0,
  };
}

/** Always exactly `windowDays` points, oldest first, even for days with zero activity — a bar chart needs every bar, not just non-zero ones. */
export function activityWindow(
  activity: readonly DailyActivity[],
  today: IsoDate,
  windowDays: number,
  dailyGoal: number
): ActivityPoint[] {
  const byDate = new Map(activity.map((a) => [a.activityDate, a.repetitions]));
  const points: ActivityPoint[] = [];
  for (let i = windowDays - 1; i >= 0; i--) {
    const date = addDays(today, -i);
    const repetitions = byDate.get(date) ?? 0;
    points.push({ date, repetitions, goalMet: repetitions >= dailyGoal });
  }
  return points;
}

/** Consecutive days of any activity, counting back from today. Not capped to the chart window — callers fetch a longer activity history precisely so this can see further back. */
export function computeStreak(activity: readonly DailyActivity[], today: IsoDate): number {
  const byDate = new Map(activity.map((a) => [a.activityDate, a.repetitions]));
  let streak = 0;
  let cursor = today;
  while ((byDate.get(cursor) ?? 0) > 0) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}
