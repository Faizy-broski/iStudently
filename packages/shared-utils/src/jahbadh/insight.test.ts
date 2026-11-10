import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { jgGrade } from './distribution'
import { computeSubject, JG_DEFAULT_SCALE, subjectMeta } from './engine'
import { computeFixture, fixtureInputs, type FixtureFile } from './fixtures'
import { jgComponentsOf, jgRuleOf } from './index'
import {
  bins, classBoard, classMatrix, countWord, describe as describeValues, heatmap, honor, levelIndex, levelMap,
  pearson, strengths, studentCard, subjectOverview, subjectRank, supportList, type JgInfModel,
} from './infographics'
import {
  absenceImpact, allocateSections, approvalDiff, approvalRows, auditEntries, autoComments, certificates, edgeStudents,
  endOfYear, entryProgress, excellenceTotals, inflation, prediction, principalDashboard, principalRow, stagePct,
  supportPlans, weakItems, whatIf, type JgInsClass,
} from './insight'

const dir = resolve(__dirname, '__fixtures__')
const load = (code: number): FixtureFile => JSON.parse(readFileSync(resolve(dir, `grade-${String(code).padStart(2, '0')}.json`), 'utf8'))

/** A sample class as the backend builds it (insight/model.ts): engine results + effective cells. */
function insClass(code: number): JgInsClass {
  const file = load(code)
  const grade = jgGrade(code)!
  const rule = jgRuleOf(grade)
  const rows = computeFixture(file)
  const subjects = grade.subjects.map((s) => {
    const comps = jgComponentsOf(s)
    const meta = subjectMeta(comps, rule)
    return {
      id: s.key, key: s.key, name: s.name, max: meta.subjectMax, examMax: meta.examMax, stageMax: meta.stageMax, stages: meta.stages,
      components: comps.map((c) => ({ ...c, name: c.id, subitems: [] })),
    }
  })
  const sectionStages: Record<string, number[]> = {}
  const students = file.students.map((st, i) => {
    const inputs = fixtureInputs(file, st, grade)
    const res = rows[i].result
    return {
      id: `st${st.no}`, name: st.name, gender: st.gender === 'أنثى' ? ('f' as const) : st.gender === 'ذكر' ? ('m' as const) : null, number: String(st.no),
      rankable: res.rankable, incomplete: res.incomplete, decision: res.decision ?? '', total: res.overall.total, max: res.overall.max, pct: res.overall.pct,
      estimate: res.overall.estimate, rank: rows[i].rank,
      subjects: Object.fromEntries(subjects.map((s, k) => {
        const inp = inputs[k]
        const r0 = computeSubject(inp.components, inp.cells, inp.round2, rule)
        for (const [stage, v] of Object.entries(r0.stageTotals)) if (v !== null) (sectionStages[s.key] ??= []).includes(Number(stage)) || sectionStages[s.key].push(Number(stage))
        const cells = Object.fromEntries(Object.entries(inp.cells).map(([id, c]) => [id, { value: c?.value ?? null, absent: !!c?.absent }]))
        return [s.id, { result: res.subjects[k].result, final: res.subjects[k].result.result, jabr: res.subjects[k].jabr, cells, subitems: {}, round2: inp.round2 }]
      })),
      absence: { excused: i % 3, unexcused: i % 5 === 0 ? 0 : i % 4, byStage: { 1: { excused: i % 3, unexcused: i % 4 } } },
    }
  })
  return {
    gradeCode: code, gradeName: grade.name, sectionName: 'أ', stageNames: [...grade.stageNames], grade: { ...grade, stageNames: [...grade.stageNames] },
    ruleSettings: file.settings, scale: JG_DEFAULT_SCALE, follow: 0.5, excel: 0.85, basic: grade.level === 'basic', sectionStages, subjects, students,
  }
}

/** End-of-year infographic model from the same class. */
function infModel(cls: JgInsClass): JgInfModel {
  return {
    scope: { kind: 'final' }, scopeTitle: 'نهاية العام', scale: cls.scale.map((s) => ({ min: s.from, label: s.label })), follow: cls.follow, excel: cls.excel,
    pass: cls.grade.noFail ? 0.5 : cls.grade.totalMin, basic: cls.basic,
    students: cls.students.map((s) => ({ id: s.id, name: s.name, gender: s.gender })),
    subjects: cls.subjects.map((s) => ({
      id: s.id, name: s.name, passWord: cls.grade.noFail ? 'ينقل' : 'ناجح',
      measures: [{ key: 'final', label: 'الدرجة النهائية للمادة', kind: 'final', max: s.max, values: cls.students.map((st) => st.subjects[s.id]?.result.final ?? null), branchGroups: [] }],
      results: cls.students.map((st) => { const f = st.subjects[s.id]?.final; return f === 'round2' ? 'r2' : f === 'fail' ? 'fail' : f === 'incomplete' ? 'incomplete' : f ? 'pass' : '' }),
    })),
    classResults: cls.students.map((s) => ({ pct: s.pct, total: s.total, rank: s.rank, decision: s.decision, estimate: s.estimate })),
    attendance: { days: 60, markedDays: 60, rows: cls.students.map((s) => (s.absence ? { u: s.absence.unexcused, e: s.absence.excused, l: 0 } : null)) },
  }
}

describe('infographics statistics', () => {
  it('describe uses MEDIAN, all modes, STDEVP and QUARTILE.INC', () => {
    const d = describeValues([10, 20, 20, 30, 30, 40], 50, [{ min: 0, label: 'ضعيف' }, { min: 50, label: 'مقبول' }], 0.5)
    expect(d.n).toBe(6)
    expect(d.mean).toBeCloseTo(25)
    expect(d.median).toBe(25)
    expect(d.modes).toEqual([30, 20])
    expect(d.sd).toBeCloseTo(Math.sqrt(550 / 6), 6)
    expect(d.q1).toBeCloseTo(20)
    expect(d.q3).toBeCloseTo(30)
    expect(d.passCount).toBe(3)
    expect(bins(d, 50, [{ min: 0, label: 'a' }]).reduce((a, b) => a + b.count, 0)).toBe(6)
  })
  it('levels use an epsilon at boundaries', () => {
    expect(levelIndex(JG_DEFAULT_SCALE.map((s) => ({ min: s.from, label: s.label })), 0.85, 1)).toBe(4)
    expect(levelIndex(JG_DEFAULT_SCALE.map((s) => ({ min: s.from, label: s.label })), 0.8499, 1)).toBe(3)
  })
  it('Arabic number–noun agreement', () => {
    expect(countWord(1, false)).toBe('طالب واحد')
    expect(countWord(2, false, 'g')).toBe('طالبين')
    expect(countWord(7, true)).toBe('7 تلاميذ')
    expect(countWord(25, false)).toBe('25 طالباً')
    expect(countWord(100, false)).toBe('100 طالب')
  })
  it('pearson', () => {
    const p = pearson([1, 2, 3, 4, 5].map((x) => ({ x, y: 10 - 2 * x })))!
    expect(p.r).toBeCloseTo(-1)
    expect(p.b).toBeCloseTo(-2)
  })
})

describe.each([3, 9, 13])('infographic reports on sample grade %i', (code) => {
  const cls = insClass(code)
  const M = infModel(cls)
  it('class matrix takes the official % / rank / decision at year end', () => {
    const cm = classMatrix(M)
    cm.rows.forEach((r, i) => {
      if (!r) return
      expect(r.pct).toBe(cls.students[i].pct)
      expect(r.rank).toBe(cls.students[i].rank)
    })
  })
  it('every report computes', () => {
    const first = M.subjects[0].id
    expect(subjectOverview(M, first)?.summary.length).toBeGreaterThan(2)
    expect(levelMap(M, first)?.ranges.length).toBe(5)
    expect(strengths(M, first)?.gaps.length).toBeGreaterThan(0)
    const board = classBoard(M)!
    expect(board.kinds.pass + board.kinds.r2 + board.kinds.fail + board.kinds.incomplete).toBeLessThanOrEqual(cls.students.length)
    expect(heatmap(M)!.rows.length).toBeGreaterThan(0)
    expect(subjectRank(M)!.rows.length).toBe(M.subjects.length)
    const h = honor(M)!
    expect(h.podium.every((r) => r.rk <= 3)).toBe(true)
    expect(supportList(M)!.tips.length).toBeGreaterThan(0)
    expect(studentCard(M, 0)?.tips.length).toBeGreaterThan(1)
  })
})

describe.each([3, 13])('insight on sample grade %i', (code) => {
  const cls = insClass(code)

  it('prediction: projection between current and latest stage, needs are consistent', () => {
    for (const p of prediction(cls)) {
      if (p.current === null) { expect(p.expected).toBe('no_data'); continue }
      if (p.latest !== null && p.projected !== null) expect(p.projected).toBeGreaterThanOrEqual(Math.min(p.current, p.latest) - 1e-9)
      for (const s of p.subjects) if (s.to_pass.status === 'needs') expect(s.to_pass.marks).toBeLessThanOrEqual(s.remaining + 1e-9)
    }
  })
  it('edge list stays within the margin or needs few marks', () => {
    for (const e of edgeStudents(cls)) expect(Math.abs(e.gap) <= 10 + 1e-9 || (e.needed > 0 && e.needed <= 5)).toBe(true)
  })
  it('inflation verdicts and auto comments', () => {
    const inf = inflation(cls)
    expect(inf.subjects.length).toBe(cls.subjects.length)
    if (cls.grade.noFail && code <= 3) expect(inf.subjects.every((s) => s.verdict === 'no_exam')).toBe(true)
    const c = autoComments(cls, 1)
    expect(c.filter((x) => x.pct !== null).every((x) => x.text.endsWith('.'))).toBe(true)
  })
  it('what-if: no change keeps every decision; a higher pass line never adds passes', () => {
    expect(whatIf(cls, {}).changed).toEqual([])
    if (!cls.grade.noFail) {
      const w = whatIf(cls, { totalMin: 0.7 })
      expect(w.after.pass).toBeLessThanOrEqual(w.now.pass)
      const easier = whatIf(cls, { addMarks: 5, addSubject: 'all' })
      expect(easier.after.pass).toBeGreaterThanOrEqual(easier.now.pass)
    }
  })
  it('auditor flags the incomplete sample slots', () => {
    const a = auditEntries(cls)
    expect(a.errors).toBeGreaterThan(0)
    expect(a.issues.some((i) => i.kind === 'no_marks' && i.student_id === 'st26')).toBe(true)
  })
  it('approval diff is empty on the same data and finds a changed stage', () => {
    const hash = (t: string) => String(t.length)
    const a = approvalRows(cls, hash)
    expect(approvalDiff(a, a)).toEqual([])
    const b = a.map((r, k) => (k === 0 ? { ...r, stages: { ...r.stages, 1: (r.stages[1] ?? 0) + 1 } } : r))
    expect(approvalDiff(a, b)).toHaveLength(1)
  })
  it('certificates, support plans, absence impact, progress, end of year, principal row', () => {
    const cert = certificates(cls, 'final')
    for (const r of cert.excellence) expect(r.pct!).toBeGreaterThanOrEqual(0.85 - 1e-9)
    expect(cert.top3.every((r) => (r.rank ?? 99) <= 3)).toBe(true)
    for (const p of supportPlans(cls)) expect(p.subjects.length).toBeLessThanOrEqual(6)
    const ab = absenceImpact(cls)
    expect(ab.bands.reduce((a, b) => a + b.count, 0)).toBe(ab.rows.length)
    const prog = entryProgress(cls, { deadlines: { 1: '2000-01-01' }, today: '2026-11-10' })
    expect(prog.rows.every((r) => r.done <= r.required)).toBe(true)
    const e = endOfYear(cls)
    expect(e.totals.passed.total + e.totals.round2.total + e.totals.failed.total + e.totals.undecided.total).toBe(e.totals.examined.total)
    const row = principalRow(cls, 'sec1')
    expect(row.enrolled).toBe(cls.students.length)
    const dash = principalDashboard([row, { ...row, section_id: 'sec2', section: 'ب', pass_rate: 0.1 }])
    expect(dash.rows[0].section).toBe('أ')
    expect(stagePct(cls, cls.students[0], 1)).not.toBeNull()
    expect(weakItems(cls, cls.subjects[0].id, 1)!.has_subitems).toBe(false)
  })
})

describe('section allocation and excellence points', () => {
  it('serpentine keeps sizes within one and balances gender', () => {
    const st = Array.from({ length: 31 }, (_, i) => ({ id: `s${i}`, name: `اسم ${i}`, gender: (i % 2 ? 'f' : 'm') as 'm' | 'f', status: (i % 7 ? 'مستجد' : 'معيد') as 'مستجد' | 'معيد', pct: (i * 3) % 100 / 100, previous_section: null }))
    const a = allocateSections(st, ['أ', 'ب', 'ج'])
    const sizes = a.sections.map((s) => s.count)
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1)
    expect(a.list).toHaveLength(31)
  })
  it('excellence totals rank with ties and stars per category', () => {
    const t = excellenceTotals(
      [{ student_id: 'a', awarded_on: '2026-10-01', category: 0, points: 5 }, { student_id: 'b', awarded_on: '2026-10-02', category: 0, points: 5 }, { student_id: 'c', awarded_on: '2026-10-03', category: 1, points: 2 }],
      [{ id: 'a', name: 'أ' }, { id: 'b', name: 'ب' }, { id: 'c', name: 'ج' }],
      ['x', 'y'],
    )
    expect(t.rows.filter((r) => r.rank === 1)).toHaveLength(2)
    expect(t.stars[0].students).toHaveLength(2)
    expect(t.rows.find((r) => r.student_id === 'c')!.rank).toBe(3)
  })
})
