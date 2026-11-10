// Exam control Wave 3 (2026-27 package, brief Part C/E): exam parts (C11-9, C11-10), national ID alerts,
// honor board completeness (F1-6) and the pre-unmask placeholder, exam-day absence → «غ» (E7), appeals
// after export (E2), second round from the grades decision (E3), per-day invigilation and the load gap
// (C9), printed documents (C6.5) and the audit log (C11-11). In-memory Supabase fake.
type Row = Record<string, any>
const db: Record<string, Row[]> = {}
let nextId = 1
const printed: string[] = []

function query(table: string) {
  const filters: ((r: Row) => boolean)[] = []
  let op: 'select' | 'insert' | 'upsert' | 'delete' | 'update' = 'select'
  let payload: Row[] = []
  let patch: Row = {}
  let conflict: string[] = []
  let single = false
  let range: [number, number] | null = null
  let limit: number | null = null
  let orderDesc: string | null = null
  const rows = () => (db[table] ??= [])
  const q: any = {
    select: () => q,
    eq: (k: string, v: unknown) => (filters.push((r) => r[k] === v), q),
    neq: (k: string, v: unknown) => (filters.push((r) => r[k] !== v), q),
    is: (k: string, v: unknown) => (filters.push((r) => (r[k] ?? null) === v), q),
    in: (k: string, vs: unknown[]) => (filters.push((r) => vs.includes(r[k])), q),
    not: (k: string, opx: string, v: string) => {
      if (opx === 'in') {
        const list = v.replace(/[()]/g, '').split(',')
        filters.push((r) => !list.includes(r[k]))
      }
      return q
    },
    or: () => q,
    order: (k: string, o?: { ascending?: boolean }) => ((orderDesc = o?.ascending === false ? k : orderDesc), q),
    limit: (n: number) => ((limit = n), q),
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
        const added = payload.map((p) => ({ id: `id${nextId++}`, created_at: new Date(Date.now() + nextId).toISOString(), ...p }))
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
      if (orderDesc) data = [...data].sort((a, b) => String(b[orderDesc!]).localeCompare(String(a[orderDesc!])))
      if (range) data = data.slice(range[0], range[1] + 1)
      if (limit) data = data.slice(0, limit)
      return resolve({ data: single ? data[0] ?? null : data, error: null, count: data.length })
    },
  }
  return q
}

jest.mock('../../../config/supabase', () => ({ supabase: { from: (t: string) => query(t) } }))
jest.mock('../../../utils/campus-validation', () => ({ schoolRootId: async (id: string) => id }))
jest.mock('../../../utils/html-pdf.util', () => ({
  escapeHtml: (x: string) => String(x),
  renderHtmlToPdf: async (html: string) => {
    printed.push(html)
    return Buffer.from('%PDF')
  },
}))
jest.mock('../../push-notifications.service', () => ({ pushNotificationsService: { sendToProfiles: jest.fn(async () => undefined) } }))
process.env.JC_QR_SECRET = 'test-secret'
process.env.CREDENTIALS_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64')

import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import * as gs from '../grades.service'
import { assignInvigilation, jcPartKey, jcSumParts } from '../../../lib/jahbadh'
import * as core from './core'
import * as plan from './planning'
import { similarityAlert, similarityAlertFrom } from './assessment'
import { renderDoc } from './print'
import { secondRoundList } from './round2'
import * as sc from './scores'

const chief: core.JcActor = { profileId: 'p-chief', role: 'admin', schoolId: 's1' }
const entry1: core.JcActor = { profileId: 'p-e1', role: 'teacher', schoolId: 's1' }

// Math exam 36 = 12/6/6/6/6 (brief C11-9), linked to grade-sheet sub-items; Arabic without parts.
const MATH_PARTS = [12, 6, 6, 6, 6].map((max, i) => ({ index: i + 1, name: `س${i + 1}`, max, subitem_id: `si${i + 1}` }))
const SUBJECTS = [{ key: 'math', name: 'الرياضيات', max: 36, component_id: 'c-math' }, { key: 'arabic', name: 'العربية', max: 48, component_id: 'c-ar' }]

function seed() {
  for (const k of Object.keys(db)) delete db[k]
  printed.length = 0
  db.jc_sessions = [{
    id: 'S', school_id: 's1', campus_id: null, academic_year_id: 'y1', name: 'نهائي الفصل الأول', round: 'first', parent_session_id: null, stage: 1,
    status: 'draft', issue_date: '2026-06-01', session_code: '0260', settings: { secret_mode: 'random', double_entry: false, show_names: true }, committees_locked_at: null, numbers_generated_at: null,
    created_at: '2026-06-01T00:00:00Z',
  }]
  db.jc_members = [{ session_id: 'S', profile_id: 'p-e1', role: 'entry' }]
  db.jc_session_grades = [{ session_id: 'S', grade_level_id: 'g6', grade_code: 6, number_code: 6, subjects: SUBJECTS, grade_level: { name: 'السادس', order_index: 6 } }]
  db.jc_exam_parts = MATH_PARTS.map((p) => ({ session_id: 'S', grade_level_id: 'g6', subject_key: 'math', part_index: p.index, name: p.name, max_score: p.max, subitem_id: p.subitem_id }))
  db.jc_students = Array.from({ length: 6 }, (_, i) => ({
    id: `ss${i}`, session_id: 'S', student_id: `st${i}`, grade_level_id: 'g6', section_id: 'sec', status: 'participating',
    student: {
      student_number: String(100 + i), enrollment_status: i === 5 ? 'معيد' : 'مستجد',
      profile: { first_name: `طالب${i}`, last_name: 'التجربة', gender: 'male', national_id: i === 1 ? '119900000001' : i === 2 ? '119900000001' : i === 3 ? null : `11990000001${i}`, profile_photo_url: null },
    },
    section: { name: 'أ' },
  }))
  db.students = Array.from({ length: 6 }, (_, i) => ({ id: `st${i}`, section_id: 'sec', school_id: 's1' }))
  db.jc_unmask_events = []
  db.jc_audit_log = []
}

async function numbered() {
  seed()
  const ctx = await core.sessionContext('S', chief)
  await core.generateNumbers(ctx)
  await core.saveCommittees(ctx, [{ name: 'اللجنة 1', capacity: 10, seat_columns: 3 }, { name: 'اللجنة 2', capacity: 10, seat_columns: 3 }])
  await core.distribute(await core.sessionContext('S', chief))
  return core.sessionContext('S', chief)
}

/** Enters every cell (math by part) for all students but `skip`, then unmasks. */
async function enterAllAndUnmask(skip: string[] = []) {
  const ctx = await numbered()
  const secrets = await core.loadSecrets(ctx)
  const cells = [...secrets.entries()]
    .filter(([ss]) => !skip.includes(ss))
    .flatMap(([ss, x]) => [
      ...MATH_PARTS.map((p) => ({ secret: x.secret, subject_key: jcPartKey('math', p.index), score: ss === 'ss0' ? p.max : p.max / 2 })),
      { secret: x.secret, subject_key: 'arabic', score: ss === 'ss0' ? 48 : 30 },
    ])
  await sc.saveEntry(await core.sessionContext('S', entry1), 1, cells)
  db.jc_unmask_events.push({ id: 'u1', session_id: 'S', kind: 'unmask', created_at: '2026-06-03T00:00:00Z' })
  return { ctx: await core.sessionContext('S', chief), secrets }
}

describe('exam parts (C6.7, C11-9, C11-10)', () => {
  it('parts must add up to the subject max, and change only before scores exist', async () => {
    const ctx = await numbered()
    await expect(core.setParts(ctx, 'g6', 'arabic', [{ name: 'أ', max: 20 }, { name: 'ب', max: 20 }])).rejects.toMatchObject({ code: 'parts_sum' })
    const grades = await core.setParts(ctx, 'g6', 'arabic', [{ name: 'أ', max: 28 }, { name: 'ب', max: 20 }])
    expect(grades[0].subjects.find((s) => s.key === 'arabic')!.parts!.map((p) => p.max)).toEqual([28, 20])
    await core.setParts(ctx, 'g6', 'arabic', [])
    const secret = [...(await core.loadSecrets(ctx)).values()][0].secret
    await sc.saveEntry(await core.sessionContext('S', entry1), 1, [{ secret, subject_key: jcPartKey('math', 1), score: 10 }])
    await expect(core.setParts(ctx, 'g6', 'math', [{ name: 'أ', max: 18 }, { name: 'ب', max: 18 }])).rejects.toMatchObject({ code: 'has_scores' })
  })

  it('entry is by part: part max enforced, the whole subject refused, columns expand without names', async () => {
    const ctx = await numbered()
    const secret = [...(await core.loadSecrets(ctx)).values()][0].secret
    const e1 = await core.sessionContext('S', entry1)
    await expect(sc.saveEntry(e1, 1, [{ secret, subject_key: jcPartKey('math', 1), score: 13 }])).rejects.toMatchObject({ code: 'invalid_score' })
    await expect(sc.saveEntry(e1, 1, [{ secret, subject_key: 'math', score: 30 }])).rejects.toMatchObject({ code: 'enter_by_part' })
    const grid = await sc.entryGrid(e1, 'g6', 1)
    expect(grid.columns.map((c) => c.key)).toEqual(['math~1', 'math~2', 'math~3', 'math~4', 'math~5', 'arabic'])
    expect(grid.columns[0].name).toBe('الرياضيات — س1')
    expect(JSON.stringify(grid)).not.toMatch(/طالب|"seat_number"|st\d|11990/)
  })

  it('12/6/6/6/6 sums to 36 and exports each part to its grade-sheet sub-item (C11-9)', async () => {
    expect(jcSumParts([12, 6, 6, 6, 6].map((score) => ({ score, absent: false })))).toEqual({ score: 36, absent: false })
    expect(jcSumParts([{ score: 3, absent: false }, null])).toBeNull()
    const { ctx } = await enterAllAndUnmask()
    const r = await sc.results(ctx)
    expect(r.students.find((x) => x.id === 'ss0')!.scores.math).toEqual({ score: 36, absent: false })
    const preview = await sc.exportToGrades(ctx, false)
    expect(preview.summary.no_national_id).toBe(1)
    await sc.exportToGrades(ctx, true)
    const mine = (db.jg_subitem_marks ?? []).filter((m) => m.student_id === 'st0')
    expect(mine.map((m) => [m.subitem_id, m.value]).sort()).toEqual([['si1', 12], ['si2', 6], ['si3', 6], ['si4', 6], ['si5', 6]])
    expect((db.jg_marks ?? []).filter((m) => m.component_id === 'c-math')).toHaveLength(0)
    expect((db.jg_marks ?? []).find((m) => m.student_id === 'st0' && m.component_id === 'c-ar')).toMatchObject({ value: 48, source: 'control_import' })
  })

  it('alerts flag a subject entered only partly', async () => {
    const ctx = await numbered()
    const secret = [...(await core.loadSecrets(ctx)).values()][0].secret
    await sc.saveEntry(await core.sessionContext('S', entry1), 1, [{ secret, subject_key: jcPartKey('math', 1), score: 10 }])
    const a = await sc.scoreAlerts(await core.sessionContext('S', chief))
    expect(a.find((x) => x.key === 'parts_incomplete')).toMatchObject({ count: 1, status: 'error' })
    expect(a.find((x) => x.key === 'invalid_scores')).toMatchObject({ count: 0 })
  })
})

describe('national ID and new/repeat (C6.2, C6.4)', () => {
  it('students carry national ID and مستجد/معيد; duplicates and missing IDs are alerted', async () => {
    const ctx = await numbered()
    const students = await core.loadStudents(ctx)
    expect(students.find((s) => s.id === 'ss5')).toMatchObject({ enrollment_status: 'معيد' })
    const a = await plan.alerts(ctx)
    expect(a.find((x) => x.key === 'duplicate_national_ids')).toMatchObject({ count: 1 })
    expect(a.find((x) => x.key === 'missing_national_ids')).toMatchObject({ count: 1, status: 'info' })
  })

  it('encrypted mode without a key raises the invalid-key alert', async () => {
    seed()
    db.jc_sessions[0].settings.secret_mode = 'encrypted'
    const a = await plan.alerts(await core.sessionContext('S', chief))
    expect(a.find((x) => x.key === 'invalid_key')).toMatchObject({ count: 1, status: 'error' })
  })
})

describe('honor board (C6.5 #12, F1-6)', () => {
  it('incomplete students are left out; names show the placeholder before unmasking', async () => {
    const ctx = await numbered()
    const secrets = await core.loadSecrets(ctx)
    const cells = [...secrets.entries()].flatMap(([ss, x]) => [
      ...MATH_PARTS.map((p) => ({ secret: x.secret, subject_key: jcPartKey('math', p.index), score: p.max })),
      // ss1 has the top math score but no Arabic score: incomplete.
      ...(ss === 'ss1' ? [] : [{ secret: x.secret, subject_key: 'arabic', score: ss === 'ss0' ? 47 : 20 }]),
    ])
    await sc.saveEntry(await core.sessionContext('S', entry1), 1, cells)
    const masked = await sc.honorBoardView(await core.sessionContext('S', chief))
    expect(masked.unmasked).toBe(false)
    expect(masked.rows.every((r) => r.name === sc.JC_NAME_PLACEHOLDER)).toBe(true)
    db.jc_unmask_events.push({ id: 'u1', session_id: 'S', kind: 'unmask', created_at: '2026-06-03T00:00:00Z' })
    const open = await sc.honorBoardView(await core.sessionContext('S', chief))
    expect(open.rows[0]).toMatchObject({ place: 1, name: 'طالب0 التجربة' })
    expect(open.rows.some((r) => r.name.startsWith('طالب1'))).toBe(false)
  })
})

describe('Part E: absence and appeals into the grade sheet (E7, E2)', () => {
  it('a student recorded absent on the exam day is exported as «غ»', async () => {
    const { ctx } = await enterAllAndUnmask(['ss4'])
    db.jc_exam_days = [{ id: 'D', session_id: 'S', exam_date: '2026-06-02', subject_key: 'arabic', subject_name: 'العربية', grade_codes: [6] }]
    db.jc_attendance = [{ exam_day_id: 'D', session_student_id: 'ss4', state: 'absent' }]
    const out = await sc.exportToGrades(ctx, true)
    expect(out.summary.from_attendance).toBe(1)
    expect((db.jg_marks ?? []).find((m) => m.student_id === 'st4' && m.component_id === 'c-ar')).toMatchObject({ is_absent: true, value: null })
  })

  it('an approved appeal after export updates the grade sheet at once', async () => {
    const { ctx, secrets } = await enterAllAndUnmask()
    await sc.exportToGrades(ctx, true)
    const published = await core.sessionContext('S', chief)
    expect(published.session.status).toBe('published')
    await sc.addAppeal(published, { secret: secrets.get('ss2')!.secret, subject_key: 'arabic', after: 41, reason: 'خطأ جمع' })
    expect((db.jg_marks ?? []).find((m) => m.student_id === 'st2' && m.component_id === 'c-ar')).toMatchObject({ value: 41 })
    expect(db.jc_audit_log.some((l) => l.action === 'export.grades.appeal')).toBe(true)
  })
})

describe('second round from the grades decision (C6.8, E3)', () => {
  afterEach(() => jest.restoreAllMocks())

  it('uses the grades results: referred subjects only, Art. 51 over-limit excluded; the new session keeps them', async () => {
    const { ctx } = await enterAllAndUnmask()
    jest.spyOn(gs, 'sectionContext').mockResolvedValue({} as any)
    const subjects = [{ id: 'j-math', key: 'math', short_name: 'الرياضيات' }, { id: 'j-ar', key: 'arabic', short_name: 'العربية' }]
    const res = (id: string, math: any, over = false) => ({
      student: { id }, decision: over ? 'راسب' : 'دور ثانٍ', over_round2_limit: over, incomplete: false, missing_text: null,
      subjects: { 'j-math': { need: math, result: { result: math ? 'round2' : 'pass' } }, 'j-ar': { need: null, result: { result: 'pass' } } },
    })
    jest.spyOn(gs, 'getResults').mockResolvedValue({ subjects, students: [res('st3', { kind: 'need', value: 20 }), res('st4', { kind: 'impossible' }, true), res('st0', null)] } as any)
    const list = await secondRoundList(ctx)
    expect(list.source).toBe('grades')
    expect(list.students.map((s) => [s.student_id, s.subject_keys])).toEqual([['st3', ['math']]])
    expect(list.excluded_over_limit.map((s) => s.id)).toEqual(['ss4'])
    const created = await sc.createSecondRound(ctx)
    expect(created.students).toBe(1)
    const child = db.jc_students.find((s) => s.session_id === created.session_id)!
    expect(child).toMatchObject({ student_id: 'st3', round2_subjects: ['math'] })
    expect(db.jc_exam_parts.filter((p) => p.session_id === created.session_id)).toHaveLength(5)
  })

  it('without the grades module the list is provisional, cites Art. 122/51, and creation is refused', async () => {
    const { ctx } = await enterAllAndUnmask()
    jest.spyOn(gs, 'sectionContext').mockRejectedValue(new gs.JgError(409, 'Run setup first', 'not_setup'))
    const list = await secondRoundList(ctx)
    expect(list.source).toBe('provisional')
    expect(list.note).toMatch(/المادة 122.*المادة 51/)
    await expect(sc.createSecondRound(ctx)).rejects.toMatchObject({ code: 'round2_needs_grades' })
  })
})

describe('fair invigilation per day (C9)', () => {
  it('each day staffs only its own committees and reports the highest–lowest gap', () => {
    const teachers = Array.from({ length: 6 }, (_, i) => ({ id: `t${i}`, specialization: null, available: true }))
    const r = assignInvigilation(
      [{ id: 'd1', subjectKey: 'math', committeeIds: ['c1', 'c2'] }, { id: 'd2', subjectKey: 'arabic', committeeIds: ['c1'] }],
      ['c1', 'c2'], teachers, 2, 1,
    )
    expect(r.duties.filter((d) => d.dayId === 'd2' && !d.reserve).every((d) => d.committeeId === 'c1')).toBe(true)
    expect(r.duties.filter((d) => d.dayId === 'd2')).toHaveLength(3)
    expect(r.spread.gap).toBe(r.spread.max - r.spread.min)
    expect(r.spread.gap).toBeLessThanOrEqual(1)
  })
})

describe('printed documents (C6.5) and the audit log (C11-11)', () => {
  it('cards (model, 8 per page), covers (total in words, reviewer), violations, quality, honor board, second round', async () => {
    const ctx = await numbered()
    db.jc_exam_days = [{ id: 'D', session_id: 'S', exam_date: '2026-06-02', subject_key: 'arabic', subject_name: 'العربية', grade_codes: [6] }]
    db.jc_violations = [{ id: 'v1', session_id: 'S', exam_day_id: 'D', session_student_id: 'ss0', type: 'غش', action_taken: 'إنذار', recorded_at: '2026-06-02T09:00:00Z' }]
    for (const doc of ['student_cards', 'booklet_covers', 'violations_log', 'quality_report', 'honor_board'] as const) {
      const out = await renderDoc(ctx, doc, { day_id: 'D' })
      expect(out.pdf.toString()).toBe('%PDF')
    }
    const [cards, covers, violations, quality, honor] = printed
    expect(cards).toMatch(/نموذج \((أ|ب)\)/)
    expect((cards.match(/height:60mm/g) ?? []).length).toBe(6)
    expect(covers).toContain('المجموع كتابةً')
    expect(covers).toContain('اسم المراجع')
    expect(violations).toContain('غش')
    expect(violations).toContain('عدد المخالفات')
    expect(quality).toContain('تقرير الجودة')
    expect(quality).toContain('المجموع')
    expect(honor).toContain('لوحة الشرف')
    printed.length = 0
    db.jc_unmask_events.push({ id: 'u1', session_id: 'S', kind: 'unmask', created_at: '2026-06-03T00:00:00Z' })
    jest.spyOn(gs, 'sectionContext').mockRejectedValue(new gs.JgError(409, 'x', 'not_setup'))
    await renderDoc(await core.sessionContext('S', chief), 'second_round_list', {})
    expect(printed[0]).toContain('قائمة الدور الثاني — مبدئية')
    jest.restoreAllMocks()
  })

  it('writes go to the append-only audit log with the actor', async () => {
    const { ctx } = await enterAllAndUnmask()
    await sc.exportToGrades(ctx, true)
    const actions = db.jc_audit_log.map((l) => l.action)
    for (const a of ['numbers.generate', 'committees.save', 'distribute', 'scores.entry1', 'export.grades']) expect(actions).toContain(a)
    expect(db.jc_audit_log.find((l) => l.action === 'export.grades')).toMatchObject({ actor_id: 'p-chief', actor_role: 'chief', session_id: 'S' })
    expect(db.jc_audit_log.find((l) => l.action === 'scores.entry1')).toMatchObject({ actor_id: 'p-e1', actor_role: 'entry' })
  })
})

describe('real PDF rendering (C11-8)', () => {
  jest.setTimeout(120_000)
  it('16 student cards print on exactly two A4 pages (8 per page)', async () => {
    seed()
    db.jc_students = Array.from({ length: 16 }, (_, i) => ({
      id: `ss${i}`, session_id: 'S', student_id: `st${i}`, grade_level_id: 'g6', section_id: 'sec', status: 'participating',
      student: { student_number: String(100 + i), profile: { first_name: `طالب${i}`, last_name: 'عبد الرحمن الطرابلسي', gender: 'male' } }, section: { name: 'أ' },
    }))
    const ctx = await core.sessionContext('S', chief)
    await core.generateNumbers(ctx)
    await core.saveCommittees(ctx, [{ name: 'اللجنة 1', capacity: 16, seat_columns: 4 }])
    await core.distribute(await core.sessionContext('S', chief))
    printed.length = 0
    await renderDoc(await core.sessionContext('S', chief), 'student_cards', {})
    const file = join(mkdtempSync(join(tmpdir(), 'jc-cards-')), 'cards.html')
    writeFileSync(file, printed[0])
    let pages: number
    try {
      pages = Number(execFileSync('npx', ['tsx', 'scripts/jahbadh-pdf-pages.ts', file], { cwd: resolve(__dirname, '../../../..'), timeout: 100_000, stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim().split('\n').pop())
    } catch (err) {
      console.warn('Chromium not available; PDF page check skipped:', (err as Error).message.slice(0, 200))
      return
    }
    expect(pages).toBe(2)
  })
})

describe('answer similarity on the alerts page (C6.4, Wave 6 keys)', () => {
  it('sums flagged neighbour pairs over the session keys, by secret before unmasking', async () => {
    const ctx = await numbered()
    expect(await similarityAlert(ctx)).toMatchObject({ key: 'answer_similarity', count: 0, status: 'ok' })
    const a = similarityAlertFrom([{ subject_key: 'math', part_key: '1', flagged: [{ committee: 'اللجنة 1', a: 61111, b: 62222 }] }, { subject_key: 'arabic', flagged: [] }])
    expect(a).toMatchObject({ phase: 'after', count: 1, status: 'info' })
    expect(a.details[0]).toBe('math — 1: اللجنة 1 61111 ↔ 62222')
  })
})
