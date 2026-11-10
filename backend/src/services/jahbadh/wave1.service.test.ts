// Jahbadh Wave 1 (memo 2026-2027) through the services: the client's sample classes stored the way the
// platform stores them (direct marks, sub-item marks, monthly marks) give the brief §F4 decisions; sub-item
// and monthly saves are validated; teachers stay on their own subjects.
jest.mock('../../config/supabase', () => require('./jg-test-db').supabaseMock)
jest.mock('../../utils/campus-validation', () => ({ schoolRootId: async (id: string) => id }))
jest.mock('../../utils/html-pdf.util', () => ({
  escapeHtml: (x: string) => String(x).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`),
  renderHtmlToPdf: async () => Buffer.from(''),
}))
jest.mock('../push-notifications.service', () => ({ pushNotificationsService: { sendToProfiles: jest.fn() } }))

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { JG_DEFAULT_MONTH_NAMES, JG_DEFAULT_SCALE, jgGrade, subjectMeta } from '../../lib/jahbadh'
import { db, resetDb } from './jg-test-db'
import * as jg from './grades.service'
import * as monthly from './monthly.service'
import { footHtml, monthlyLogHtml, reportCardBody, JG_REPORT_CARD_ALL_ON } from './print.service'

const admin: jg.JgActor = { profileId: 'p-admin', role: 'admin' }
const teacher: jg.JgActor = { profileId: 'p-t', role: 'teacher', staffId: 'staff-1' }

function makeCtx(code: number, settings: Partial<jg.JgSettings> = {}, enterable?: string[]): jg.JgSectionContext {
  const version = '2026-2027'
  const def = jgGrade(code, version)!
  const rule: jg.JgRuleRow = {
    id: `r${code}`, school_id: 's1', version_label: version, grade_code: code, name: def.name, level: def.level, track: def.track,
    system_name: def.systemName, no_fail: def.noFail, total_min: def.totalMin, exam_min: def.examMin, stage_names: def.stageNames,
    rule_text: def.ruleText, certificate_name: def.certificateName, next_grade_name: def.nextGradeName, max_round2_subjects: def.maxRound2Subjects ?? 0,
  }
  const subjects: jg.JgLoadedSubject[] = def.subjects.map((s, i) => {
    const components: jg.JgComponentRow[] = s.stages.flatMap((comps, si) =>
      comps.map((c, ci) => {
        const id = `${s.key}-${si + 1}-${ci + 1}`
        return {
          id, subject_id: s.key, stage: si + 1, sort_order: ci + 1, name: c.name, max_score: c.max, is_exam: !!c.exam,
          monthly_kind: c.monthly ?? null, divisor: c.divisor ?? 1,
          subitems: (c.subItems ?? []).map((x, xi) => ({ id: `${id}-s${xi + 1}`, subject_id: s.key, component_id: id, sort_order: xi + 1, name: x.name, max_score: x.max })),
        }
      }),
    )
    return {
      id: s.key, key: s.key, name: s.name, short_name: s.name, weekly_periods: s.weeklyPeriods, display_order: i + 1, components,
      round2_subitems: (s.round2SubItems ?? []).map((x, xi) => ({ id: `${s.key}-r2-${xi + 1}`, subject_id: s.key, component_id: null, sort_order: xi + 1, name: x.name, max_score: x.max })),
      meta: subjectMeta(components.map((c) => ({ id: c.id, stage: c.stage, max: c.max_score, isExam: c.is_exam })), { noFail: def.noFail }),
    }
  })
  return {
    section: { id: 'sec1', name: 'أ', school_id: 's1', grade_level_id: `gl${code}` },
    gradeLevelName: def.name,
    rootId: 's1',
    yearId: 'y1',
    yearName: '2026 - 2027',
    version,
    settings: {
      version_label: version, follow_rate: 0.5, excel_rate: 0.85, grading_scale: JG_DEFAULT_SCALE, header: {},
      jabr_kasur: true, jabr_plus_one: true, act_mode: 'average', month_names: JG_DEFAULT_MONTH_NAMES.map((m) => [...m]), default_stage: null,
      ...settings,
    },
    grade: { rule, subjects },
    enterable: new Set(enterable ?? subjects.map((s) => s.id)),
  }
}

// ---- the client's sample classes (packages/shared-utils/src/jahbadh/__fixtures__) ------------------------

const FIX = resolve(__dirname, '../../../../packages/shared-utils/src/jahbadh/__fixtures__')
type Mark = number | 'غ'
type Entry = { value: Mark | null } | { months: (Mark | null)[] } | { subItems: Entry[] }
interface Fixture {
  settings: { actMode: 'average' | 'best_of_avg_last'; jabrKasur: boolean; jabrPlusOne: boolean; monthNames: string[][] }
  students: { no: number; name: string; gender: string | null; marks: Record<string, { stages: Entry[][]; round2: Entry | null }> }[]
}
const f4: Record<string, { no: number; rank: string; decision: string }[]> = JSON.parse(readFileSync(resolve(FIX, 'f4-expected.json'), 'utf8'))

const base = { school_id: 's1', academic_year_id: 'y1', section_id: 'sec1', source: 'teacher' }
const markOf = (m: Mark | null) => (m === 'غ' ? { value: null, is_absent: true } : { value: m, is_absent: false })

/** Stores one sample class like the platform: jg_marks, jg_subitem_marks, jg_monthly_marks, jg_round2_marks. */
function loadFixture(code: number) {
  const file: Fixture = JSON.parse(readFileSync(resolve(FIX, `grade-${String(code).padStart(2, '0')}.json`), 'utf8'))
  db.students = file.students.map((s) => ({ id: `st${s.no}`, section_id: 'sec1', student_number: String(s.no), profile: { first_name: s.name, gender: s.gender, is_active: true } }))
  db.jg_marks = []
  db.jg_subitem_marks = []
  db.jg_monthly_marks = []
  db.jg_round2_marks = []
  const put = (table: string, row: Record<string, unknown>) => db[table].push({ id: `m${db[table].length}`, ...base, ...row })
  const monthsInto = (studentId: string, target: { component_id?: string; subitem_id?: string }, months: (Mark | null)[]) =>
    months.forEach((m, i) => {
      if (m === null) return
      put('jg_monthly_marks', { student_id: studentId, component_id: target.component_id ?? null, subitem_id: target.subitem_id ?? null, target_id: target.component_id ?? target.subitem_id, month_idx: i, ...markOf(m) })
    })
  for (const s of file.students) {
    const sid = `st${s.no}`
    for (const [key, raw] of Object.entries(s.marks)) {
      raw.stages.forEach((comps, si) =>
        comps.forEach((e, ci) => {
          if (!e) return
          const cid = `${key}-${si + 1}-${ci + 1}`
          if ('value' in e) { if (e.value !== null) put('jg_marks', { student_id: sid, component_id: cid, ...markOf(e.value) }) }
          else if ('months' in e) monthsInto(sid, { component_id: cid }, e.months)
          else e.subItems.forEach((x, xi) => {
            const sub = `${cid}-s${xi + 1}`
            if ('value' in x) { if (x.value !== null) put('jg_subitem_marks', { student_id: sid, subitem_id: sub, ...markOf(x.value) }) }
            else if ('months' in x) monthsInto(sid, { subitem_id: sub }, x.months)
          })
        }),
      )
      const r2 = raw.round2
      if (r2) {
        const vals = 'value' in r2 ? [r2.value] : 'subItems' in r2 ? r2.subItems.map((x) => ('value' in x ? x.value : null)) : []
        const entered = vals.filter((v) => v !== null)
        if (entered.length) put('jg_round2_marks', { student_id: sid, jg_subject_id: key, value: entered.reduce<number>((a, v) => a + (v === 'غ' ? 0 : (v as number)), 0) })
      }
    }
  }
  return makeCtx(code, { act_mode: file.settings.actMode, jabr_kasur: file.settings.jabrKasur, jabr_plus_one: file.settings.jabrPlusOne, month_names: file.settings.monthNames })
}

beforeEach(() => resetDb())

describe.each([3, 13])('sample class, grade %i, stored as the platform stores it', (code) => {
  it('results give every brief §F4 decision; only complete students are ranked', async () => {
    const ctx = loadFixture(code)
    const results = await jg.getResults(ctx)
    const by = new Map(results.students.map((s) => [s.student.id, s]))
    const got = f4[code].map((e) => `${e.no}: ${by.get(`st${e.no}`)!.decision || '—'}`)
    expect(got).toEqual(f4[code].map((e) => `${e.no}: ${e.decision}`))
    expect(f4[code].map((e) => by.get(`st${e.no}`)!.rank === null)).toEqual(f4[code].map((e) => e.rank === '—'))
    expect(by.get('st4')!.rank).toBe(by.get('st5')!.rank) // twins
    expect(by.get('st24')!.missing_text).toMatch(/^لم يُرصد بعد: /)
    expect(by.get('st24')!.decision_detail).toContain('—')
  })
})

it('grade 13: Article 51 (slot 21) is out of the second round; slot 14 gets «جبر +1»', async () => {
  const ctx = loadFixture(13)
  const results = await jg.getResults(ctx)
  const st = (n: number) => results.students.find((s) => s.student.id === `st${n}`)!
  expect(st(21).over_round2_limit).toBe(true)
  expect(Object.values(st(21).subjects).every((x) => x.need === null)).toBe(true)
  expect(Object.values(st(14).subjects).filter((x) => x.jabr)).toHaveLength(1)
  const round2 = await jg.getSecondRound(ctx)
  expect(round2.students.some((s) => s.student.id === 'st21')).toBe(false)
})

it('the grid derives components from months and sub-items (read-only, ▲▼●) and follows ?stage=', async () => {
  const ctx = loadFixture(13)
  const grid = await jg.getGrid(ctx, 'quran', '1')
  expect(grid.stage).toBe(1)
  const row = grid.rows.find((r) => r.student.id === 'st1')!
  const act = row.cells['quran-1-1']
  expect(act.derived).toBe('subitems')
  expect(act.value).toBe(3) // (7 + 3 + 3 + 5) ÷ 6
  expect(row.subitem_cells['quran-1-1-s1']).toMatchObject({ value: 7, derived: 'monthly', trend: '●' })
  await expect(jg.getGrid(ctx, 'quran', '9')).rejects.toMatchObject({ status: 400 })
  expect((await jg.getGrid(ctx, 'quran')).stage).toBeNull() // school default: «كل الكشف»
})

// ---- saves ---------------------------------------------------------------------------------------------

function emptyClass(code: number, settings: Partial<jg.JgSettings> = {}, enterable?: string[]) {
  db.students = [
    { id: 'a', section_id: 'sec1', student_number: '1', profile: { first_name: 'أحمد', is_active: true } },
    { id: 'b', section_id: 'sec1', student_number: '2', profile: { first_name: 'بشير', is_active: true } },
    { id: 'x', section_id: 'other', student_number: '3', profile: { first_name: 'زيد', is_active: true } },
  ]
  return makeCtx(code, settings, enterable)
}

describe('sub-item marks', () => {
  it('a component with sub-items is computed: direct entry is refused, sub-items are saved within their max', async () => {
    const ctx = emptyClass(13)
    // quran stage-1 exam (3rd component) has sub-items entered once
    await expect(jg.saveMarks(ctx, 'quran', [{ student_id: 'a', component_id: 'quran-1-3', value: 10 }], admin)).rejects.toMatchObject({ code: 'computed_component' })
    await expect(jg.saveSubItemMarks(ctx, 'quran', [{ student_id: 'a', subitem_id: 'quran-1-3-s1', value: 99 }], admin)).rejects.toMatchObject({ status: 400, code: 'invalid_marks' })
    await expect(jg.saveSubItemMarks(ctx, 'quran', [{ student_id: 'x', subitem_id: 'quran-1-3-s1', value: 5 }], admin)).rejects.toMatchObject({ status: 400 })
    const grid = await jg.saveSubItemMarks(ctx, 'quran', [{ student_id: 'a', subitem_id: 'quran-1-3-s1', value: 13 }], admin)
    const cell = grid.rows.find((r) => r.student.id === 'a')!.cells['quran-1-3']
    expect(cell).toMatchObject({ derived: 'subitems', partial: true })
    expect(db.jg_subitem_marks).toHaveLength(1)
    expect(db.jg_audit_log?.some((a) => a.action === 'subitem.upsert')).toBe(true)
  })

  it('a monthly sub-item is refused here (it belongs to the monthly log)', async () => {
    const ctx = emptyClass(13)
    await expect(jg.saveSubItemMarks(ctx, 'quran', [{ student_id: 'a', subitem_id: 'quran-1-1-s1', value: 5 }], admin)).rejects.toMatchObject({ code: 'monthly_subitem' })
  })
})

describe('monthly log', () => {
  it('saves a month, computes the branch mark and refuses unused months, over-max marks and locked stages', async () => {
    const ctx = emptyClass(13)
    const q = monthly.monthlyQuery(ctx, 'quran', { stage: '1', month: '0' })
    const log = await monthly.saveMonthly(ctx, 'quran', q, [
      { student_id: 'a', target_id: 'quran-1-1-s1', value: 4 },
      { student_id: 'a', target_id: 'quran-1-1-s2', absent: true, value: null },
    ], admin)
    const row = log.rows.find((r) => r.student.id === 'a')!
    expect(row.values['quran-1-1-s1']).toMatchObject({ value: 4 })
    expect(row.values['quran-1-1-s2']).toMatchObject({ absent: true })
    expect(row.marks['quran-1-1-s1']).toBe(4)
    expect(log.months.map((m) => m.idx)).toEqual([0, 1, 2, 3])

    const q2 = monthly.monthlyQuery(ctx, 'quran', { stage: '1', month: '1' })
    await monthly.saveMonthly(ctx, 'quran', q2, [{ student_id: 'a', target_id: 'quran-1-1-s1', value: 6 }], admin)
    const after = await monthly.getMonthlyLog(ctx, 'quran', q2)
    const r = after.rows.find((x) => x.student.id === 'a')!
    expect(r.marks['quran-1-1-s1']).toBe(5) // average of 4 and 6
    expect(r.trends['quran-1-1-s1']).toBe('▲')

    await expect(monthly.saveMonthly(ctx, 'quran', q, [{ student_id: 'a', target_id: 'quran-1-1-s1', value: 50 }], admin)).rejects.toMatchObject({ code: 'invalid_marks' })
    await expect(monthly.saveMonthly(ctx, 'quran', q, [{ student_id: 'a', target_id: 'quran-1-3-s1', value: 5 }], admin)).rejects.toMatchObject({ status: 400 })
    // a month named «—» is not in use
    const unused = makeCtx(13, { month_names: [['سبتمبر', 'أكتوبر', 'نوفمبر', '—'], ['يناير', 'فبراير', 'مارس', 'أبريل'], ['أبريل', 'مايو', '—', '—']] })
    expect(() => monthly.monthlyQuery(unused, 'quran', { stage: '1', month: '3' })).toThrow(expect.objectContaining({ code: 'month_unused' }))
    expect(monthly.monthlyQuery(unused, 'quran', { stage: '1' }).monthIdx).toBe(0)
    db.jg_stage_locks = [{ id: 'l1', section_id: 'sec1', academic_year_id: 'y1', jg_subject_id: null, stage: 1 }]
    await expect(monthly.saveMonthly(ctx, 'quran', q, [{ student_id: 'a', target_id: 'quran-1-1-s1', value: 5 }], admin)).rejects.toMatchObject({ code: 'locked' })
  })

  it('«الأفضل بين المتوسط وآخر شهر» applies to activities only', async () => {
    const ctx = emptyClass(13, { act_mode: 'best_of_avg_last' })
    const save = (month: number, v: number) =>
      monthly.saveMonthly(ctx, 'quran', monthly.monthlyQuery(ctx, 'quran', { stage: '1', month: String(month) }), [
        { student_id: 'a', target_id: 'quran-1-1-s1', value: v },
        { student_id: 'a', target_id: 'quran-1-2-s1', value: v },
      ], admin)
    await save(0, 2)
    const log = await save(1, 6)
    const r = log.rows.find((x) => x.student.id === 'a')!
    expect(r.marks['quran-1-1-s1']).toBe(6) // activity: max(average 4, last 6)
    expect(r.marks['quran-1-2-s1']).toBe(4) // applications: average
  })

  it('a teacher only enters the subjects they teach', async () => {
    const ctx = emptyClass(13, {}, ['arabic'])
    const q = monthly.monthlyQuery(ctx, 'quran', { stage: '1', month: '0' })
    await expect(monthly.saveMonthly(ctx, 'quran', q, [{ student_id: 'a', target_id: 'quran-1-1-s1', value: 5 }], teacher)).rejects.toMatchObject({ status: 403 })
    await expect(jg.saveSubItemMarks(ctx, 'quran', [{ student_id: 'a', subitem_id: 'quran-1-3-s1', value: 5 }], teacher)).rejects.toMatchObject({ status: 403 })
  })

  it('a monthly component with months cannot be overwritten in the grid', async () => {
    const ctx = emptyClass(3)
    const comp = ctx.grade.subjects.flatMap((s) => s.components.map((c) => ({ s, c }))).find(({ c }) => c.monthly_kind && !c.subitems.length)!
    const q = monthly.monthlyQuery(ctx, comp.s.id, { stage: String(comp.c.stage), month: '0' })
    await monthly.saveMonthly(ctx, comp.s.id, q, [{ student_id: 'a', target_id: comp.c.id, value: 1 }], admin)
    await expect(jg.saveMarks(ctx, comp.s.id, [{ student_id: 'a', component_id: comp.c.id, value: 1 }], admin)).rejects.toMatchObject({ code: 'monthly_component' })
  })
})

describe('prints', () => {
  it('every footer carries «تاريخ السحب»; report cards carry no Jahbadh branding', async () => {
    expect(footHtml()).toContain('تاريخ السحب')
    expect(footHtml('', { brand: false })).not.toContain('jahbadh.com')
    const ctx = loadFixture(13)
    const { buildReportCards } = await import('./report-cards.service')
    const { cards } = await buildReportCards(ctx, 'final', { from: 1, to: 1 })
    const html = reportCardBody(cards[0], JG_REPORT_CARD_ALL_ON)
    expect(html).not.toContain('jahbadh.com')
    expect(html).not.toContain('class="band"')
    expect(html).toContain('تاريخ السحب')
    expect(html).toContain('وزارة التربية والتعليم')
  })

  it('the monthly sheet prints blank or filled', async () => {
    const ctx = loadFixture(13)
    const log = await monthly.getMonthlyLog(ctx, 'quran', monthly.monthlyQuery(ctx, 'quran', { stage: '1', month: '0' }))
    const header = { schoolName: 'مدرسة', logoUrl: null, educationOffice: '', municipality: '', principal: '', homeroomTeacher: '' }
    const empty = (html: string) => html.split('<td class="num"></td>').length
    const filled = monthlyLogHtml(log, header, false)
    const blank = monthlyLogHtml(log, header, true)
    expect(blank).toContain('سجل الأنشطة الشهري')
    expect(empty(blank)).toBeGreaterThan(empty(filled) + log.rows.length) // marks left out for pen entry
  })
})
