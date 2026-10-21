import { describe, expect, it } from 'vitest'
import {
  competitionRanks,
  computeSubject,
  decisionFor,
  estimateFor,
  fmtMark,
  JG_DISTRIBUTION,
  jgComponentsOf,
  jgGrade,
  jgRuleOf,
  learnerWord,
  round2Need,
  studentOverall,
  subjectCountWord,
  subjectMeta,
  type JgCell,
  type JgGradeDef,
  type JgSubjectDef,
} from './index'

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
const subjectTotal = (s: JgSubjectDef) => sum(s.stages.flat().map((c) => c.max))
const gradeTotal = (g: JgGradeDef) => sum(g.subjects.map(subjectTotal))
const stageTotal = (g: JgGradeDef, stage: 0 | 1 | 2) => sum(g.subjects.flatMap((s) => s.stages[stage].map((c) => c.max)))

/** Cells for one subject from a flat list of values in component order (null = not entered). */
function cellsOf(subject: JgSubjectDef, values: (number | null)[]): Record<string, JgCell> {
  const comps = jgComponentsOf(subject)
  return Object.fromEntries(comps.map((c, i) => [c.id, { value: values[i] ?? null }]))
}

describe('official distribution (Appendix A)', () => {
  it('grade totals match the memo', () => {
    expect(JG_DISTRIBUTION.map(gradeTotal)).toEqual([
      720, 720, 840, 920, 920, 1000, 1080, 1080, 1120, 1240, 1200, 1200, 1280, 1240,
    ])
  })

  it('secondary semesters are 620 (grade 10) and 600 (grade 11)', () => {
    expect([stageTotal(jgGrade(10)!, 0), stageTotal(jgGrade(10)!, 1)]).toEqual([620, 620])
    for (const code of [11, 12]) expect([stageTotal(jgGrade(code)!, 0), stageTotal(jgGrade(code)!, 1)]).toEqual([600, 600])
  })

  it('taught subjects per grade', () => {
    expect(jgGrade(1)!.subjects.map((s) => s.key)).toEqual(['islamic', 'arabic', 'english', 'math', 'computer'])
    expect(jgGrade(3)!.subjects).toHaveLength(6)
    expect(jgGrade(7)!.subjects).toHaveLength(9)
    expect(jgGrade(14)!.subjects).toHaveLength(10)
    expect(jgGrade(10)!.subjects).toHaveLength(11)
  })

  it('grades 1–3 have no exam components; every other subject has some', () => {
    for (const g of JG_DISTRIBUTION) {
      for (const s of g.subjects) {
        const exams = s.stages.flat().filter((c) => c.exam)
        if (g.noFail) expect(exams).toHaveLength(0)
        else expect(exams.length).toBeGreaterThan(0)
      }
    }
  })

  it('physics in 2nd and 3rd secondary science has two exam papers per sitting', () => {
    const p11 = jgGrade(11)!.subjects.find((s) => s.key === 'physics')!
    expect(subjectMeta(jgComponentsOf(p11), { noFail: false })).toMatchObject({ subjectMax: 200, examMax: 120 })
    const p13 = jgGrade(13)!.subjects.find((s) => s.key === 'physics')!
    expect(subjectMeta(jgComponentsOf(p13), { noFail: false })).toMatchObject({ subjectMax: 200, examMax: 140 })
  })

  it('stage 3 exists only for period systems', () => {
    expect(jgGrade(7)!.stageNames[2]).toBeNull()
    expect(jgGrade(7)!.subjects.every((s) => s.stages[2].length === 0)).toBe(true)
    expect(jgGrade(9)!.subjects.every((s) => s.stages[2].length > 0)).toBe(true)
  })
})

describe('subject result (grade 7 math: 200, exams 120, 50% total / 40% exams)', () => {
  const grade = jgGrade(7)!
  const rule = jgRuleOf(grade)
  const math = grade.subjects.find((s) => s.key === 'math')!
  const comps = jgComponentsOf(math)
  // order per semester: daily 10, applications 10, midterm 20, end of semester 60 (exam)

  it('exactly 50% of the total and 40% of the exams passes', () => {
    const r = computeSubject(comps, cellsOf(math, [5, 5, 16, 24, 5, 5, 16, 24]), null, rule)
    expect(r.total).toBe(100)
    expect(r.examTotal).toBe(48)
    expect(r.result).toBe('pass')
  })

  it('one mark below goes to the second round', () => {
    const r = computeSubject(comps, cellsOf(math, [5, 5, 16, 23, 5, 5, 16, 24]), null, rule)
    expect(r.result).toBe('round2')
  })

  it('entering exactly the computed need passes, 0.5 less fails', () => {
    const cells = cellsOf(math, [2, 2, 4, 30, 2, 2, 4, 30])
    const r = computeSubject(comps, cells, null, rule)
    expect(r.result).toBe('round2')
    const need = round2Need(comps, r, rule)
    expect(need).toEqual({ kind: 'need', value: 84 })
    const pass = computeSubject(comps, cells, 84, rule)
    expect(pass.result).toBe('pass_round2')
    expect(pass.final).toBe(100)
    expect(round2Need(comps, pass, rule)).toEqual({ kind: 'passed', value: 84 })
    expect(computeSubject(comps, cells, 83.5, rule).result).toBe('fail')
  })

  it('the exam condition alone sets the need when coursework is strong', () => {
    const cells = cellsOf(math, [10, 10, 20, 10, 10, 10, 20, 10])
    const r = computeSubject(comps, cells, null, rule)
    expect(round2Need(comps, r, rule)).toEqual({ kind: 'need', value: 48 })
    expect(computeSubject(comps, cells, 48, rule).result).toBe('pass_round2')
    expect(computeSubject(comps, cells, 47.5, rule).result).toBe('fail')
  })

  it('a missing semester is incomplete; percentage uses the recorded max', () => {
    const r = computeSubject(comps, cellsOf(math, [10, 10, 20, 60]), null, rule)
    expect(r.result).toBe('incomplete')
    expect(r.recordedMax).toBe(100)
    expect(r.pct).toBe(1)
  })

  it('absent counts as entered with 0', () => {
    const cells = cellsOf(math, [10, 10, 20, 60, 10, 10, 20, null])
    cells['2.4'] = { value: null, absent: true }
    const r = computeSubject(comps, cells, null, rule)
    expect(r.total).toBe(140)
    expect(r.result).toBe('pass')
  })

  it('need rounds up to 0.5 and reports impossible above the exam max', () => {
    const synthetic = { noFail: false, totalMin: 0.9, examMin: 0 }
    const r = computeSubject(comps, cellsOf(math, [0, 0, 0, 0, 0, 0, 0, 0]), null, synthetic)
    expect(round2Need(comps, r, synthetic)).toEqual({ kind: 'impossible' })
    const r2 = computeSubject(comps, cellsOf(math, [10, 10, 20, 0, 10, 10, 20, 0.3]), null, rule)
    expect(round2Need(comps, r2, rule)).toEqual({ kind: 'need', value: 48 })
  })
})

describe('estimate and formatting', () => {
  it('scale lookup', () => {
    expect(estimateFor(0.49)).toBe('ضعيف')
    expect(estimateFor(0.5)).toBe('مقبول')
    expect(estimateFor(0.749)).toBe('جيد')
    expect(estimateFor(0.85)).toBe('ممتاز')
    expect(estimateFor(null)).toBeNull()
  })
  it('marks show up to 2 decimals without trailing zeros', () => {
    expect([fmtMark(7.5), fmtMark(12), fmtMark(1 / 3), fmtMark(null)]).toEqual(['7.5', '12', '0.33', ''])
  })
  it('learner word follows stage and gender', () => {
    expect(learnerWord(3, 'female')).toBe('التلميذة')
    expect(learnerWord(10, 'male')).toBe('الطالب')
  })
})

describe('overall, rank and decision', () => {
  it('ties share a rank (1, 1, 3)', () => {
    expect(competitionRanks([0.9, 0.9, 0.8, null])).toEqual([1, 1, 3, null])
  })

  it('subject count wording', () => {
    expect([1, 2, 3, 10, 11].map(subjectCountWord)).toEqual(['مادة واحدة', 'مادتين', '3 مواد', '10 مواد', '11 مادة'])
  })

  function fullYear(grade: JgGradeDef, pickRound2: string[] = []) {
    const rule = jgRuleOf(grade)
    return grade.subjects.map((s) => {
      const comps = jgComponentsOf(s)
      // full marks everywhere, except subjects forced to the second round (all exams 0, coursework 0)
      const cells: Record<string, JgCell> = {}
      for (const c of comps) cells[c.id] = { value: pickRound2.includes(s.key) ? 0 : c.max }
      return { name: s.name, result: computeSubject(comps, cells, null, rule) }
    })
  }

  it('grades 1–3 are promoted', () => {
    const g = jgGrade(2)!
    const subjects = fullYear(g)
    const overall = studentOverall(subjects, jgRuleOf(g))
    expect(subjects.every((s) => s.result.result === 'promoted')).toBe(true)
    expect(decisionFor(g, overall, g.subjects.length)).toBe('ينقل إلى الصف الثالث')
  })

  it('two second-round subjects', () => {
    const g = jgGrade(7)!
    const overall = studentOverall(fullYear(g, ['math', 'science']), jgRuleOf(g))
    expect(overall.supportSubjects).toHaveLength(2)
    expect(decisionFor(g, overall, g.subjects.length)).toBe('دور ثاني في مادتين')
  })

  it('certificate grades', () => {
    const g9 = jgGrade(9)!
    expect(decisionFor(g9, studentOverall(fullYear(g9), jgRuleOf(g9)), g9.subjects.length)).toBe(
      'ناجح — شهادة إتمام مرحلة التعليم الأساسي',
    )
    for (const code of [13, 14]) {
      const g = jgGrade(code)!
      expect(decisionFor(g, studentOverall(fullYear(g), jgRuleOf(g)), g.subjects.length)).toBe(
        'ناجح — شهادة إتمام مرحلة التعليم الثانوي',
      )
    }
  })

  it('a normal pass moves to the next grade; a failed subject fails; missing data is incomplete', () => {
    const g = jgGrade(10)!
    const all = fullYear(g)
    const overall = studentOverall(all, jgRuleOf(g))
    expect(overall.pct).toBe(1)
    expect(decisionFor(g, overall, g.subjects.length)).toBe('ناجح وينقل إلى الصف الثاني الثانوي (علمي أو أدبي)')
    expect(decisionFor(g, { counts: { ...overall.counts, pass: overall.counts.pass - 1, fail: 1 } }, g.subjects.length)).toBe('راسب')
    expect(decisionFor(g, studentOverall(all.slice(1), jgRuleOf(g)), g.subjects.length)).toBe('النتيجة غير مكتملة')
  })
})

describe('subject summary', () => {
  it('counts results and support', async () => {
    const { summarizeSubject } = await import('./engine')
    const g = jgGrade(7)!
    const rule = jgRuleOf(g)
    const math = g.subjects.find((s) => s.key === 'math')!
    const comps = jgComponentsOf(math)
    const results = [
      computeSubject(comps, cellsOf(math, [10, 10, 20, 60, 10, 10, 20, 60]), null, rule),
      computeSubject(comps, cellsOf(math, [2, 2, 4, 30, 2, 2, 4, 30]), null, rule),
      computeSubject(comps, cellsOf(math, [10, 10, 20, 60]), null, rule),
      computeSubject(comps, {}, null, rule),
    ]
    expect(summarizeSubject(results)).toMatchObject({ recorded: 3, pass: 1, round2: 1, incomplete: 1, needSupport: 1 })
  })
})
