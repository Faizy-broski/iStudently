import { BLANK_TOKEN, QUIZ_OPTIONS_PER_QUESTION, QUIZ_TOTAL_QUESTIONS, buildQuiz, createRandom, gradeQuiz, shuffle, toClientQuiz } from './quiz';
import { HADITHS, getHadith } from './content';

describe('createRandom (deterministic PRNG)', () => {
  it('the same seed produces the same sequence, a different seed does not', () => {
    const first = createRandom(42);
    const again = createRandom(42);
    const other = createRandom(43);
    const seq1 = Array.from({ length: 5 }, () => first());
    const seq2 = Array.from({ length: 5 }, () => again());
    const seq3 = Array.from({ length: 5 }, () => other());
    expect(seq2).toEqual(seq1);
    expect(seq3).not.toEqual(seq1);
    for (const v of seq1) expect(v >= 0 && v < 1).toBe(true);
  });
});

describe('shuffle', () => {
  it('loses no element and duplicates none', () => {
    const input = [1, 2, 3, 4, 5, 6, 7];
    const out = shuffle(input, createRandom(7));
    expect([...out].sort((a, b) => a - b)).toEqual(input);
  });

  it('does not mutate the original array', () => {
    const input = [1, 2, 3, 4, 5, 6, 7];
    shuffle(input, createRandom(7));
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('handles a single-element array without touching randomness', () => {
    expect(shuffle([1], createRandom(1))).toEqual([1]);
  });

  it('handles an empty array', () => {
    expect(shuffle([], createRandom(1))).toEqual([]);
  });
});

describe('buildQuiz', () => {
  it('every hadith produces exactly QUIZ_TOTAL_QUESTIONS, each with 4 unique options and a valid answer index', () => {
    for (const h of HADITHS) {
      const quiz = buildQuiz(h.number, h.number * 1000 + 7);
      expect(quiz).toHaveLength(QUIZ_TOTAL_QUESTIONS);
      for (const q of quiz) {
        expect(q.options).toHaveLength(QUIZ_OPTIONS_PER_QUESTION);
        expect(new Set(q.options).size).toBe(QUIZ_OPTIONS_PER_QUESTION);
        expect(q.answerIndex >= 0 && q.answerIndex < QUIZ_OPTIONS_PER_QUESTION).toBe(true);
        expect(q.options[q.answerIndex]).toBeDefined();
      }
    }
  });

  it('a hadith whose matn is too short for 3 blanks is padded with a source question, keeping the total fixed', () => {
    // Find the shortest-matn hadith by content-word count rather than hardcoding a number,
    // so this test stays valid if content.ts is edited/corrected later.
    const shortest = [...HADITHS].sort((a, b) => a.text.length - b.text.length)[0]!;
    const quiz = buildQuiz(shortest.number, 77);
    expect(quiz).toHaveLength(QUIZ_TOTAL_QUESTIONS);
    if (quiz.filter((q) => q.kind === 'fill-blank').length < 3) {
      expect(quiz.some((q) => q.kind === 'source')).toBe(true);
    }
  });

  it('fill-blank questions carry exactly one blank marker, and the answer is drawn from the hadith text itself', () => {
    for (const h of HADITHS) {
      const blanks = buildQuiz(h.number, 12345).filter((q) => q.kind === 'fill-blank');
      for (const q of blanks) {
        expect(q.body.split(BLANK_TOKEN).length - 1).toBe(1);
        const answer = q.options[q.answerIndex] as string;
        expect(h.text.includes(answer)).toBe(true);
      }
    }
  });

  it('the topic question answer is the hadith title, and the narrator question answer is its narratorId', () => {
    const hadith = getHadith(13)!;
    const quiz = buildQuiz(13, 999);
    const topic = quiz.find((q) => q.kind === 'topic')!;
    const narrator = quiz.find((q) => q.kind === 'narrator')!;
    expect(topic.options[topic.answerIndex]).toBe(hadith.title);
    expect(narrator.options[narrator.answerIndex]).toBe(hadith.narratorId);
  });

  it('generation is deterministic: the same seed reproduces the identical quiz', () => {
    const first = buildQuiz(20, 555);
    const second = buildQuiz(20, 555);
    expect(second).toEqual(first);
    expect(buildQuiz(20, 556)).not.toEqual(first);
  });

  it('throws RangeError for an unknown hadith number', () => {
    expect(() => buildQuiz(99, 1)).toThrow(RangeError);
  });
});

describe('toClientQuiz', () => {
  it('the client version never carries an answer index', () => {
    const quiz = buildQuiz(1, 2026);
    const client = toClientQuiz(quiz);
    const serialised = JSON.stringify(client);
    expect(serialised.includes('answerIndex')).toBe(false);
    for (const q of client) {
      expect(Object.keys(q).sort()).toEqual(['body', 'kind', 'options']);
    }
    expect(client).toHaveLength(quiz.length);
  });
});

describe('gradeQuiz', () => {
  const quiz = buildQuiz(5, 31337);
  const correct = quiz.map((q) => q.answerIndex);

  it('all-correct answers give a perfect score and a pass', () => {
    const grade = gradeQuiz(quiz, correct);
    expect(grade.score).toBe(QUIZ_TOTAL_QUESTIONS);
    expect(grade.total).toBe(QUIZ_TOTAL_QUESTIONS);
    expect(grade.passed).toBe(true);
    expect(grade.correctness).toEqual(correct.map(() => true));
  });

  it('the pass threshold is 4 of 5; 3 of 5 is not enough', () => {
    const fourRight = [...correct];
    fourRight[0] = (correct[0]! + 1) % QUIZ_OPTIONS_PER_QUESTION;
    expect(gradeQuiz(quiz, fourRight).score).toBe(4);
    expect(gradeQuiz(quiz, fourRight).passed).toBe(true);

    const threeRight = [...fourRight];
    threeRight[1] = (correct[1]! + 1) % QUIZ_OPTIONS_PER_QUESTION;
    expect(gradeQuiz(quiz, threeRight).score).toBe(3);
    expect(gradeQuiz(quiz, threeRight).passed).toBe(false);
  });

  it('missing or malformed answers count as wrong, not as an aborted grade', () => {
    expect(gradeQuiz(quiz, []).score).toBe(0);
    expect(gradeQuiz(quiz, []).passed).toBe(false);
    expect(gradeQuiz(quiz, [99, -1, 7, 3, 2]).total).toBe(QUIZ_TOTAL_QUESTIONS);
  });

  it('exposes the correct answer indexes for post-grade review', () => {
    expect(gradeQuiz(quiz, correct).answerIndexes).toEqual(correct);
  });

  it('an empty question set is never a pass', () => {
    const grade = gradeQuiz([], []);
    expect(grade.total).toBe(0);
    expect(grade.passed).toBe(false);
  });
});
