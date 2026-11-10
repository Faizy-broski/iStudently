import { describe, expect, it } from 'vitest'

import {
  compareSheets,
  gradeSheet,
  itemAnalysis,
  kr20,
  mapToA,
  markingFairness,
  neighbourPairs,
  normalizeAnswers,
  objectiveMastery,
  parseAnswerString,
  parseKeyCell,
  questionSummary,
  roundHalf,
  secretDigits,
  type JaKeyDef,
} from './assessment'
import { seatingMap } from './control'

const key5: JaKeyDef = { keyA: ['أ', 'ب', 'ج', 'د', 'أ'], max: 10, count: 5 }

describe('answer and key parsing', () => {
  it('normalises letters, dashes, Latin and alef forms', () => {
    expect(parseAnswerString('ابجد-', 5)).toEqual(['أ', 'ب', 'ج', 'د', ''])
    expect(parseAnswerString('إ آ هـ', 3)).toEqual(['أ', 'أ', 'ه'])
    expect(parseAnswerString('abcde', 5)).toEqual(['أ', 'ب', 'ج', 'د', 'ه'])
    expect(parseAnswerString('أب', 4)).toEqual(['أ', 'ب', '', ''])
  })
  it('wildcards never count', () => {
    expect(parseAnswerString('*?', 2)).toEqual(['?', '?'])
    expect(normalizeAnswers(['أب', 'ج'], 2)).toEqual(['?', 'ج'])
  })
  it('keys accept several answers', () => {
    expect(parseKeyCell('أب')).toEqual(['أ', 'ب'])
    expect(parseKeyCell('أ،ب')).toEqual(['أ', 'ب'])
    expect(parseKeyCell('a,e')).toEqual(['أ', 'ه'])
    expect(parseKeyCell('')).toEqual([])
  })
})

describe('gradeSheet', () => {
  it('scales to the maximum and rounds to the nearest half', () => {
    const g = gradeSheet(key5, parseAnswerString('أبجبب', 5))
    expect(g.correct).toBe(3)
    expect(g.wrong).toBe(2)
    expect(g.wrongQuestions).toEqual([4, 5])
    expect(g.score).toBe(6)
    expect(roundHalf(6.24)).toBe(6)
    expect(roundHalf(6.25)).toBe(6.5)
  })
  it('handles credit-to-all and excluded questions', () => {
    const def: JaKeyDef = { ...key5, handling: ['normal', 'all', 'excluded', 'normal', 'normal'] }
    const g = gradeSheet(def, parseAnswerString('-----', 5))
    expect(g.possible).toBe(4)
    expect(g.raw).toBe(1)
    expect(g.marks[2]).toBe('excluded')
    expect(g.score).toBe(2.5)
  })
  it('version B falls back to A per question', () => {
    const def: JaKeyDef = { ...key5, keyB: ['ب', null, null, null, null] }
    expect(gradeSheet(def, parseAnswerString('بب', 5), 'B').correct).toBe(2)
    expect(gradeSheet(def, parseAnswerString('بب', 5), 'A').correct).toBe(1)
  })
  it('uses question points', () => {
    const def: JaKeyDef = { ...key5, points: [2, 1, 1, 1, 1] }
    expect(gradeSheet(def, parseAnswerString('أ', 5)).raw).toBe(2)
  })
})

describe('item analysis and KR-20', () => {
  it('KR-20 matches a hand-computed example', () => {
    // 5 students × 4 items; totals 4,3,2,1,0 → σ² = 2; p = .8,.6,.4,.2 → Σpq = .8; KR-20 = 4/3 × (1 − .4) = .8
    const m = [
      [1, 1, 1, 1],
      [1, 1, 1, 0],
      [1, 1, 0, 0],
      [1, 0, 0, 0],
      [0, 0, 0, 0],
    ]
    expect(kr20(m)).toBeCloseTo(0.8, 6)
    expect(kr20([[1, 1]])).toBeNull()
  })
  it('discrimination and verdicts', () => {
    const def: JaKeyDef = { keyA: ['أ', 'ب'], max: 2, count: 2 }
    // Q1: strong students right → positive D. Q2: only weak students right → negative D → check key.
    const sheets = [
      { answers: parseAnswerString('أج', 2), version: 'A' as const },
      { answers: parseAnswerString('أج', 2), version: 'A' as const },
      { answers: parseAnswerString('أج', 2), version: 'A' as const },
      { answers: parseAnswerString('جب', 2), version: 'A' as const },
      { answers: parseAnswerString('جب', 2), version: 'A' as const },
    ]
    const a = itemAnalysis(def, sheets, 4)
    expect(a.groupSize).toBe(1)
    expect(a.items[0].p).toBeCloseTo(0.6)
    expect(a.items[0].d).toBe(1)
    expect(a.items[1].d).toBe(-1)
    expect(a.items[1].verdict).toBe('check_key')
    expect(a.items[0].noteOptions.unused).toEqual(['ب', 'د'])
    expect(a.items[1].notes).toContain('misconception')
  })
  it('question summary gives % correct and the commonest wrong answer', () => {
    const s = questionSummary(key5, [
      { answers: parseAnswerString('ب', 5), version: 'A' },
      { answers: parseAnswerString('ب', 5), version: 'A' },
      { answers: parseAnswerString('أ', 5), version: 'A' },
    ])
    expect(s[0].pctCorrect).toBeCloseTo(1 / 3)
    expect(s[0].commonWrong).toBe('ب')
  })
})

describe('answer similarity', () => {
  it('counts identical wrong answers only and flags at the thresholds', () => {
    const def: JaKeyDef = { keyA: Array(10).fill('أ'), max: 10, count: 10 }
    const a = { answers: parseAnswerString('أأبببببأأأ', 10), version: 'A' as const }
    const b = { answers: parseAnswerString('أأببببجأأأ', 10), version: 'A' as const }
    const r = compareSheets(def, a, b)
    expect(r.identicalWrong).toBe(4)
    expect(r.wrongA).toBe(5)
    expect(r.ratio).toBeCloseTo(0.8)
    expect(r.flagged).toBe(true)
    expect(compareSheets(def, a, b, 5).flagged).toBe(false)
  })
  it('neighbour pairs: beside, two along, behind', () => {
    const pairs = neighbourPairs(seatingMap(6, 3))
    expect(pairs).toContainEqual({ a: 1, b: 2, relation: 'beside' })
    expect(pairs).toContainEqual({ a: 1, b: 3, relation: 'two_along' })
    expect(pairs.some((p) => p.relation === 'behind')).toBe(true)
  })
})

describe('objectives and version mapping', () => {
  it('maps B questions to A and computes mastery', () => {
    const def: JaKeyDef = { keyA: ['أ', 'ب', 'ج', 'د'], keyB: ['ب', 'أ', 'د', 'ج'], max: 4, count: 4 }
    const m = { objectives: [0, 0, 1, 1], bToA: [2, 1, 4, 3] }
    const sheetB = parseAnswerString('بأدب', 4)
    const r = objectiveMastery(def, m, sheetB, 'B', 2)
    expect(r.pct).toEqual([1, 0.5])
    expect(r.levels).toEqual(['mastered', 'close'])
    expect(r.weakest).toBe(1)
    expect(mapToA(m, sheetB, 'B', 4)).toEqual(['أ', 'ب', 'ب', 'د'])
  })
})

describe('marking fairness between sections', () => {
  it('adjusts for section strength', () => {
    // Section A is strong in everything; section B is weak in everything except maths marked leniently.
    const rows = [
      { studentId: '1', section: 'A', pct: { math: 0.9, arabic: 0.9, science: 0.9 } },
      { studentId: '2', section: 'A', pct: { math: 0.8, arabic: 0.8, science: 0.8 } },
      { studentId: '3', section: 'B', pct: { math: 0.7, arabic: 0.5, science: 0.5 } },
      { studentId: '4', section: 'B', pct: { math: 0.6, arabic: 0.4, science: 0.4 } },
    ]
    const r = markingFairness(rows)
    const bMath = r.cells.find((c) => c.section === 'B' && c.subject === 'math')!
    const aMath = r.cells.find((c) => c.section === 'A' && c.subject === 'math')!
    expect(bMath.gap).toBeCloseTo(0.1)
    expect(aMath.gap).toBeCloseTo(-0.1)
    expect(bMath.flagged).toBe(true)
    expect(r.gradeMean.math).toBeCloseTo(0.75)
  })
})

it('secret digits pad to 7', () => {
  expect(secretDigits(4321)).toEqual([0, 0, 0, 4, 3, 2, 1])
})
