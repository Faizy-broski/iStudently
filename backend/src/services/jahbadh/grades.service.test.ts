// Jahbadh grades service: mark validation (max, lock, enrolment, ownership), audit, results and
// suggestions, against an in-memory Supabase fake. The section context is built from the official
// distribution (grade 7), the same data the seed SQL is generated from.
type Row = Record<string, any>
const db: Record<string, Row[]> = {}
let nextId = 1

function query(table: string) {
  const filters: ((r: Row) => boolean)[] = []
  let op: 'select' | 'insert' | 'upsert' | 'delete' | 'update' = 'select'
  let payload: Row[] = []
  let patch: Row = {}
  let conflict: string[] = []
  let single = false
  let range: [number, number] | null = null
  const rows = () => (db[table] ??= [])
  const q: any = {
    select: () => q,
    eq: (k: string, v: unknown) => (filters.push((r) => r[k] === v), q),
    is: (k: string, v: unknown) => (filters.push((r) => (r[k] ?? null) === v), q),
    in: (k: string, vs: unknown[]) => (filters.push((r) => vs.includes(r[k])), q),
    not: () => q,
    or: () => q,
    order: () => q,
    limit: () => q,
    range: (a: number, b: number) => ((range = [a, b]), q),
    maybeSingle: () => ((single = true), q),
    single: () => ((single = true), q),
    insert: (p: Row | Row[]) => ((op = 'insert'), (payload = Array.isArray(p) ? p : [p]), q),
    upsert: (p: Row | Row[], o?: { onConflict?: string }) => ((op = 'upsert'), (payload = Array.isArray(p) ? p : [p]), (conflict = o?.onConflict?.split(',') ?? ['id']), q),
    delete: () => ((op = 'delete'), q),
    update: (p: Row) => ((op = 'update'), (patch = p), q),
    then: (resolve: (v: unknown) => void) => {
      const match = (r: Row) => filters.every((f) => f(r))
      if (op === 'insert') {
        const added = payload.map((p) => ({ id: `id${nextId++}`, ...p }))
        rows().push(...added)
        return resolve({ data: single ? added[0] : added, error: null })
      }
      if (op === 'upsert') {
        for (const p of payload) {
          const found = rows().find((r) => conflict.every((k) => r[k] === p[k]))
          if (found) Object.assign(found, p)
          else rows().push({ id: `id${nextId++}`, ...p })
        }
        return resolve({ data: null, error: null })
      }
      if (op === 'delete') {
        db[table] = rows().filter((r) => !match(r))
        return resolve({ data: null, error: null })
      }
      if (op === 'update') {
        rows().filter(match).forEach((r) => Object.assign(r, patch))
        return resolve({ data: null, error: null })
      }
      let data = rows().filter(match)
      if (range) data = data.slice(range[0], range[1] + 1)
      return resolve({ data: single ? data[0] ?? null : data, error: null })
    },
  }
  return q
}

jest.mock('../../config/supabase', () => ({ supabase: { from: (t: string) => query(t) } }))
jest.mock('../../utils/campus-validation', () => ({ schoolRootId: async (id: string) => id }))
jest.mock('../../utils/html-pdf.util', () => ({
  escapeHtml: (x: string) => String(x).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`),
  renderHtmlToPdf: async () => Buffer.from(''),
}))
const sendToProfiles = jest.fn(async () => undefined)
jest.mock('../push-notifications.service', () => ({ pushNotificationsService: { sendToProfiles } }))

import { JG_DEFAULT_SCALE, jgGrade, subjectMeta } from '../../lib/jahbadh'
import * as jg from './grades.service'
import * as rc from './report-cards.service'
import * as an from './analytics.service'
import { reportCardsHtml } from './print.service'

const admin: jg.JgActor = { profileId: 'p-admin', role: 'admin' }

/** A grade-7 section context with real components (ids "<key>-<stage>-<n>"). */
function makeCtx(enterable?: string[]): jg.JgSectionContext {
  const def = jgGrade(7)!
  const rule: jg.JgRuleRow = {
    id: 'r7', school_id: 's1', version_label: '2024-2025', grade_code: 7, name: def.name, level: 'basic', track: null,
    system_name: def.systemName, no_fail: false, total_min: 0.5, exam_min: 0.4, stage_names: def.stageNames,
    rule_text: def.ruleText, certificate_name: null, next_grade_name: def.nextGradeName,
  }
  const subjects = def.subjects.map((s, i) => {
    const components = s.stages.flatMap((comps, si) =>
      comps.map((c, ci) => ({ id: `${s.key}-${si + 1}-${ci + 1}`, subject_id: s.key, stage: si + 1, sort_order: ci + 1, name: c.name, max_score: c.max, is_exam: !!c.exam })),
    )
    return {
      id: s.key, key: s.key, name: s.name, short_name: s.name, weekly_periods: s.weeklyPeriods, display_order: i + 1, components,
      meta: subjectMeta(components.map((c) => ({ id: c.id, stage: c.stage, max: c.max_score, isExam: c.is_exam })), { noFail: false }),
    }
  })
  return {
    section: { id: 'sec1', name: 'أ', school_id: 's1', grade_level_id: 'gl7' },
    gradeLevelName: 'السابع',
    rootId: 's1',
    yearId: 'y1',
    yearName: '2025 - 2026',
    settings: { version_label: '2024-2025', follow_rate: 0.5, excel_rate: 0.85, grading_scale: JG_DEFAULT_SCALE, header: {} },
    grade: { rule, subjects },
    enterable: new Set(enterable ?? subjects.map((s) => s.id)),
  }
}

const mathCells = (studentId: string, values: (number | null)[]) => {
  const ids = ['math-1-1', 'math-1-2', 'math-1-3', 'math-1-4', 'math-2-1', 'math-2-2', 'math-2-3', 'math-2-4']
  return ids.map((component_id, i) => ({ student_id: studentId, component_id, value: values[i] ?? null }))
}

beforeEach(() => {
  for (const k of Object.keys(db)) delete db[k]
  db.students = [
    { id: 'st1', section_id: 'sec1', student_number: '1', profile: { first_name: 'محمد', last_name: 'علي', gender: 'male', is_active: true } },
    { id: 'st2', section_id: 'sec1', student_number: '2', profile: { first_name: 'أحمد', last_name: 'سالم', gender: 'male', is_active: true } },
    { id: 'st3', section_id: 'other', student_number: '3', profile: { first_name: 'زينب', last_name: 'عمر', gender: 'female', is_active: true } },
  ]
})

describe('saveMarks', () => {
  it('saves valid marks, returns the recomputed grid and audits each change', async () => {
    const grid = await jg.saveMarks(makeCtx(), 'math', mathCells('st1', [5, 5, 16, 24, 5, 5, 16, 24]), admin)
    const row = grid.rows.find((r) => r.student.id === 'st1')!
    expect(row.result.total).toBe(100)
    expect(row.result.result).toBe('pass')
    expect(grid.rows.map((r) => r.student.name)).toEqual(['أحمد سالم', 'محمد علي']) // Arabic order
    expect(db.jg_marks).toHaveLength(8)
    expect(db.jg_audit_log.filter((a) => a.action === 'mark.upsert')).toHaveLength(8)
  })

  it('rejects a mark above the component max and names the max', async () => {
    await expect(jg.saveMarks(makeCtx(), 'math', [{ student_id: 'st1', component_id: 'math-1-4', value: 61 }], admin)).rejects.toMatchObject({
      status: 400,
      message: 'The mark must be between 0 and 60',
      details: [expect.objectContaining({ max: 60 })],
    })
    expect(db.jg_marks ?? []).toHaveLength(0)
  })

  it('rejects students of another section and locked stages', async () => {
    await expect(jg.saveMarks(makeCtx(), 'math', [{ student_id: 'st3', component_id: 'math-1-1', value: 5 }], admin)).rejects.toMatchObject({ status: 400 })
    db.jg_stage_locks = [{ id: 'l1', section_id: 'sec1', academic_year_id: 'y1', jg_subject_id: null, stage: 1 }]
    await expect(jg.saveMarks(makeCtx(), 'math', [{ student_id: 'st1', component_id: 'math-1-1', value: 5 }], admin)).rejects.toMatchObject({
      status: 400,
      message: 'This stage is locked',
    })
    // stage 2 is still open
    await expect(jg.saveMarks(makeCtx(), 'math', [{ student_id: 'st1', component_id: 'math-2-1', value: 5 }], admin)).resolves.toBeTruthy()
  })

  it('a teacher cannot enter marks for a subject they do not teach', async () => {
    const teacher: jg.JgActor = { profileId: 'p-t', role: 'teacher', staffId: 'staff1' }
    await expect(jg.saveMarks(makeCtx(['science']), 'math', mathCells('st1', [1]), teacher)).rejects.toMatchObject({ status: 403 })
  })

  it('absent is stored apart from 0, and clearing a cell deletes it (audited)', async () => {
    const ctx = makeCtx()
    await jg.saveMarks(ctx, 'math', [{ student_id: 'st1', component_id: 'math-1-1', value: null, absent: true }], admin)
    expect(db.jg_marks[0]).toMatchObject({ value: null, is_absent: true })
    await jg.saveMarks(ctx, 'math', [{ student_id: 'st1', component_id: 'math-1-1', value: null }], admin)
    expect(db.jg_marks).toHaveLength(0)
    expect(db.jg_audit_log.map((a) => a.action)).toEqual(['mark.upsert', 'mark.delete'])
  })
})

describe('second round and results', () => {
  it('accepts a second-round mark only for referred students, up to the exam max', async () => {
    const ctx = makeCtx()
    await jg.saveMarks(ctx, 'math', [...mathCells('st1', [2, 2, 4, 30, 2, 2, 4, 30]), ...mathCells('st2', [10, 10, 20, 60, 10, 10, 20, 60])], admin)
    await expect(jg.saveRound2(ctx, 'math', [{ student_id: 'st2', value: 50 }], admin)).rejects.toMatchObject({ status: 400 })
    await expect(jg.saveRound2(ctx, 'math', [{ student_id: 'st1', value: 121 }], admin)).rejects.toMatchObject({ message: 'The mark must be between 0 and 120' })
    const grid = await jg.saveRound2(ctx, 'math', [{ student_id: 'st1', value: 84 }], admin)
    expect(grid.rows.find((r) => r.student.id === 'st1')!.result.result).toBe('pass_round2')
  })

  it('results: incomplete until every subject is entered, ranks and second-round sheet', async () => {
    const ctx = makeCtx()
    await jg.saveMarks(ctx, 'math', mathCells('st1', [2, 2, 4, 30, 2, 2, 4, 30]), admin)
    const results = await jg.getResults(ctx)
    expect(results.subjects).toHaveLength(9)
    expect(results.grand_max).toBe(1080)
    expect(results.students.find((s) => s.student.id === 'st1')!.decision).toBe('النتيجة غير مكتملة')
    const sr = await jg.getSecondRound(ctx)
    expect(sr.students).toHaveLength(1)
    expect(sr.students[0].cells.math).toEqual({ kind: 'need', value: 84 })
    expect(sr.per_subject.find((p) => p.subject_id === 'math')).toMatchObject({ referred: 1, awaiting: 1 })
  })
})

describe('suggestions', () => {
  it('grade codes from grade level names', () => {
    expect(jg.suggestGradeCode('الصف السابع')).toBe(7)
    expect(jg.suggestGradeCode('Grade 3')).toBe(3)
    expect(jg.suggestGradeCode('الأول الثانوي')).toBe(10)
    expect(jg.suggestGradeCode('الثاني الثانوي — أدبي')).toBe(12)
    expect(jg.suggestGradeCode('الثالث الثانوي علمي')).toBe(13)
    expect(jg.suggestGradeCode('Grade 11 Science')).toBe(11)
  })
  it('subjects by name, keeping sociology apart from social studies', () => {
    const subjects = [{ id: 'a', name: 'الاجتماعيات' }, { id: 'b', name: 'علم الاجتماع' }, { id: 'c', name: 'Mathematics' }]
    expect(jg.suggestSubjectId('social', subjects)).toBe('a')
    expect(jg.suggestSubjectId('sociology', subjects)).toBe('b')
    expect(jg.suggestSubjectId('math', subjects)).toBe('c')
  })
})

describe('report cards', () => {
  const fullMath = (sid: string) => mathCells(sid, [10, 10, 20, 60, 5, 5, 10, 30])

  it('final scope: all stages, official decision, ranks and the 12 options default on', async () => {
    const ctx = makeCtx()
    await jg.saveMarks(ctx, 'math', [...fullMath('st1'), ...mathCells('st2', [2, 2, 4, 30, 2, 2, 4, 30])], admin)
    const { cards, options } = await rc.buildReportCards(ctx, 'final')
    expect(Object.values(options).every(Boolean)).toBe(true)
    expect(cards.map((c) => c.student.listNumber)).toEqual([1, 2])
    const card = cards.find((c) => c.student.name === 'محمد علي')!
    expect(card.stageNames).toEqual(['الفصل الأول', 'الفصل الثاني'])
    const math = card.subjects.find((s) => s.name === 'الرياضيات')!
    expect(math.stages.map((x) => x.total)).toEqual([100, 50])
    expect(math.final).toBe(150)
    expect(math.minPass).toBe(100)
    expect(math.trend).toBeCloseTo(-50)
    expect(card.decision).toBe('النتيجة غير مكتملة') // other subjects not entered
    expect(card.rank).toBe(1)
    expect(card.max).toBe(1080)
  })

  it('stage scope: only that stage, estimate on it, no official decision', async () => {
    const ctx = makeCtx()
    await jg.saveMarks(ctx, 'math', fullMath('st1'), admin)
    const { cards } = await rc.buildReportCards(ctx, 'stage1', { studentIds: ['st1'] })
    expect(cards).toHaveLength(1)
    const card = cards[0]
    expect(card.title).toBe('صحيفة نتائج الفصل الأول')
    expect(card.subjects[0].stages).toHaveLength(1)
    const math = card.subjects.find((s) => s.name === 'الرياضيات')!
    expect([math.final, math.max, math.estimate]).toEqual([100, 100, 'ممتاز'])
    expect(card.decision).toBe('نتيجة الفصل الأول: ممتاز')
  })

  it('rejects a stage the grade does not have and renders a batch as one document', async () => {
    const ctx = makeCtx()
    expect(() => rc.parseScope(ctx, 'stage3')).toThrow()
    const { cards, options } = await rc.buildReportCards(ctx, 'final')
    const html = reportCardsHtml(cards, options)
    expect(html.match(/break-after:page/g)).toHaveLength(cards.length - 1)
  })

  it('activities: levels from the list, whole days not above school days', async () => {
    const ctx = makeCtx()
    await expect(rc.saveActivities(ctx, 1, { entries: [{ student_id: 'st1', art: 'رائع', music: null, pe: null, excused_days: null, unexcused_days: null, teacher_note: null }] }, admin)).rejects.toMatchObject({ status: 400 })
    await expect(rc.saveActivities(ctx, 1, { school_days: 80, entries: [{ student_id: 'st1', art: null, music: null, pe: null, excused_days: 90, unexcused_days: null, teacher_note: null }] }, admin)).rejects.toMatchObject({ status: 400 })
    const res = await rc.saveActivities(ctx, 1, { school_days: 80, entries: [{ student_id: 'st1', art: 'ممتاز', music: 'جيد', pe: null, excused_days: 2, unexcused_days: 1, teacher_note: ' مجتهد ' }] }, admin)
    expect(res.school_days).toBe(80)
    expect(res.rows.find((r) => r.student.id === 'st1')).toMatchObject({ art: 'ممتاز', excused_days: 2, teacher_note: 'مجتهد' })
    const { cards } = await rc.buildReportCards(ctx, 'stage1', { studentIds: ['st1'] })
    expect(cards[0].attendance).toEqual({ excused: [2], unexcused: [1], schoolDays: [80] })
    expect(cards[0].activities[0].levels).toEqual(['ممتاز'])
  })

  it('settings keep switched-off options; publishing is listed, audited and notifies', async () => {
    const ctx = makeCtx()
    const saved = await rc.saveReportCardSettings(ctx, { options: { rank: false } as never, quotes: ['  اجتهد  '] }, admin)
    expect(saved.options.rank).toBe(false)
    expect(saved.options.badges).toBe(true)
    expect(saved.quotes).toEqual(['اجتهد'])
    const pubs = await rc.publish(ctx, 'stage1', admin)
    expect(pubs.map((p) => p.scope)).toEqual(['stage1'])
    expect(db.jg_audit_log.some((a) => a.action === 'publish')).toBe(true)
    await new Promise((r) => setImmediate(r))
    expect(sendToProfiles).toHaveBeenCalled()
  })
})

describe('analytics', () => {
  const marks = async (ctx: jg.JgSectionContext) =>
    jg.saveMarks(ctx, 'math', [...mathCells('st1', [10, 10, 20, 60, 5, 5, 10, 30]), ...mathCells('st2', [2, 2, 4, 30, 8, 8, 16, 50])], admin)

  it('dashboard: per-subject indicators and section tiles', async () => {
    const ctx = makeCtx()
    await marks(ctx)
    const d = await an.dashboard(ctx)
    const math = d.subjects.find((s) => s.name === 'الرياضيات')!
    expect(math.recorded).toBe(2)
    expect(math.mean).toBe(135) // 150 and 120
    expect(math.passRate).toBe(1)
    expect(math.stageAverages).toEqual({ 1: 69, 2: 66 })
    expect(math.worksMastery).toBeCloseTo((40 + 20 + 8 + 32) / 160)
    expect(d.tiles).toMatchObject({ students: 2, recorded: 2, excellent: 0 })
    expect(d.strongest).toBe('الرياضيات')
  })

  it('early warning: change between stages and risk; groups split by rates', async () => {
    const ctx = makeCtx()
    await marks(ctx)
    const ew = await an.earlyWarning(ctx)
    const a = ew.rows.find((r) => r.student.id === 'st1')!
    expect(a.change).toBeCloseTo(-50)
    expect(a.risk).toMatchObject({ indicator: 'decline' })
    const b = ew.rows.find((r) => r.student.id === 'st2')!
    expect(b.change).toBeCloseTo(44)
    expect(ew.mostImproved.map((r) => r.student.id)).toEqual(['st2'])
    const g = await an.learningGroups(ctx, 'math')
    expect(g.groups.reinforcement.map((x) => x.student.id).sort()).toEqual(['st1', 'st2'])
  })

  it('student profile with feedback; subject analysis falls back to a taught subject', async () => {
    const ctx = makeCtx()
    await marks(ctx)
    const p = await an.studentProfile(ctx, 'st1')
    expect(p.subjects.find((s) => s.name === 'الرياضيات')).toMatchObject({ final: 150, classAvgPct: 0.675 })
    expect(p.feedback).toMatch(/^حقق التلميذ/)
    const sa = await an.subjectAnalysis(ctx, { subject: 'not-taught', measure: 'stage:1', compare: 'stage:2' })
    expect(sa.subject.name).toBe('التربية الإسلامية')
    const m = await an.subjectAnalysis(ctx, { subject: 'math', measure: 'stage:1', compare: 'stage:2' })
    expect([m.analysis.recorded, m.analysis.mean]).toEqual([2, 69])
    expect(m.analysis.comparison).toMatchObject({ improved: 1, declined: 1 })
  })

  it('test analysis validates scores; rubric marks copy into a component through the normal save', async () => {
    const ctx = makeCtx()
    await expect(an.saveTest(ctx, null, { name: 'ق1', questions: [{ max: 2 }], scores: { st1: [3] } }, admin)).rejects.toMatchObject({ status: 400 })
    const t = await an.saveTest(ctx, null, { name: 'ق1', questions: [{ max: 2, level: 'الفهم' }, { max: 1 }], scores: { st1: [2, 1], st2: [1, 0] } }, admin)
    expect(t.analysis.count).toBe(2)
    expect(t.students.map((s: { rank: number }) => s.rank)).toEqual([2, 1]) // Arabic order: أحمد (st2) first
    const r = await an.saveRubric(ctx, null, { name: 'مشروع', max_score: 10, levels: { st1: [4, 4, 4, 4], st2: [2, 2, 2, 2] } }, admin)
    expect(r.rows.find((x: { student: { id: string } }) => x.student.id === 'st1').mark).toBe(10)
    const res = await an.applyRubric(ctx, r.id, 'math', 'math-1-1', admin)
    expect(res.applied).toBe(2)
    expect(db.jg_marks.find((m) => m.student_id === 'st2' && m.component_id === 'math-1-1').value).toBe(5)
  })
})
