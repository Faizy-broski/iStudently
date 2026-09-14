// Leitner-box spaced repetition. Pure — no DOM, no React, no DB.

import { HADITHS } from './content';
import { addDays } from './date';
import { HadithProgress, IsoDate, ReviewOutcome } from './types';

/** Days-until-next-review per box, indexed by box number. Box 5 is the ceiling — passing again just re-schedules at the same longest interval. */
export const BOX_INTERVALS_DAYS = [0, 1, 3, 7, 16, 35] as const;
export const MAX_BOX = BOX_INTERVALS_DAYS.length - 1;

export interface ScheduleResult {
  box: number;
  dueOn: IsoDate;
  lastReviewedOn: IsoDate;
}

/** A fail resets straight to box 0 (due again immediately) — no partial credit for a wrong review. */
export function schedule(currentBox: number, outcome: ReviewOutcome, today: IsoDate): ScheduleResult {
  const nextBox = outcome === 'pass' ? Math.min(currentBox + 1, MAX_BOX) : 0;
  return {
    box: nextBox,
    dueOn: addDays(today, BOX_INTERVALS_DAYS[nextBox]),
    lastReviewedOn: today,
  };
}

export function isDue(progress: Pick<HadithProgress, 'dueOn'>, today: IsoDate): boolean {
  return progress.dueOn !== null && progress.dueOn <= today;
}

/**
 * Builds today's session: due items first (earliest-due first), then
 * not-yet-started hadith (in canonical number order) fill any remaining
 * slots, capped at sessionCap. `progress` only ever contains rows for hadith
 * the learner has already touched — untouched hadith have no row at all, so
 * this reads the full 42-hadith universe from content.ts to find them.
 */
export function buildSession(progress: readonly HadithProgress[], today: IsoDate, sessionCap: number): number[] {
  const byNumber = new Map(progress.map((p) => [p.hadithNumber, p]));
  const due: HadithProgress[] = [];
  const fresh: number[] = [];

  for (const h of HADITHS) {
    const p = byNumber.get(h.number);
    if (p && isDue(p, today)) {
      due.push(p);
    } else if (!p || p.state === 'new') {
      fresh.push(h.number);
    }
  }

  due.sort((a, b) => (a.dueOn as string).localeCompare(b.dueOn as string));
  return [...due.map((p) => p.hadithNumber), ...fresh].slice(0, Math.max(0, sessionCap));
}
