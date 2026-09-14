// Shared types for the Forty Hadith of an-Nawawi module. Pure — no DOM, no
// React, no DB. Field names/shapes here are load-bearing: quiz.ts, scheduler.ts,
// progress.ts, the service layer, and the frontend all agree on these.

export type IsoDate = string; // YYYY-MM-DD, always school-offset local, never device-local

export type MemorizationState = 'new' | 'learning' | 'mastered';

/** Editorial thematic grouping (spec §6.6 of the original brief) — not a traditional taxonomy, just a UX filter. */
export type HadithCategory = 'aqidah' | 'ibadah' | 'akhlaq' | 'muamalat' | 'usrah' | 'ilm' | 'zuhd';

export interface Narrator {
  id: string;
  /** Full display name with the customary honorific, e.g. "أبو هريرة رضي الله عنه". */
  name: string;
  /** Short biographical note. */
  bio: string;
}

export interface Hadith {
  number: number; // 1..42
  /** Short thematic title used as a card heading and in quiz "topic" questions, e.g. "الأعمال بالنيات". */
  title: string;
  /** Full, unabridged Arabic matn. */
  text: string;
  narratorId: string; // key into NARRATORS
  /** Takhrīj — source citation, e.g. "رواه البخاري ومسلم". */
  source: string;
  category: HadithCategory;
}

export interface HadithProgress {
  hadithNumber: number;
  repetitions: number;
  state: MemorizationState;
  box: number; // 0..5, Leitner box
  dueOn: IsoDate | null;
  lastReviewedOn: IsoDate | null;
  isFavorite: boolean;
  note: string;
}

/** Self-graded outcome of a review — spaced-repetition input, not the quiz grade. */
export type ReviewOutcome = 'pass' | 'fail';

/** Raw daily activity as stored (one row per profile per day). */
export interface DailyActivity {
  activityDate: IsoDate;
  repetitions: number;
}

/** Derived, UI-ready point for a fixed N-day bar chart — always one entry per day in the window, even at zero. */
export interface ActivityPoint {
  date: IsoDate;
  repetitions: number;
  goalMet: boolean;
}

export interface ModuleSettings {
  dailyGoal: number;
  sessionCap: number;
}

export interface ProgressStats {
  mastered: number;
  learning: number;
  total: number;
  totalRepetitions: number;
  dueToday: number;
  masteryPercent: number;
}

export type QuizQuestionKind = 'fill-blank' | 'narrator' | 'topic' | 'source';

export interface QuizQuestion {
  kind: QuizQuestionKind;
  body: string;
  options: readonly string[];
  answerIndex: number;
}

export type ClientQuizQuestion = Omit<QuizQuestion, 'answerIndex'>;

export interface QuizGrade {
  score: number;
  total: number;
  passed: boolean;
  correctness: readonly boolean[];
  answerIndexes: readonly number[];
}
