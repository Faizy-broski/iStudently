// Wave 6 assessment tools (brief #53–60): keys, blind auto-grading + transfer, similarity, fairness,
// archive, bubble-sheet QR. Same in-memory Supabase fake as control.test.ts.
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
  let limit: number | null = null
  let orderDesc: string | null = null
  const rows = () => (db[table] ??= [])
  const q: any = {
    select: () => q,
    eq: (k: string, v: unknown) => (filters.push((r) => r[k] === v), q),
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
        const touched: Row[] = []
        for (const p of payload) {
          const found = rows().find((r) => conflict.every((k) => r[k] === p[k]))
          if (found) touched.push(Object.assign(found, p))
          else {
            const added = { id: `id${nextId++}`, created_at: new Date(Date.now() + nextId).toISOString(), ...p }
            rows().push(added)
            touched.push(added)
          }
        }
        return resolve({ data: single ? touched[0] : touched, error: null })
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
jest.mock('../../../utils/html-pdf.util', () => ({ escapeHtml: (x: string) => x, renderHtmlToPdf: async (html: string) => Buffer.from(html) }))
jest.mock('../../push-notifications.service', () => ({ pushNotificationsService: { sendToProfiles: jest.fn(async () => undefined) } }))
process.env.JC_QR_SECRET = 'test-secret'
process.env.CREDENTIALS_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64')

import * as core from './core'
import * as ja from './assessment'
import { bubbleQrPayload, parseBubbleQr, renderBubbleSheets, renderErrorSlips } from './assessment-print'

const chief: core.JcActor = { profileId: 'p-chief', role: 'admin', schoolId: 's1' }
const entry1: core.JcActor = { profileId: 'p-e1', role: 'teacher', schoolId: 's1' }
const entry2: core.JcActor = { profileId: 'p-e2', role: 'teacher', schoolId: 's1' }

const SUBJECTS = [{ key: 'science', name: 'العلوم', max: 20, component_id: 'c-sci' }, { key: 'arabic', name: 'العربية', max: 20, component_id: 'c-ar' }]

function seed() {
  for (const k of Object.keys(db)) delete db[k]
  db.jc_sessions = [{
    id: 'S', school_id: 's1', campus_id: null, academic_year_id: 'y1', name: 'نهائي', round: 'first', parent_session_id: null, stage: 1,
    status: 'draft', issue_date: '2026-06-01', session_code: '0260', settings: { secret_mode: 'random' }, committees_locked_at: null, numbers_generated_at: null, created_at: '',
  }]
  db.jc_members = [{ session_id: 'S', profile_id: 'p-e1', role: 'entry' }, { session_id: 'S', profile_id: 'p-e2', role: 'entry' }]
  db.jc_session_grades = [{ session_id: 'S', grade_level_id: 'g6', grade_code: 6, number_code: 6, subjects: SUBJECTS, grade_level: { name: 'السادس', order_index: 6 } }]
  db.jc_students = Array.from({ length: 8 }, (_, i) => ({
    id: `ss${i}`, session_id: 'S', student_id: `st${i}`, grade_level_id: 'g6', section_id: i < 4 ? 'secA' : 'secB', status: 'participating',
    student: { student_number: String(100 + i), profile: { first_name: `طالب${i}`, last_name: 'التجربة', gender: 'male' } }, section: { name: i < 4 ? 'أ' : 'ب' },
  }))
  db.jc_unmask_events = []
}

async function prepared() {
  seed()
  let ctx = await core.sessionContext('S', chief)
  await core.generateNumbers(ctx)
  await core.saveCommittees(ctx, [{ name: 'اللجنة 1', capacity: 8, seat_columns: 4 }])
  ctx = await core.sessionContext('S', chief)
  await core.distribute(ctx)
  return core.sessionContext('S', chief)
}

const KEY = { grade_level_id: 'g6', subject_key: 'science', question_count: 10, key_a: ['أ', 'ب', 'ج', 'د', 'أ', 'ب', 'ج', 'د', 'أ', 'ب'], key_b: ['ب', 'أ', '', '', '', '', '', '', '', ''], max_score: 20 }

describe('answer keys and blind auto-grading (#53)', () => {
  it('normalises the key; only control staff edit it', async () => {
    const ctx = await prepared()
    const key = await ja.saveKey(ctx, { ...KEY, key_a: ['ا', 'b', 'ج', 'د', 'أ', 'ب', 'ج', 'د', 'أب', 'ب'] })
    expect(key.key_a[0]).toBe('أ')
    expect(key.key_a[1]).toBe('ب')
    expect(key.key_a[8]).toBe('أب')
    await expect(ja.saveKey(await core.sessionContext('S', entry1), KEY)).rejects.toMatchObject({ status: 403 })
    await expect(ja.saveKey(ctx, { ...KEY, max_score: 25 })).rejects.toMatchObject({ status: 400 })
  })

  it('entry users work by secret number; no names before unmasking; transfer goes through blind entry', async () => {
    const ctx = await prepared()
    const key = await ja.saveKey(ctx, KEY)
    const secrets = [...(await core.loadSecrets(ctx)).entries()]
    const e1 = await core.sessionContext('S', entry1)
    const saved = await ja.saveSheets(e1, key.id, secrets.map(([, x], i) => ({ secret: x.secret, answers: i === 0 ? 'أبجدأبجدأب' : 'أبجد-بجد' })))
    expect(JSON.stringify(saved)).not.toMatch(/طالب|"name"|"seat_number"|ss\d|st\d/)
    const first = saved.rows.find((r) => r.secret === secrets[0][1].secret)!
    // Version comes from the seat's paper model: B swaps the first two answers.
    expect(first.result!.score).toBe(first.version === 'A' ? 20 : 16)
    expect(saved.counts.not_transferred).toBe(8)
    const done = await ja.transfer(e1, key.id, 1)
    expect(done.transferred).toBe(8)
    expect(db.jc_scores.filter((r) => r.entry === 1 && r.subject_key === 'science')).toHaveLength(8)
    // The same person cannot also do the second entry of that subject.
    await expect(ja.transfer(e1, key.id, 2)).rejects.toMatchObject({ code: 'same_user_both_entries' })
    const again = await ja.sheets(e1, key.id)
    expect(again.counts.not_transferred).toBe(0)
  })

  it('part keys write into their exam part (Wave 3 part-level entry)', async () => {
    const ctx = await prepared()
    const key = await ja.saveKey(ctx, { ...KEY, part_key: 'السؤال الأول', max_score: 10 })
    // Part not defined in the session yet.
    await expect(ja.transfer(ctx, key.id, 1)).rejects.toMatchObject({ code: 'parts_not_available' })
    db.jc_exam_parts = [
      { session_id: 'S', grade_level_id: 'g6', subject_key: 'science', part_index: 1, name: 'السؤال الأول', max_score: 10, subitem_id: null },
      { session_id: 'S', grade_level_id: 'g6', subject_key: 'science', part_index: 2, name: 'السؤال الثاني', max_score: 10, subitem_id: null },
    ]
    const secrets = [...(await core.loadSecrets(ctx)).values()]
    const e1 = await core.sessionContext('S', entry1)
    await ja.saveSheets(e1, key.id, secrets.map((x) => ({ secret: x.secret, answers: 'أبجدأبجدأب' })))
    const preview = await ja.transferPreview(e1, key.id, 1)
    expect(new Set(preview.cells.map((c) => c.subject_key))).toEqual(new Set(['science~1']))
    await ja.transfer(e1, key.id, 1)
    expect(db.jc_scores.filter((r) => r.subject_key === 'science~1')).toHaveLength(secrets.length)
    // A whole-subject key on a subject with parts is refused.
    const whole = await ja.saveKey(ctx, { ...KEY, part_key: '' })
    await expect(ja.transfer(e1, whole.id, 1)).rejects.toMatchObject({ code: 'enter_by_part' })
  })

  it('answers are frozen after unmasking', async () => {
    const ctx = await prepared()
    const key = await ja.saveKey(ctx, KEY)
    db.jc_unmask_events.push({ session_id: 'S', kind: 'unmask', created_at: new Date().toISOString() })
    const after = await core.sessionContext('S', entry1)
    await expect(ja.saveSheets(after, key.id, [{ secret: 1, answers: 'أ' }])).rejects.toMatchObject({ code: 'unmasked' })
  })
})

describe('analysis, similarity, mastery, fairness', () => {
  it('item analysis, neighbour similarity and objective mastery', async () => {
    const ctx = await prepared()
    const key = await ja.saveKey(ctx, { ...KEY, key_b: [], objective_names: ['فهم', 'تطبيق'], objectives: [0, 0, 0, 0, 0, 1, 1, 1, 1, 1] })
    const students = (await core.loadStudents(ctx)).sort((a, b) => (a.seat_index ?? 0) - (b.seat_index ?? 0))
    const secrets = await core.loadSecrets(ctx)
    const e1 = await core.sessionContext('S', entry1)
    // Seats 1 and 2 share five identical wrong answers; everyone else answers the key.
    await ja.saveSheets(e1, key.id, students.map((s) => ({
      secret: secrets.get(s.id)!.secret,
      version: 'A' as const,
      answers: s.seat_index === 1 || s.seat_index === 2 ? 'أبجددددددد' : 'أبجدأبجدأب',
    })))
    const a = await ja.analysis(ctx, key.id, 'all')
    expect(a.n).toBe(8)
    expect(a.items).toHaveLength(10)
    const sim = await ja.similarity(ctx, key.id)
    expect(sim.flagged!.length).toBeGreaterThan(0)
    expect(sim.flagged![0].identicalWrong).toBeGreaterThanOrEqual(4)
    expect(sim.flagged![0]).not.toHaveProperty('a_name')
    await expect(ja.similarity(e1, key.id)).rejects.toMatchObject({ status: 403 })
    const m = await ja.mastery(ctx, key.id)
    expect(m.classSummary.map((c) => c.questions)).toEqual([[1, 2, 3, 4, 5], [6, 7, 8, 9, 10]])
    expect(m.students.find((s) => s.pct[1] === 0.2)).toBeTruthy()
  })

  it('fairness by section from agreed scores', async () => {
    const ctx = await prepared()
    const secrets = await core.loadSecrets(ctx)
    db.jc_scores = [...secrets.entries()].flatMap(([ss, x], i) => [
      { session_id: 'S', session_student_id: ss, subject_key: 'science', entry: 1, score: i < 4 ? 18 : 10, is_absent: false },
      { session_id: 'S', session_student_id: ss, subject_key: 'science', entry: 2, score: i < 4 ? 18 : 10, is_absent: false },
      { session_id: 'S', session_student_id: ss, subject_key: 'arabic', entry: 1, score: 12, is_absent: false },
      { session_id: 'S', session_student_id: ss, subject_key: 'arabic', entry: 2, score: 12, is_absent: false },
    ].map((r) => ({ ...r, secret: x.secret })))
    const f = await ja.fairness(ctx, 'g6')
    const a = f.cells.find((c) => c.section === 'أ' && c.subject === 'science')!
    expect(a.mean).toBeCloseTo(0.9)
    expect(a.flagged).toBe(true)
  })
})

describe('archive and printouts', () => {
  it('saves and recalls a test', async () => {
    const ctx = await prepared()
    const key = await ja.saveKey(ctx, KEY)
    const { id } = await ja.archiveKey(ctx, key.id, { name: 'علوم — نهائي' })
    expect((await ja.listArchive(ctx)).map((x: any) => x.name)).toEqual(['علوم — نهائي'])
    await ja.deleteKey(ctx, key.id)
    const back = await ja.recallArchive(ctx, id, { grade_level_id: 'g6', subject_key: 'science' })
    expect(back.key_a).toEqual(KEY.key_a)
  })

  it('bubble-sheet QR is digits only, signed and tamper-proof', () => {
    const p = bubbleQrPayload('0260', { secret: 61234, gradeCode: 6, part: 0, version: 'B' })
    expect(p).toMatch(/^14\d{23}$/)
    expect(parseBubbleQr(p, '0260')).toEqual({ ok: true, sessionCode: '0260', secret: 61234, gradeCode: 6, part: 0, version: 'B' })
    const tampered = p.slice(0, 8) + ((Number(p[8]) + 1) % 10) + p.slice(9)
    expect(parseBubbleQr(tampered, '0260').ok).toBe(false)
    expect(parseBubbleQr(p, '9999')).toEqual({ ok: false, reason: 'session' })
  })

  it('bubble sheets need secret rights; error slips print by secret number', async () => {
    const ctx = await prepared()
    const key = await ja.saveKey(ctx, KEY)
    const sheets = await renderBubbleSheets(ctx, key.id, {})
    expect(sheets.total).toBe(8)
    expect(sheets.pdf.toString()).toContain('margin:0')
    const e1 = await core.sessionContext('S', entry1)
    await expect(renderBubbleSheets(e1, key.id, {})).rejects.toMatchObject({ status: 403 })
    const secrets = [...(await core.loadSecrets(ctx)).values()]
    await ja.saveSheets(e1, key.id, secrets.map((x) => ({ secret: x.secret, answers: 'بأ', version: 'A' as const })))
    const slips = (await renderErrorSlips(e1, key.id)).pdf.toString()
    expect(slips).toContain('الرقم السري')
    expect(slips).not.toContain('طالب')
    void entry2
  })
})
