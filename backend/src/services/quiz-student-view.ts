// What a student may see of a quiz question before the answers are revealed.
//
// Questions store their answers next to their content (quiz.service.ts autoGrade):
//   select/multiple  `answer` = options, one per line, correct ones prefixed with "*"
//   text/textarea    `answer` = model answer
//   gap              `answer` = text with blanks as __word__
//   matching         `answer` = "left::right" per line; correct = right i on left i
//   anatomy_label    `correct_answer` = { organId, model, hotspotId }
// Sending these to students leaked every correct answer. Until reveal (submitted AND the quiz has
// show_correct_answers), students get a view with the answers removed and matching rights shuffled
// per student. Stored data and autoGrade are unchanged: matching answers are translated back to the
// canonical order before grading/storage (toCanonicalMatchingAnswer).

import crypto from 'crypto'

export interface RawQuestion {
  id?: string
  title?: string
  type: string
  description?: string | null
  answer?: string | null
  correct_answer?: unknown
  [key: string]: unknown
}

const SECRET =
  process.env.QUIZ_SHUFFLE_SECRET ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'studently-dev-quiz-shuffle'

function matchingLines(answer: string | null | undefined): [string, string][] {
  return (answer || '')
    .split('\n')
    .map((line) => line.split('::'))
    .filter((parts): parts is [string, string] => parts.length === 2)
    .map(([l, r]) => [l.trim(), r.trim()])
}

/**
 * Permutation for a student's matching question: displayed position p shows canonical right
 * perm[p]. Seeded with a server secret so students cannot predict it, stable per (map, student)
 * so reloading shows the same order. Never the identity for n > 1 (that would reveal the answer).
 */
export function matchingPermutation(mapId: string, studentId: string, n: number): number[] {
  const perm = Array.from({ length: n }, (_, i) => i)
  if (n < 2) return perm
  let counter = 0
  let pool: Buffer = Buffer.alloc(0)
  const nextUint = () => {
    if (pool.length < 4) {
      pool = crypto.createHmac('sha256', SECRET).update(`${mapId}:${studentId}:${counter++}`).digest()
    }
    const v = pool.readUInt32BE(0)
    pool = pool.subarray(4)
    return v
  }
  for (let i = n - 1; i > 0; i--) {
    const j = nextUint() % (i + 1)
    ;[perm[i], perm[j]] = [perm[j], perm[i]]
  }
  if (perm.every((v, i) => v === i)) perm.push(perm.shift()!) // rotate away from identity
  return perm
}

/** Student's displayed-index answer ("2||0||") -> canonical answer for grading/storage. */
export function toCanonicalMatchingAnswer(answer: string, perm: number[]): string {
  return answer
    .split('||')
    .map((v) => {
      const k = parseInt(v.trim(), 10)
      return Number.isInteger(k) && k >= 0 && k < perm.length ? String(perm[k]) : ''
    })
    .join('||')
}

/** Stored canonical answer -> displayed indices for the student's shuffled view. */
export function toDisplayedMatchingAnswer(answer: string, perm: number[]): string {
  const inverse: number[] = []
  perm.forEach((canonical, displayed) => (inverse[canonical] = displayed))
  return answer
    .split('||')
    .map((v) => {
      const c = parseInt(v.trim(), 10)
      return Number.isInteger(c) && inverse[c] !== undefined ? String(inverse[c]) : ''
    })
    .join('||')
}

/** The question as a student may see it before reveal. */
export function toStudentQuestion<Q extends RawQuestion>(question: Q, mapId: string, studentId: string): Q {
  const q: Q = { ...question, correct_answer: null }
  switch (question.type) {
    case 'select':
    case 'multiple':
      q.answer = (question.answer || '')
        .split('\n')
        .filter(Boolean)
        .map((o) => o.replace(/^\s*\*/, ''))
        .join('\n')
      break
    case 'gap':
      q.answer = (question.answer || '').replace(/__(.+?)__/g, '____')
      break
    case 'matching': {
      const lines = matchingLines(question.answer)
      const perm = matchingPermutation(mapId, studentId, lines.length)
      q.answer = lines.map(([left], p) => `${left}::${lines[perm[p]][1]}`).join('\n')
      break
    }
    case 'anatomy_label': {
      const ca = question.correct_answer as { organId?: string; model?: string } | null
      q.correct_answer = ca?.organId ? { organId: ca.organId, model: ca.model } : null
      q.answer = null
      break
    }
    default:
      q.answer = null
  }
  return q
}

/** Number of matching pairs (for building permutations from raw questions). */
export function matchingPairCount(answer: string | null | undefined): number {
  return matchingLines(answer).length
}
