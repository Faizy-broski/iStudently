// zod input validation. Pure — no DOM, no React, no DB.
//
// Zod's default object mode strips unrecognized keys rather than rejecting
// or passing them through — so a client that tries to send `{ attemptId,
// answers, score: 100 }` to quiz/submit silently loses the `score` field at
// `.parse()` time. That's the entire enforcement of "the client can never
// send a grade" (see schemas.test.ts), not something coded separately.

import { z } from 'zod';

export const repetitionInputSchema = z.object({
  hadithNumber: z.number().int().min(1).max(42),
  // Client sends "I repeated it" with no count — defaults to one repetition
  // per request; capped at 20 so a malicious/buggy client can't inflate a
  // student's count in a single call (matches the original spec's own test).
  delta: z.number().int().min(1).max(20).default(1),
});
export type RepetitionInput = z.infer<typeof repetitionInputSchema>;

export const reviewInputSchema = z.object({
  hadithNumber: z.number().int().min(1).max(42),
  outcome: z.enum(['pass', 'fail']),
});
export type ReviewInput = z.infer<typeof reviewInputSchema>;

export const flagsInputSchema = z
  .object({
    hadithNumber: z.number().int().min(1).max(42),
    isFavorite: z.boolean().optional(),
    state: z.enum(['new', 'learning', 'mastered']).optional(),
    note: z.string().max(2000).optional(),
  })
  // At least one actual flag must be present — {hadithNumber} alone is a
  // no-op request and rejected rather than silently accepted (matches the
  // original spec's own test).
  .refine((v) => v.isFavorite !== undefined || v.state !== undefined || v.note !== undefined, {
    message: 'At least one of isFavorite, state, or note must be provided',
  });
export type FlagsInput = z.infer<typeof flagsInputSchema>;

export const settingsInputSchema = z
  .object({
    dailyGoal: z.number().int().min(1).max(500).optional(),
    sessionCap: z.number().int().min(1).max(42).optional(),
  })
  // {} would otherwise silently no-op the update — rejected instead, same
  // "at least one field" convention as flagsInputSchema above.
  .refine((v) => v.dailyGoal !== undefined || v.sessionCap !== undefined, {
    message: 'At least one of dailyGoal or sessionCap must be provided',
  });
export type SettingsInput = z.infer<typeof settingsInputSchema>;

export const quizSubmitInputSchema = z.object({
  attemptId: z.string().uuid(),
  // Bounded to valid option indices (QUIZ_OPTIONS_PER_QUESTION - 1 = 3) —
  // an out-of-range index can never be a real answer, so it's rejected at
  // the schema boundary rather than silently graded as wrong deep in
  // gradeQuiz(). Length is checked against the actual question count
  // server-side (submitQuiz), not fixed here.
  answers: z.array(z.number().int().min(0).max(3)).min(1).max(10),
});
export type QuizSubmitInput = z.infer<typeof quizSubmitInputSchema>;
