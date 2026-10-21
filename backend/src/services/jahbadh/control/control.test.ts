// Exam control acceptance (brief C11): numbers, distribution, anonymity, double entry, unmasking gate,
// QR payloads. In-memory Supabase fake; jc_students rows carry their joined student/profile objects.
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
jest.mock('../../../utils/html-pdf.util', () => ({ escapeHtml: (x: string) => x, renderHtmlToPdf: async () => Buffer.from('') }))
jest.mock('../../push-notifications.service', () => ({ pushNotificationsService: { sendToProfiles: jest.fn(async () => undefined) } }))
process.env.JC_QR_SECRET = 'test-secret'
process.env.CREDENTIALS_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64')

import * as core from './core'
import { buildQrPayload, parseQrPayload } from './qr'
import * as day from './examday'
import * as sc from './scores'

const chief: core.JcActor = { profileId: 'p-chief', role: 'admin', schoolId: 's1' }
const entry1: core.JcActor = { profileId: 'p-e1', role: 'teacher', schoolId: 's1' }
const entry2: core.JcActor = { profileId: 'p-e2', role: 'teacher', schoolId: 's1' }

const SUBJECTS = [{ key: 'math', name: 'الرياضيات', max: 60, component_id: 'c-math' }, { key: 'arabic', name: 'العربية', max: 48, component_id: 'c-ar' }]

function seed(opts: Partial<core.JcSettings> = {}) {
  for (const k of Object.keys(db)) delete db[k]
  db.jc_sessions = [{
    id: 'S', school_id: 's1', campus_id: null, academic_year_id: 'y1', name: 'نهائي الفصل الأول', round: 'first', parent_session_id: null, stage: 1,
    status: 'draft', issue_date: '2026-06-01', session_code: '0260', settings: { secret_mode: 'encrypted', ...opts }, committees_locked_at: null, numbers_generated_at: null, created_at: '',
  }]
  db.jc_members = [{ session_id: 'S', profile_id: 'p-e1', role: 'entry' }, { session_id: 'S', profile_id: 'p-e2', role: 'entry' }]
  db.jc_session_grades = [
    { session_id: 'S', grade_level_id: 'g6', grade_code: 6, number_code: 6, subjects: SUBJECTS, grade_level: { name: 'السادس', order_index: 6 } },
    { session_id: 'S', grade_level_id: 'g8', grade_code: 8, number_code: 8, subjects: SUBJECTS, grade_level: { name: 'الثامن', order_index: 8 } },
  ]
  db.jc_students = Array.from({ length: 24 }, (_, i) => ({
    id: `ss${i}`, session_id: 'S', student_id: `st${i}`, grade_level_id: i < 12 ? 'g6' : 'g8', section_id: 'sec', status: 'participating',
    student: { student_number: String(100 + i), profile: { first_name: `طالب${String(i).padStart(2, '0')}`, last_name: 'التجربة', gender: 'male' } }, section: { name: 'أ' },
  }))
  db.jc_unmask_events = []
}

async function prepared(opts: Partial<core.JcSettings> = {}) {
  seed(opts)
  let ctx = await core.sessionContext('S', chief)
  await core.setKey(ctx, 7919, 2741)
  await core.generateNumbers(ctx)
  await core.saveCommittees(ctx, [{ name: 'اللجنة 1', capacity: 14, seat_columns: 4 }, { name: 'اللجنة 2', capacity: 14, seat_columns: 4 }])
  ctx = await core.sessionContext('S', chief)
  await core.distribute(ctx)
  return core.sessionContext('S', chief)
}

describe('numbers and distribution (C11-1..3)', () => {
  it('seats 6001–6012 / 8001–8012; encrypted secrets match the prototype; invalid key rejected', async () => {
    const ctx = await prepared()
    const students = await core.loadStudents(ctx)
    expect(students.filter((s) => s.number_code === 6).map((s) => s.seat_number)).toEqual(Array.from({ length: 12 }, (_, i) => 6001 + i))
    const secrets = await core.loadSecrets(ctx)
    const first = students.find((s) => s.seat_number === 6001)!
    const second = students.find((s) => s.seat_number === 6002)!
    expect(secrets.get(first.id)!.secret).toBe(60078)
    expect(secrets.get(second.id)!.secret).toBe(67997)
    expect(new Set([...secrets.values()].map((x) => x.secret)).size).toBe(24)
    await expect(core.setKey(ctx, 7918, 1)).rejects.toMatchObject({ code: 'invalid_key' })
    await expect(core.setKey(ctx, 7915, 1)).rejects.toMatchObject({ code: 'invalid_key' })
  })

  it('both grades in each committee; models alternate; locking freezes numbers', async () => {
    const ctx = await prepared()
    const students = await core.loadStudents(ctx)
    for (const c of await core.listCommittees(ctx)) {
      const inside = students.filter((s) => s.committee_id === c.id)
      expect(new Set(inside.map((s) => s.grade_code))).toEqual(new Set([6, 8]))
      const byIdx = new Map(inside.map((s) => [s.seat_index, s.paper_model]))
      expect(byIdx.get(1)).not.toBe(byIdx.get(2))
    }
    await core.lockCommittees(ctx, true)
    const locked = await core.sessionContext('S', chief)
    await expect(core.generateNumbers(locked)).rejects.toMatchObject({ code: 'committees_locked' })
    await expect(core.lockCommittees(await core.sessionContext('S', entry1), false)).rejects.toMatchObject({ status: 403 })
  })

  it('overflow students stay unassigned', async () => {
    seed({ secret_mode: 'random' })
    let ctx = await core.sessionContext('S', chief)
    await core.generateNumbers(ctx)
    await core.saveCommittees(ctx, [{ name: 'صغيرة', capacity: 20, seat_columns: 5 }])
    ctx = await core.sessionContext('S', chief)
    expect(await core.distribute(ctx)).toEqual({ placed: 20, unassigned: 4 })
  })
})

describe('anonymity, double entry and the gate (C11-4..6)', () => {
  it('a grade-entry user never receives names, seat numbers or student ids before unmasking', async () => {
    await prepared()
    const e = await core.sessionContext('S', entry1)
    const grid = await sc.entryGrid(e, 'g6', 1)
    const json = JSON.stringify(grid)
    expect(json).not.toMatch(/طالب|ss\d|st\d|6001|"seat_number"|"name":"طالب/)
    expect(grid.rows[0]).toHaveProperty('secret')
    await expect(core.loadStudents(e).then(() => core.need(e.can.manage))).rejects.toMatchObject({ status: 403 })
  })

  it('the same person cannot do both entries; a single differing score blocks the gate', async () => {
    const ctx = await prepared()
    const secrets = [...(await core.loadSecrets(ctx)).values()].map((x) => x.secret)
    const e1 = await core.sessionContext('S', entry1)
    const e2 = await core.sessionContext('S', entry2)
    const all = (score: number) => secrets.flatMap((secret) => [{ secret, subject_key: 'math', score }, { secret, subject_key: 'arabic', score: 30 }])
    await sc.saveEntry(e1, 1, all(40))
    await expect(sc.saveEntry(e1, 2, all(40))).rejects.toMatchObject({ code: 'same_user_both_entries' })
    const second = all(40)
    second[0] = { ...second[0], score: 41 }
    await sc.saveEntry(e2, 2, second)
    const g1 = await sc.gate(await core.sessionContext('S', chief))
    expect(g1.missing).toEqual(['all_entered', 'double_entry_match', 'chief_approved', 'show_names'])
    expect((await sc.mismatches(e1)).mismatches).toHaveLength(1)
    await sc.saveEntry(e2, 2, all(40))
    const chiefCtx = await core.sessionContext('S', chief)
    await sc.approveUnmask(chiefCtx)
    await core.updateSession(chiefCtx, { settings: { show_names: true } })
    const g2 = await sc.gate(await core.sessionContext('S', chief))
    expect(g2).toMatchObject({ open: true, missing: [] })
    await expect(core.updateSession(e1, { settings: { show_names: false } })).rejects.toMatchObject({ status: 403 })
    await sc.unmask(await core.sessionContext('S', chief))
    const after = await sc.entryGrid(await core.sessionContext('S', entry1), 'g6', 1)
    expect(after.rows[0]).toHaveProperty('name')
    await expect(sc.saveEntry(await core.sessionContext('S', entry1), 1, all(50))).rejects.toMatchObject({ code: 'unmasked' })
  })

  it('scores above the max or for unknown secrets are rejected', async () => {
    await prepared()
    const e1 = await core.sessionContext('S', entry1)
    await expect(sc.saveEntry(e1, 1, [{ secret: 60078, subject_key: 'math', score: 61 }])).rejects.toMatchObject({ code: 'invalid_score' })
    await expect(sc.saveEntry(e1, 1, [{ secret: 12345, subject_key: 'math', score: 1 }])).rejects.toMatchObject({ code: 'unknown_secret' })
    await expect(sc.saveEntry(e1, 1, [{ secret: 60078, subject_key: 'physics', score: 1 }])).rejects.toMatchObject({ code: 'subject_not_taken' })
  })
})

describe('QR payloads (C7.3, C11-7)', () => {
  it('round-trips and rejects other sessions, bad check digits, forged signatures and wrong kinds', () => {
    const p = buildQrPayload('booklet', '0260', { secret: 60078 })
    expect(p).toMatch(/^\d{20}$/)
    expect(parseQrPayload(p, '0260')).toMatchObject({ ok: true, kind: 'booklet', secret: 60078 })
    expect(parseQrPayload(p, '0261')).toMatchObject({ ok: false, reason: 'session' })
    const badCheck = p.slice(0, 13) + String((Number(p[13]) + 1) % 10) + p.slice(14)
    expect(parseQrPayload(badCheck, '0260')).toMatchObject({ ok: false, reason: 'check' })
    const forged = p.slice(0, -1) + String((Number(p.slice(-1)) + 1) % 10)
    expect(parseQrPayload(forged, '0260')).toMatchObject({ ok: false, reason: 'signature' })
    const card = buildQrPayload('card', '0260', { seat: 6001 })
    expect(parseQrPayload(card, '0260', 'booklet')).toMatchObject({ ok: false, reason: 'kind' })
    expect(parseQrPayload(card, '0260')).toMatchObject({ ok: true, seat: 6001 })
    const stub = buildQrPayload('stub', '0260', { secret: 60078, seat: 6001 })
    expect(parseQrPayload(stub, '0260')).toMatchObject({ ok: true, kind: 'stub', secret: 60078, seat: 6001 })
  })
})

describe('QR scanning screens (C7.4, C7.5)', () => {
  it('envelope receipt: received, duplicates, other committee, absent, forged and missing booklets', async () => {
    const ctx = await prepared({ secret_mode: 'random' })
    db.jc_exam_days = [{ id: 'D', session_id: 'S', exam_date: '2026-06-02', subject_key: 'math', subject_name: 'الرياضيات', grade_codes: [6, 8], start_time: '08:00', end_time: '10:00', duration_minutes: 120 }]
    const students = await core.loadStudents(ctx)
    const secrets = await core.loadSecrets(ctx)
    const [c1, c2] = await core.listCommittees(ctx)
    const inC1 = students.filter((s) => s.committee_id === c1.id)
    const inC2 = students.filter((s) => s.committee_id === c2.id)
    const code = (ssId: string) => buildQrPayload('booklet', '0260', { secret: secrets.get(ssId)!.secret })
    db.jc_attendance = [{ exam_day_id: 'D', session_student_id: inC1[2].id, state: 'absent' }]
    const forged = code(inC1[0].id).slice(0, -1) + String((Number(code(inC1[0].id).slice(-1)) + 1) % 10)
    const r = await day.envelopeCheck(ctx, 'D', c1.id, [code(inC1[0].id), code(inC1[0].id), code(inC1[1].id), code(inC2[0].id), code(inC1[2].id), forged])
    expect(r.expected).toBe(inC1.length - 1)
    expect(r.received).toHaveLength(2)
    expect(r.duplicates).toEqual([secrets.get(inC1[0].id)!.secret])
    expect(r.wrongCommittee).toEqual([{ secret: secrets.get(inC2[0].id)!.secret, committee: c2.name }])
    expect(r.absent).toEqual([secrets.get(inC1[2].id)!.secret])
    expect(r.invalid).toEqual([{ index: 5, reason: 'signature' }])
    expect(r.missing).toHaveLength(inC1.length - 3)
    await expect(day.envelopeCheck(await core.sessionContext('S', entry1), 'D', c1.id, [])).rejects.toMatchObject({ status: 403 })
  })

  it('regenerating the session code (chief only) invalidates printed codes', async () => {
    const ctx = await prepared({ secret_mode: 'random' })
    const old = buildQrPayload('booklet', '0260', { secret: 1 })
    await expect(core.regenerateSessionCode(await core.sessionContext('S', entry1))).rejects.toMatchObject({ status: 403 })
    const o = await core.regenerateSessionCode(ctx)
    expect(o.session.session_code).toMatch(/^\d{4}$/)
    expect(o.session.session_code).not.toBe('0260')
    expect(parseQrPayload(old, o.session.session_code)).toMatchObject({ ok: false, reason: 'session' })
  })
})
