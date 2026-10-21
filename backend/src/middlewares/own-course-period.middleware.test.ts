// Teacher T owns exam e-own, timetable entry te-own and section s-own (via a course period);
// teacher O owns e-other and te-other. Submission sub-own belongs to an assignment of T.
const T = 'staff-t'
const ROWS: Record<string, Record<string, Record<string, any>>> = {
  exams: { 'e-own': { teacher_id: T }, 'e-other': { teacher_id: 'staff-o' } },
  timetable_entries: { 'te-own': { teacher_id: T }, 'te-other': { teacher_id: 'staff-o' } },
  assignment_submissions: { 'sub-own': { assignment: { teacher_id: T } }, 'sub-other': { assignment: { teacher_id: 'staff-o' } } },
}
// section → [timetable entry count, course period count] for teacher T
const SECTIONS: Record<string, [number, number]> = { 's-own': [0, 1], 's-tt': [2, 0], 's-other': [0, 0] }

jest.mock('../config/supabase', () => ({
  supabase: {
    from: (table: string) => {
      const filters: Record<string, string> = {}
      const b: any = {
        select: () => b,
        eq: (c: string, v: string) => ((filters[c] = v), b),
        or: () => b,
        maybeSingle: async () => ({ data: ROWS[table]?.[filters.id] ?? null, error: null }),
        then: (resolve: (v: unknown) => void) => {
          const [tt, cp] = SECTIONS[filters.section_id] ?? [0, 0]
          resolve({ count: table === 'timetable_entries' ? tt : cp, error: null })
        },
      }
      return b
    },
  },
}))

import { requireOwnClass, requireOwnRow, requireSelfTeacherId } from './own-course-period.middleware'

const teacher = { role: 'teacher', staff_id: T }
const admin = { role: 'admin', staff_id: null }
const res = () => ({ statusCode: 200, status(c: number) { this.statusCode = c; return this }, json() { return this } }) as any

async function call(mw: any, req: any) {
  const r = res()
  const next = jest.fn()
  await mw({ params: {}, query: {}, body: {}, ...req }, r, next)
  return { allowed: next.mock.calls.length === 1, status: r.statusCode }
}

describe('requireOwnRow', () => {
  it('lets a teacher act on their own row', async () => {
    expect((await call(requireOwnRow('exams'), { profile: teacher, params: { id: 'e-own' } })).allowed).toBe(true)
  })
  it("blocks a teacher on another teacher's row", async () => {
    expect(await call(requireOwnRow('exams'), { profile: teacher, params: { id: 'e-other' } })).toEqual({ allowed: false, status: 403 })
  })
  it('reads the owner through an embedded parent and from the body', async () => {
    const mw = requireOwnRow('assignment_submissions', 'sid', 'body', 'assignment:assignments!inner(teacher_id)')
    expect((await call(mw, { profile: teacher, body: { sid: 'sub-own' } })).allowed).toBe(true)
    expect((await call(mw, { profile: teacher, body: { sid: 'sub-other' } })).allowed).toBe(false)
  })
  it('lets admins through and leaves missing rows to the handler', async () => {
    expect((await call(requireOwnRow('exams'), { profile: admin, params: { id: 'e-other' } })).allowed).toBe(true)
    expect((await call(requireOwnRow('exams'), { profile: teacher, params: { id: 'nope' } })).allowed).toBe(true)
  })
})

describe('requireSelfTeacherId', () => {
  it('allows a teacher naming themselves or nobody', async () => {
    expect((await call(requireSelfTeacherId('body'), { profile: teacher, body: { teacher_id: T } })).allowed).toBe(true)
    expect((await call(requireSelfTeacherId('query'), { profile: teacher })).allowed).toBe(true)
  })
  it('blocks a teacher naming another teacher', async () => {
    expect(await call(requireSelfTeacherId('query'), { profile: teacher, query: { teacher_id: 'staff-o' } })).toEqual({ allowed: false, status: 403 })
  })
  it('lets admins name any teacher', async () => {
    expect((await call(requireSelfTeacherId('body'), { profile: admin, body: { teacher_id: 'staff-o' } })).allowed).toBe(true)
  })
})

describe('requireOwnClass', () => {
  it('checks timetable entries by teacher', async () => {
    expect((await call(requireOwnClass('entry', (r: any) => r.query.e), { profile: teacher, query: { e: 'te-own' } })).allowed).toBe(true)
    expect(await call(requireOwnClass('entry', (r: any) => r.query.e), { profile: teacher, query: { e: 'te-other' } })).toEqual({ allowed: false, status: 403 })
  })
  it('accepts a section the teacher has a timetable entry or course period in', async () => {
    const mw = requireOwnClass('section', (r: any) => r.query.s)
    expect((await call(mw, { profile: teacher, query: { s: 's-own' } })).allowed).toBe(true)
    expect((await call(mw, { profile: teacher, query: { s: 's-tt' } })).allowed).toBe(true)
    expect(await call(mw, { profile: teacher, query: { s: 's-other' } })).toEqual({ allowed: false, status: 403 })
  })
  it('lets admins through', async () => {
    expect((await call(requireOwnClass('entry', (r: any) => r.query.e), { profile: admin, query: { e: 'te-other' } })).allowed).toBe(true)
  })
})
