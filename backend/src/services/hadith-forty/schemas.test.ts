import {
  repetitionInputSchema,
  reviewInputSchema,
  flagsInputSchema,
  settingsInputSchema,
  quizSubmitInputSchema,
} from './schemas';

describe('repetitionInputSchema', () => {
  it('accepts hadith numbers 1..42', () => {
    expect(repetitionInputSchema.safeParse({ hadithNumber: 1 }).success).toBe(true);
    expect(repetitionInputSchema.safeParse({ hadithNumber: 42 }).success).toBe(true);
  });

  it('rejects 0, 43, and non-integers', () => {
    expect(repetitionInputSchema.safeParse({ hadithNumber: 0 }).success).toBe(false);
    expect(repetitionInputSchema.safeParse({ hadithNumber: 43 }).success).toBe(false);
    expect(repetitionInputSchema.safeParse({ hadithNumber: 1.5 }).success).toBe(false);
  });

  it('defaults delta to 1 when omitted', () => {
    const parsed = repetitionInputSchema.parse({ hadithNumber: 3 });
    expect(parsed.delta).toBe(1);
  });

  it('rejects delta above 20 or at/below 0', () => {
    expect(repetitionInputSchema.safeParse({ hadithNumber: 3, delta: 21 }).success).toBe(false);
    expect(repetitionInputSchema.safeParse({ hadithNumber: 3, delta: 0 }).success).toBe(false);
    expect(repetitionInputSchema.safeParse({ hadithNumber: 3, delta: 20 }).success).toBe(true);
  });
});

describe('reviewInputSchema', () => {
  it('accepts pass/fail only', () => {
    expect(reviewInputSchema.safeParse({ hadithNumber: 2, outcome: 'pass' }).success).toBe(true);
    expect(reviewInputSchema.safeParse({ hadithNumber: 2, outcome: 'fail' }).success).toBe(true);
    expect(reviewInputSchema.safeParse({ hadithNumber: 2, outcome: 'mastered' }).success).toBe(false);
  });
});

describe('flagsInputSchema', () => {
  it('rejects a request with no actual flag fields', () => {
    expect(flagsInputSchema.safeParse({ hadithNumber: 2 }).success).toBe(false);
  });

  it('accepts a request with just isFavorite', () => {
    expect(flagsInputSchema.safeParse({ hadithNumber: 2, isFavorite: true }).success).toBe(true);
  });

  it('accepts a request with just state', () => {
    expect(flagsInputSchema.safeParse({ hadithNumber: 2, state: 'mastered' }).success).toBe(true);
  });

  it('accepts a request with just note', () => {
    expect(flagsInputSchema.safeParse({ hadithNumber: 2, note: 'hello' }).success).toBe(true);
  });

  it('rejects a note over 2000 characters', () => {
    expect(flagsInputSchema.safeParse({ hadithNumber: 2, note: 'x'.repeat(2001) }).success).toBe(false);
  });

  it('accepts a note at exactly 2000 characters', () => {
    expect(flagsInputSchema.safeParse({ hadithNumber: 2, note: 'x'.repeat(2000) }).success).toBe(true);
  });
});

describe('settingsInputSchema', () => {
  it('rejects an empty request', () => {
    expect(settingsInputSchema.safeParse({}).success).toBe(false);
  });

  it('rejects out-of-range values', () => {
    expect(settingsInputSchema.safeParse({ dailyGoal: 501 }).success).toBe(false);
    expect(settingsInputSchema.safeParse({ sessionCap: 43 }).success).toBe(false);
  });

  it('accepts valid values for both fields together', () => {
    expect(settingsInputSchema.safeParse({ dailyGoal: 20, sessionCap: 10 }).success).toBe(true);
  });

  it('accepts a partial update with only one field', () => {
    expect(settingsInputSchema.safeParse({ dailyGoal: 20 }).success).toBe(true);
  });
});

describe('quizSubmitInputSchema', () => {
  const id = '4d0d1c9e-6d0b-4a0e-9a3e-6a1b2c3d4e5f';

  it('accepts a valid attempt id and answers within range', () => {
    expect(quizSubmitInputSchema.safeParse({ attemptId: id, answers: [0, 1, 2, 3, 0] }).success).toBe(true);
  });

  it('rejects a non-UUID attemptId', () => {
    expect(quizSubmitInputSchema.safeParse({ attemptId: 'not-a-uuid', answers: [0, 1, 2, 3, 0] }).success).toBe(false);
  });

  it('rejects an answer index outside the valid option range (0..3)', () => {
    expect(quizSubmitInputSchema.safeParse({ attemptId: id, answers: [0, 1, 2, 3, 9] }).success).toBe(false);
  });

  it('accepts an empty-ish but non-empty answers array', () => {
    expect(quizSubmitInputSchema.safeParse({ attemptId: id, answers: [0] }).success).toBe(true);
  });

  it('rejects a client attempt to inject score/passed — extra keys are silently dropped, not merged', () => {
    const parsed = quizSubmitInputSchema.parse({
      attemptId: id,
      answers: [0, 0, 0, 0, 0],
      score: 5,
      passed: true,
    } as unknown);
    expect(Object.keys(parsed).sort()).toEqual(['answers', 'attemptId']);
  });
});
