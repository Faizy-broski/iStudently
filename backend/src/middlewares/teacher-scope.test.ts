// Teacher scoping: students of the teacher's own sections, and class attendance records of their own class.
type Row = Record<string, any>
const tables: Record<string, Row[]> = {}

jest.mock('../config/supabase', () => ({
  supabase: {
    from: (table: string) => {
      const filters: ((r: Row) => boolean)[] = []
      const b: any = {}
      b.select = () => b
      b.eq = (c: string, v: unknown) => (filters.push((r) => r[c] === v), b)
      b.in = (c: string, v: unknown[]) => (filters.push((r) => v.includes(r[c])), b)
      b.or = (expr: string) => {
        const parts = expr.split(',').map((p) => p.split('.'))
        filters.push((r) => parts.some(([c, , v]) => r[c] === v))
        return b
      }
      const rows = () => (tables[table] ?? []).filter((r) => filters.every((f) => f(r)))
      b.maybeSingle = async () => ({ data: rows()[0] ?? null, error: null })
      b.then = (resolve: (v: unknown) => void) => resolve({ data: rows(), error: null })
      return b
    },
  },
}))

import { recordsBelongToClass } from '../controllers/attendance.controller'
import { requireOwnStudents, teacherSectionIds } from './own-course-period.middleware'

const teacher = { id: 'p-t', role: 'teacher', staff_id: 'st1' }
function run(mw: any, req: any) {
  const res: any = { statusCode: 200 }
  res.status = jest.fn((c: number) => ((res.statusCode = c), res))
  res.json = jest.fn(() => res)
  const next = jest.fn()
  return Promise.resolve(mw(req, res, next)).then(() => ({ res, next }))
}

beforeEach(() => {
  tables.timetable_entries = [{ section_id: 'secA', teacher_id: 'st1' }]
  tables.course_periods = [{ section_id: 'secB', teacher_id: 'stX', secondary_teacher_id: 'st1' }]
  tables.students = [
    { id: 'sA', section_id: 'secA' },
    { id: 'sB', section_id: 'secB' },
    { id: 'sZ', section_id: 'secZ' },
  ]
  tables.attendance_records = [
    { id: 'r1', attendance_date: '2026-11-01', timetable_entries: { section_id: 'secA', period_id: 'p1' } },
    { id: 'r2', attendance_date: '2026-11-01', timetable_entries: { section_id: 'secZ', period_id: 'p1' } },
    { id: 'r3', attendance_date: '2026-10-01', timetable_entries: { section_id: 'secA', period_id: 'p1' } },
  ]
})

describe('teacherSectionIds', () => {
  it('includes timetable and primary/secondary course period sections', async () => {
    expect((await teacherSectionIds('st1')).sort()).toEqual(['secA', 'secB'])
  })
})

describe('requireOwnStudents', () => {
  const mw = requireOwnStudents((req: any) => req.params.id)
  it('lets a teacher open a student of their section', async () => {
    const { next } = await run(mw, { profile: teacher, params: { id: 'sB' } })
    expect(next).toHaveBeenCalled()
  })
  it('refuses a student of another section', async () => {
    const { res, next } = await run(mw, { profile: teacher, params: { id: 'sZ' } })
    expect(res.status).toHaveBeenCalledWith(403)
    expect(next).not.toHaveBeenCalled()
  })
  it('does not limit admins', async () => {
    const { next } = await run(mw, { profile: { role: 'admin' }, params: { id: 'sZ' } })
    expect(next).toHaveBeenCalled()
  })
})

describe('recordsBelongToClass (POST /attendance/staff/take)', () => {
  it('accepts records of the period, date and an own section', async () => {
    expect(await recordsBelongToClass(['r1'], '2026-11-01', 'p1', ['secA'])).toBe(true)
  })
  it('refuses a record of another section', async () => {
    expect(await recordsBelongToClass(['r1', 'r2'], '2026-11-01', 'p1', ['secA'])).toBe(false)
  })
  it('refuses a record of another date or period', async () => {
    expect(await recordsBelongToClass(['r3'], '2026-11-01', 'p1', ['secA'])).toBe(false)
    expect(await recordsBelongToClass(['r1'], '2026-11-01', 'p2', ['secA'])).toBe(false)
  })
  it('refuses unknown ids', async () => {
    expect(await recordsBelongToClass(['nope'], '2026-11-01', 'p1', ['secA'])).toBe(false)
  })
})
