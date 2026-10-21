import { describe, expect, it } from 'vitest'
import {
  analyzeMeasure,
  analyzeTest,
  groupOf,
  JG_DEFAULT_SCALE,
  profileFeedbackAr,
  readAnalysisAr,
  riskOf,
  rubricMark,
  JG_DEFAULT_RUBRIC,
  type JgQuestion,
} from './index'

// The prototype's sample test (sheet «تحليل الاختبار», 12 pupils × 10 questions) and its printed results.
const QUESTIONS: JgQuestion[] = [
  { max: 1, level: 'التذكر' }, { max: 1, level: 'الفهم' }, { max: 1, level: 'الفهم' }, { max: 2, level: 'التطبيق' }, { max: 2, level: 'التطبيق' },
  { max: 1, level: 'التذكر' }, { max: 2, level: 'التحليل' }, { max: 1, level: 'الفهم' }, { max: 2, level: 'التحليل' }, { max: 2, level: 'الإبداع' },
]
const SCORES = [
  [1, 1, 1, 2, 2, 1, 2, 0, 2, 2],
  [1, 1, 1, 2, 2, 1, 2, 0, 2, 2],
  [0, 1, 0, 2, 2, 1, 2, 0, 2, 0],
  [1, 1, 1, 2, 2, 1, 2, 1, 2, 1],
  [1, 1, 1, 2, 2, 0, 1, 0, 2, 0],
  [1, 1, 1, 0, 2, 0, 2, 0, 2, 1],
  [1, 0, 1, 1, 0, 0, 1, 1, 1, 1],
  [1, 1, 0, 2, 2, 1, 1, 1, 2, 0],
  [1, 1, 1, 2, 0, 1, 2, 1, 2, 0],
  [1, 1, 0, 2, 0, 0, 0, 1, 2, 0],
  [1, 0, 0, 1, 1, 1, 2, 1, 1, 2],
  [1, 1, 0, 2, 0, 1, 1, 1, 2, 0],
]
const r2 = (x: number | null) => (x === null ? null : Math.round(x * 100) / 100)

describe('test item analysis matches the prototype', () => {
  const a = analyzeTest(QUESTIONS, SCORES)

  it('summary: 12 pupils, mean 10.6, SD 2.33, alpha 0.41, SEM 1.79, weak reliability, 2 to review', () => {
    expect(a.count).toBe(12)
    expect(a.maxTotal).toBe(15)
    expect(Math.round(a.meanTotal! * 10) / 10).toBe(10.6)
    expect(r2(a.sd)).toBe(2.33)
    expect(r2(a.alpha)).toBe(0.41)
    expect(r2(a.sem)).toBe(1.79)
    expect(a.reliability).toBe('weak')
    expect(a.toReview).toBe(2)
    expect([a.groupSize, a.upperCut, a.lowerCut]).toEqual([3, 14, 9])
  })

  it('difficulty and discrimination per question', () => {
    expect(a.items.map((i) => r2(i.p))).toEqual([0.92, 0.83, 0.58, 0.83, 0.63, 0.67, 0.75, 0.58, 0.92, 0.38])
    expect(a.items.map((i) => r2(i.d))).toEqual([0, 0.33, 0.67, 0.17, 1, 0.67, 0.67, -0.67, 0.17, 0.67])
    expect(a.items.map((i) => i.verdict)).toEqual(['too_easy', 'good', 'excellent', 'weak', 'excellent', 'excellent', 'excellent', 'reversed', 'too_easy', 'excellent'])
  })

  it('ranks and Bloom mastery', () => {
    expect(a.students.map((s) => s.rank)).toEqual([1, 1, 6, 1, 6, 6, 11, 4, 4, 11, 6, 10])
    const m = Object.fromEntries(a.bloom.map((b) => [b.level, b.mastery === null ? null : Math.round(b.mastery * 100)]))
    expect(m).toEqual({ التذكر: 79, الفهم: 67, التطبيق: 73, التحليل: 83, التقويم: null, الإبداع: 38 })
  })
})

describe('early warning', () => {
  it('scores by the brief formula and picks the first matching indicator', () => {
    expect(riskOf({ pct: 0.45, struggling: 3, change: -12, gap: 25 })).toEqual({ score: 100, level: 'high', indicator: 'multi_struggle' })
    expect(riskOf({ pct: 0.6, struggling: 1, change: -3, gap: 5 })).toEqual({ score: 40, level: 'medium', indicator: 'one_struggle' })
    expect(riskOf({ pct: 0.7, struggling: 0, change: -7, gap: 0 })).toEqual({ score: 20, level: 'low', indicator: 'decline' })
    expect(riskOf({ pct: 0.9, struggling: 0, change: 4, gap: 0 })).toEqual({ score: 0, level: 'low', indicator: 'excellent' })
    expect(riskOf({ pct: 0.7, struggling: 0, change: null, gap: 22 }).indicator).toBe('gap')
  })
})

describe('learning groups', () => {
  it('splits at the follow and excellence rates', () => {
    expect([0.9, 0.85, 0.6, 0.5, 0.49, null].map((p) => groupOf(p))).toEqual(['enrichment', 'enrichment', 'reinforcement', 'reinforcement', 'remedial', null])
  })
})

describe('subject analysis card', () => {
  const values = [
    { studentId: 'a', name: 'أ', gender: 'male', value: 180 },
    { studentId: 'b', name: 'ب', gender: 'female', value: 150 },
    { studentId: 'c', name: 'ج', gender: 'female', value: 90 },
    { studentId: 'd', name: 'د', gender: 'male', value: 120 },
    { studentId: 'e', name: 'هـ', gender: 'male', value: null },
  ]
  const a = analyzeMeasure(values, 200, {
    scale: JG_DEFAULT_SCALE,
    compareWith: { max: 100, values: [{ studentId: 'a', name: 'أ', value: 80 }, { studentId: 'b', name: 'ب', value: 80 }, { studentId: 'c', name: 'ج', value: 40 }] },
  })

  it('statistics, bands from the grading scale (top first), boys vs girls', () => {
    expect([a.count, a.recorded, a.missing, a.highest, a.lowest, a.mean, a.range]).toEqual([5, 4, 1, 180, 90, 135, 90])
    expect(a.passRate).toBe(0.75)
    expect(a.bands.map((b) => [b.label, b.from, b.to, b.count])).toEqual([
      ['ممتاز', 170, null, 1], ['جيد جداً', 150, 170, 1], ['جيد', 130, 150, 0], ['مقبول', 100, 130, 1], ['ضعيف', 0, 100, 1],
    ])
    expect([a.boys, a.girls]).toEqual([150, 120])
    expect(a.remedial).toEqual([{ name: 'ج', value: 90 }])
  })

  it('compares with another measure on percentages', () => {
    expect(a.comparison).toMatchObject({ improved: 2, declined: 1, mostImproved: { name: 'أ', diffPct: 10 } })
    expect(readAnalysisAr(a, { subject: 'الرياضيات', learners: 'الطلاب' })[0]).toContain('68%')
  })
})

describe('student feedback and rubric', () => {
  it('feedback is gender-aware', () => {
    const subjects = [{ name: 'الرياضيات', pct: 0.95, trend: 6 }, { name: 'العلوم', pct: 0.55, trend: 2 }]
    expect(profileFeedbackAr(subjects, { gender: 'female', gradeCode: 7, overallPct: 0.75 })).toMatch(/^حققت التلميذة .* تتميز في الرياضيات .* تحتاج إلى تعزيز في العلوم/)
    expect(profileFeedbackAr(subjects, { gender: 'male', gradeCode: 11, overallPct: 0.75 })).toMatch(/^حقق الطالب/)
  })

  it('rubric converts levels to a fair mark', () => {
    expect(rubricMark(JG_DEFAULT_RUBRIC, [4, 4, 4, 4], 6)).toEqual({ mark: 6, level: 'متميّز' })
    expect(rubricMark(JG_DEFAULT_RUBRIC, [2, 3, 2, 4], 6)).toEqual({ mark: 4, level: 'متمكّن' })
    expect(rubricMark(JG_DEFAULT_RUBRIC, [null, null, null, null], 6)).toEqual({ mark: null, level: null })
  })
})
