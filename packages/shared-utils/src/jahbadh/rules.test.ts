import { describe, expect, it } from 'vitest'
import {
  ceilMark,
  computeSubject,
  decisionWithDetail,
  JG_DEFAULT_MONTH_NAMES,
  jgComponentsOf,
  jgGrade,
  jgRuleOf,
  maskMonths,
  monthlyMark,
  monthlyTrend,
  monthMark,
  resolveStudent,
  sectionRanks,
  sectionStagesOf,
  subItemsValue,
  type JgCell,
  type JgGradeDef,
  type JgStudentSubjectInput,
  type JgSubjectDef,
} from './index'

const gradeOf = (g: JgGradeDef) => ({ ...g, stageNames: [...g.stageNames] })

/** One subject: full marks unless `values` (component order, stage by stage) is given; null = not entered. */
function input(subject: JgSubjectDef, values?: (number | null)[]): JgStudentSubjectInput {
  const components = jgComponentsOf(subject)
  const cells: Record<string, JgCell> = {}
  components.forEach((c, i) => {
    const v = values ? values[i] ?? null : c.max
    if (v !== null) cells[c.id] = { value: v }
  })
  return { key: subject.key, name: subject.name, components, cells, round2: null }
}

function student(g: JgGradeDef, overrides: Record<string, (number | null)[]> = {}) {
  return g.subjects.map((s) => input(s, overrides[s.key]))
}

describe('sub-items (Appendix B, F1-3b)', () => {
  it('footnote items add up: grade 10 English activities W.B 2, N.B 1.5, R.C 2, O.W 1, C.A 1 → 7.5', () => {
    const act = jgGrade(10)!.subjects.find((s) => s.key === 'english')!.stages[0].find((c) => c.subItems)!
    expect(act.subItems!.map((x) => x.max)).toEqual([2, 2, 2, 1, 1])
    expect(subItemsValue([2, 1.5, 2, 1, 1].map((value) => ({ value })), act.divisor)).toEqual({ value: 7.5, partial: false })
  })

  it('branch tables divide: grade 6 Islamic activities 4 + 4 + 4 + 4 ÷ 4 = 4', () => {
    const act = jgGrade(6)!.subjects.find((s) => s.key === 'islamic')!.stages[0][0]
    expect(act.divisor).toBe(4)
    expect(subItemsValue([4, 4, 4, 4].map((value) => ({ value })), act.divisor).value).toBe(4)
  })

  it('a missing branch shows the partial value', () => {
    expect(subItemsValue([{ value: 4 }, { value: 3 }, undefined, { value: null }], 4)).toEqual({ value: 1.75, partial: true })
    expect(subItemsValue([undefined, undefined], 2)).toEqual({ value: null, partial: false })
    expect(subItemsValue([{ value: null, absent: true }], 1)).toEqual({ value: null, absent: true, partial: false })
  })

  it('rounds to 2 decimals like Excel ROUND', () => {
    expect(subItemsValue([10, 3, 4, 6].map((value) => ({ value })), 2).value).toBe(11.5)
    expect(subItemsValue([7, 3, 3, 5].map((value) => ({ value })), 6).value).toBe(3)
    expect(subItemsValue([5, 2, 2, 3].map((value) => ({ value })), 6).value).toBe(2)
    expect(subItemsValue([1].map((value) => ({ value })), 3).value).toBe(0.33)
  })
})

describe('monthly entry (B4, B5-14)', () => {
  it('activities: average, or best of average and last month', () => {
    expect(monthlyMark([4, 6, null, 8], 'activity')).toBe(6)
    expect(monthlyMark([4, 6, null, 8], 'activity', 'best_of_avg_last')).toBe(8)
    expect(monthlyMark([8, 6, 4], 'activity', 'best_of_avg_last')).toBe(6)
    expect(monthlyMark([null, null], 'activity')).toBeNull()
  })

  it('applications and grades 1–3 items always use the plain average', () => {
    expect(monthlyMark([4, 6, null, 8], 'applications', 'best_of_avg_last')).toBe(6)
    expect(monthlyMark([10, 11, 11], 'items', 'best_of_avg_last')).toBe(10.67)
  })

  it('unused months («—») are hidden from the computation', () => {
    expect(maskMonths([8, 10, 3, 3], JG_DEFAULT_MONTH_NAMES[2])).toEqual([8, 10, null, null])
    expect(monthlyMark(maskMonths([8, 10, 3, 3], JG_DEFAULT_MONTH_NAMES[2]), 'applications')).toBe(9)
  })

  it('improvement indicator from the first to the last month entered', () => {
    expect(monthlyTrend([3, null, 5])).toBe('▲')
    expect(monthlyTrend([5, 4])).toBe('▼')
    expect(monthlyTrend([5, 2, 5])).toBe('●')
    expect(monthlyTrend([5])).toBeNull()
  })

  it('month mark = Σ branches ÷ divisor', () => {
    expect(monthMark([10, 4, 4, 6], 2)).toBe(12)
    expect(monthMark([15, 30, null])).toBe(45)
    expect(monthMark([null, null], 2)).toBeNull()
  })
})

describe('Article 122 «جبر الكسور» (B5-10)', () => {
  it('rounds up without floating-point noise', () => {
    expect([35.2, 40.25, 45.5, 54.75, 40, 39.250000000001].map(ceilMark)).toEqual([36, 41, 46, 55, 40, 40])
  })

  it('grade 7: coursework 39.25 → 40, exam rounded separately', () => {
    const g = jgGrade(7)!
    const math = g.subjects.find((s) => s.key === 'math')!
    const { components, cells } = input(math, [9.25, 10, 20, 50.5, 9.25, 10, 20, 50.5])
    const off = computeSubject(components, cells, null, jgRuleOf(g))
    const on = computeSubject(components, cells, null, jgRuleOf(g), undefined, { jabrKasur: true })
    expect(off.stageTotals[1]).toBe(89.75)
    expect(on.stageTotals[1]).toBe(40 + 51)
    expect(on.examTotal).toBe(102)
  })
})

describe('Article 122 «جبر +1» and Article 51 (F1-4b)', () => {
  // grade 7 math: 200, exams 120 → pass line 100, exam line 48; values per semester: daily, apps, midterm, exam.
  const shortByOne = [5, 5, 15, 24, 5, 5, 16, 24] // total 99, exams 48

  it('the only failed subject short by 1 → «ناجح (جبر +1)» and the student passes', () => {
    const g = jgGrade(7)!
    const res = resolveStudent(student(g, { math: shortByOne }), gradeOf(g))
    const math = res.subjects.find((s) => s.key === 'math')!
    expect(math.jabr).toBe(true)
    expect(math.result.result).toBe('pass_jabr')
    expect(math.result.final).toBe(100)
    expect(res.decision).toBe('ناجح وينقل إلى الصف الثامن')
  })

  it('setting off: no bonus', () => {
    const g = jgGrade(7)!
    const res = resolveStudent(student(g, { math: shortByOne }), gradeOf(g), { settings: { jabrPlusOne: false } })
    expect(res.decision).toBe('دور ثاني في مادة واحدة')
  })

  it('two failed subjects, one short by 1 → no bonus, «دور ثاني في مادتين»', () => {
    const g = jgGrade(7)!
    const res = resolveStudent(student(g, { math: shortByOne, science: [0, 0, 0, 10, 0, 0, 0, 10] }), gradeOf(g))
    expect(res.subjects.some((s) => s.jabr)).toBe(false)
    expect(res.decision).toBe('دور ثاني في مادتين')
  })

  // grade 13 math: periods (written 7.5, daily 7.5, period end exam 15) ×2, then year-end exam 140 → pass 100, exam 70.
  const cert = (g: JgGradeDef, keys: string[], shortKey?: string) =>
    Object.fromEntries(
      keys.map((k) => {
        const s = g.subjects.find((x) => x.key === k)!
        const comps = jgComponentsOf(s)
        const examMax = comps.filter((c) => c.isExam).reduce((a, c) => a + c.max, 0)
        const subjectMax = comps.reduce((a, c) => a + c.max, 0)
        if (k !== shortKey) return [k, comps.map(() => 0)]
        // exactly 1 mark short of the total line, exam on its line
        const examLine = Math.ceil(0.5 * examMax)
        let left = 0.5 * subjectMax - 1 - examLine
        return [k, comps.map((c) => {
          if (c.isExam) return examLine
          const v = Math.min(c.max, Math.floor(left))
          left -= v
          return v
        })]
      }),
    )

  it('3rd secondary: 4 failed, one short by 1 → «دور ثاني في 3 مواد»', () => {
    const g = jgGrade(13)!
    const res = resolveStudent(student(g, cert(g, ['math', 'physics', 'chemistry', 'biology'], 'math')), gradeOf(g))
    expect(res.subjects.find((s) => s.key === 'math')!.result.result).toBe('pass_jabr')
    expect(res.decision).toBe('دور ثاني في 3 مواد')
    expect(res.overRound2Limit).toBe(false)
  })

  it('3rd secondary: 4 failed, none short by 1 → «راسب», out of the second round', () => {
    const g = jgGrade(13)!
    const res = resolveStudent(student(g, cert(g, ['math', 'physics', 'chemistry', 'biology'])), gradeOf(g))
    expect(res.decision).toBe('راسب')
    expect(res.overRound2Limit).toBe(true)
    expect(res.subjects.filter((s) => s.result.result === 'fail')).toHaveLength(4)
    expect(res.overall.supportSubjects).toHaveLength(4)
  })

  it('3rd secondary: 3 failed stays in the second round', () => {
    const g = jgGrade(13)!
    const res = resolveStudent(student(g, cert(g, ['math', 'physics', 'chemistry'])), gradeOf(g))
    expect(res.decision).toBe('دور ثاني في 3 مواد')
  })
})

describe('completeness, decision detail and ranks (B5-9, F1-6)', () => {
  it('lists what is missing relative to the section', () => {
    const g = jgGrade(7)!
    const subjects = student(g, { math: [10, 10, 20, 60, null, null, null, null], science: [null] })
    const sectionStages = Object.fromEntries(g.subjects.map((s) => [s.key, [1, 2]]))
    const res = resolveStudent(subjects, gradeOf(g), { sectionStages })
    expect(res.decision).toBe('النتيجة غير مكتملة')
    expect(res.missingText).toBe('لم يُرصد بعد: الرياضيات (الفصل الثاني)، العلوم (كل الدرجات)')
    expect(decisionWithDetail(res)).toBe('النتيجة غير مكتملة — لم يُرصد بعد: الرياضيات (الفصل الثاني)، العلوم (كل الدرجات)')
    expect(res.rankable).toBe(false)
  })

  it('no-fail grades: a period left empty while classmates have it → incomplete and unranked', () => {
    const g = jgGrade(1)!
    const sectionStages = Object.fromEntries(g.subjects.map((s) => [s.key, [1, 2, 3]]))
    const full = resolveStudent(student(g), gradeOf(g), { sectionStages })
    expect(full.decision).toBe('ينقل إلى الصف الثاني')
    const comps = jgComponentsOf(g.subjects.find((s) => s.key === 'math')!)
    const gap = resolveStudent(student(g, { math: comps.map((c) => (c.stage === 3 ? null : c.max)) }), gradeOf(g), { sectionStages })
    expect(gap.decision).toBe('النتيجة غير مكتملة')
    expect(gap.missingText).toBe('لم يُرصد بعد: الرياضيات (الفترة الثالثة)')
    // mid-year: nobody has period 3 yet → not incomplete
    const midYear = Object.fromEntries(g.subjects.map((s) => [s.key, [1, 2]]))
    expect(resolveStudent(student(g, { math: comps.map((c) => (c.stage === 3 ? null : c.max)) }), gradeOf(g), { sectionStages: midYear }).decision).toBe(
      'ينقل إلى الصف الثاني',
    )
  })

  it('a student with no marks (name only) has no decision and no rank', () => {
    const g = jgGrade(7)!
    const res = resolveStudent(g.subjects.map((s) => input(s, [])), gradeOf(g))
    expect(res.decision).toBeNull()
    expect(res.rankable).toBe(false)
  })

  it('ties share a rank and incomplete students are skipped (1, 1, 3, —)', () => {
    const g = jgGrade(7)!
    const a = resolveStudent(student(g), gradeOf(g))
    const b = resolveStudent(student(g), gradeOf(g))
    const c = resolveStudent(student(g, { math: [5, 5, 15, 30, 5, 5, 15, 30] }), gradeOf(g))
    const d = resolveStudent(student(g, { math: [10, 10, 20, 60] }), gradeOf(g))
    expect(sectionRanks([a, b, c, d])).toEqual([1, 1, 3, null])
  })

  it('section stages are collected from results', () => {
    expect(sectionStagesOf([
      { key: 'math', result: { stageTotals: { 1: 10, 2: null } } },
      { key: 'math', result: { stageTotals: { 1: null, 2: 5 } } },
    ])).toEqual({ math: [1, 2] })
  })
})
