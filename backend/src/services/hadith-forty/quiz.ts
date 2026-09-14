// Quiz generation and grading.
//
// Generation is fully deterministic: the same seed produces the same
// questions in the same order. The server stores only the seed, then
// regenerates the questions at submit time to grade — so answers are never
// sent to the client at all, and the client can only ever submit option
// indexes.
//
// Pure module: no DOM, no React, no DB.

import { HADITHS, getHadith } from './content';
import { ClientQuizQuestion, Hadith, QuizGrade, QuizQuestion } from './types';

export const QUIZ_BLANK_QUESTIONS = 3;
/**
 * Fixed question count per quiz. Short matn (e.g. hadith 32, "لا ضرر ولا
 * ضرار") can't support three fill-blank questions, so the shortfall is made
 * up with source-citation questions instead — the question count must never
 * vary hadith to hadith.
 */
export const QUIZ_TOTAL_QUESTIONS = QUIZ_BLANK_QUESTIONS + 2;
export const QUIZ_OPTIONS_PER_QUESTION = 4;
/** Pass threshold for promoting a hadith in the review ladder. */
export const QUIZ_PASS_RATIO = 0.8;

/** Blank marker inside a question body — the frontend renders this as a visible input. */
export const BLANK_TOKEN = '[[blank]]';

/** Deterministic PRNG (mulberry32) — never Math.random(), so generation can be replayed from a stored seed. */
export function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const a = out[i] as T;
    const b = out[j] as T;
    out[i] = b;
    out[j] = a;
  }
  return out;
}

const PUNCTUATION = /[«»"،.؛:؟!()﴿﴾]/g;
const MIN_WORD_LENGTH = 5;

function stripPunctuation(word: string): string {
  return word.replace(PUNCTUATION, '').trim();
}

function contentWords(text: string): string[] {
  return text
    .split(/\s+/)
    .map(stripPunctuation)
    .filter((w) => w.length >= MIN_WORD_LENGTH);
}

/** Words from other hadith, usable as distractors. */
function distractorPool(exclude: number): string[] {
  const pool = new Set<string>();
  for (const h of HADITHS) {
    if (h.number === exclude) continue;
    for (const w of contentWords(h.text)) pool.add(w);
  }
  return [...pool].sort();
}

function buildBlankQuestion(
  hadith: Hadith,
  word: string,
  pool: readonly string[],
  random: () => number
): QuizQuestion | null {
  const words = hadith.text.split(/\s+/);
  const index = words.findIndex((w) => stripPunctuation(w) === word);
  if (index === -1) return null;
  const before = words.slice(Math.max(0, index - 5), index).join(' ');
  const after = words.slice(index + 1, index + 6).join(' ');
  const distractors = shuffle(
    pool.filter((w) => w !== word),
    random
  ).slice(0, QUIZ_OPTIONS_PER_QUESTION - 1);
  const options = shuffle([word, ...distractors], random);
  return {
    kind: 'fill-blank',
    body: `${before} ${BLANK_TOKEN} ${after}`.trim(),
    options,
    answerIndex: options.indexOf(word),
  };
}

function buildChoiceQuestion(
  kind: 'narrator' | 'topic' | 'source',
  body: string,
  answer: string,
  candidates: readonly string[],
  random: () => number
): QuizQuestion {
  const distractors = shuffle([...new Set(candidates.filter((c) => c !== answer))], random).slice(
    0,
    QUIZ_OPTIONS_PER_QUESTION - 1
  );
  const options = shuffle([answer, ...distractors], random);
  return { kind, body, options, answerIndex: options.indexOf(answer) };
}

/**
 * Generates the quiz for one hadith. Deterministic w.r.t. (hadithNumber, seed).
 * Throws if the hadith number doesn't exist.
 */
export function buildQuiz(hadithNumber: number, seed: number): QuizQuestion[] {
  const hadith = getHadith(hadithNumber);
  if (!hadith) throw new RangeError(`Unknown hadith number: ${hadithNumber}`);
  const random = createRandom(seed);
  const questions: QuizQuestion[] = [];

  const unique = [...new Set(contentWords(hadith.text))];
  const pool = distractorPool(hadithNumber);
  for (const word of shuffle(unique, random)) {
    if (questions.length >= QUIZ_BLANK_QUESTIONS) break;
    const q = buildBlankQuestion(hadith, word, pool, random);
    if (q) questions.push(q);
  }

  questions.push(
    buildChoiceQuestion(
      'narrator',
      hadith.title,
      hadith.narratorId,
      HADITHS.map((h) => h.narratorId),
      random
    )
  );
  questions.push(
    buildChoiceQuestion(
      'topic',
      `${hadith.text.split(/\s+/).slice(0, 12).join(' ')}…`,
      hadith.title,
      HADITHS.map((h) => h.title),
      random
    )
  );
  // Short matn can't fill three blanks — make up the shortfall with a
  // source-citation question so every hadith's quiz has the same length.
  if (questions.length < QUIZ_TOTAL_QUESTIONS) {
    questions.push(buildChoiceQuestion('source', hadith.title, hadith.source, HADITHS.map((h) => h.source), random));
  }
  if (questions.length !== QUIZ_TOTAL_QUESTIONS) {
    throw new RangeError(`Could not build a complete quiz for hadith ${hadithNumber}`);
  }

  return questions;
}

/** Strips answers before sending to the client. */
export function toClientQuiz(questions: readonly QuizQuestion[]): ClientQuizQuestion[] {
  return questions.map(({ kind, body, options }) => ({ kind, body, options }));
}

/**
 * Grades the client's answers. Any out-of-range or missing answer counts as
 * wrong rather than aborting grading — a malformed submission must never let
 * the client dodge evaluation entirely.
 */
export function gradeQuiz(questions: readonly QuizQuestion[], answers: readonly number[]): QuizGrade {
  const correctness = questions.map((q, i) => answers[i] === q.answerIndex);
  const score = correctness.filter(Boolean).length;
  const total = questions.length;
  return {
    score,
    total,
    passed: total > 0 && score >= Math.ceil(total * QUIZ_PASS_RATIO),
    correctness,
    answerIndexes: questions.map((q) => q.answerIndex),
  };
}

/** Random seed suitable for storage in an integer column. */
export function createSeed(): number {
  return Math.floor(Math.random() * 2_147_483_647) + 1;
}
