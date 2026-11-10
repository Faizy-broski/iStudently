// Teacher release (2026-11): quiz ownership, gradebook config limits, colleague lists without
// admin-only columns, and teachers never replacing an inspection report PDF.
type Row = Record<string, any>
const tables: Record<string, Row[]> = {}
const updates: Row[] = []

jest.mock('../config/supabase', () => ({
  supabase: {
    from: (table: string) => {
      const filters: ((r: Row) => boolean)[] = []
      const b: any = {}
      b.select = () => b
      b.eq = (c: string, v: unknown) => (filters.push((r) => r[c] === v), b)
      b.update = (u: Row) => (updates.push(u), b)
      const rows = () => (tables[table] ?? []).filter((r) => filters.every((f) => f(r)))
      b.maybeSingle = async () => ({ data: rows()[0] ?? null, error: null })
      b.single = async () => ({ data: rows()[0] ?? null, error: rows()[0] ? null : { message: 'none' } })
      return b
    },
    storage: { from: () => ({ remove: jest.fn(async () => ({})) }) },
  },
}))
jest.mock('../middlewares/auth.middleware', () => ({ authenticate: (_q: unknown, _s: unknown, n: () => void) => n() }))
jest.mock('../services/gradebook.service', () => ({ gradebookService: { setConfig: jest.fn(async () => undefined) } }))
jest.mock('../services/teacher.service', () => ({
  getAllTeachers: jest.fn(async () => ({
    success: true,
    data: [{ id: 'st2', title: 'Ms', custom_fields: { note: 'x' }, permissions: { all: true }, base_salary: 900, profile: { first_name: 'A' } }],
  })),
}))

import { gradebookService } from '../services/gradebook.service'
import { recordReportPdf } from '../services/inspection-report.service'
import { teacherOwnsQuiz } from '../routes/quiz.routes'
import { setConfigAsTeacher } from './gradebook.controller'
import { getAllTeachers } from './teacher.controller'

function mockRes() {
  const res: any = {}
  res.status = jest.fn(() => res)
  res.json = jest.fn(() => res)
  return res
}
const teacher = { id: 'p-t', role: 'teacher', staff_id: 'st1', school_id: 'sch1' }

beforeEach(() => {
  jest.clearAllMocks()
  updates.length = 0
  tables.quizzes = [
    { id: 'mine', created_by: 'p-t', course_period: null },
    { id: 'myclass', created_by: 'p-other', course_period: { teacher_id: 'stX', secondary_teacher_id: 'st1' } },
    { id: 'theirs', created_by: 'p-other', course_period: { teacher_id: 'stX', secondary_teacher_id: null } },
  ]
  tables.course_periods = [{ id: 'cp1', teacher_id: 'st1', secondary_teacher_id: null }]
  tables.inspection_reports = [{ id: 'rep1', school_id: 'sch1', teacher_profile_id: 'p-t', pdf_file_url: 'sch1/reports/rep1/a.pdf' }]
})

describe('quiz ownership', () => {
  it('owns quizzes it created or of its classes (secondary teacher too)', async () => {
    expect(await teacherOwnsQuiz({ profile: teacher } as any, 'mine')).toBe(true)
    expect(await teacherOwnsQuiz({ profile: teacher } as any, 'myclass')).toBe(true)
  })
  it('does not own a colleague quiz', async () => {
    expect(await teacherOwnsQuiz({ profile: teacher } as any, 'theirs')).toBe(false)
  })
})

describe('PUT /gradebook/config as a teacher', () => {
  it('refuses the school-wide row (no course period)', async () => {
    const res = mockRes()
    await setConfigAsTeacher({ profile: teacher, body: { key: 'latency', value: '1' } } as any, res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(gradebookService.setConfig).not.toHaveBeenCalled()
  })
  it('refuses keys outside the per-class settings', async () => {
    const res = mockRes()
    await setConfigAsTeacher({ profile: teacher, body: { course_period_id: 'cp1', key: 'grade_posting_open', value: '1' } } as any, res)
    expect(res.status).toHaveBeenCalledWith(403)
    expect(gradebookService.setConfig).not.toHaveBeenCalled()
  })
  it('saves a per-class setting for an own class', async () => {
    await setConfigAsTeacher({ profile: teacher, body: { course_period_id: 'cp1', key: 'latency', value: '2' } } as any, mockRes())
    expect(gradebookService.setConfig).toHaveBeenCalledWith('sch1', 'cp1', 'latency', '2')
  })
})

describe('GET /teachers', () => {
  it('drops admin-only staff columns for teachers', async () => {
    const res = mockRes()
    await getAllTeachers({ profile: teacher, query: {}, headers: {} } as any, res)
    const row = res.json.mock.calls[0][0].data[0]
    expect(row).toEqual(expect.objectContaining({ id: 'st2', title: 'Ms' }))
    expect(row).not.toHaveProperty('custom_fields')
    expect(row).not.toHaveProperty('permissions')
    expect(row).not.toHaveProperty('base_salary')
  })
  it('keeps them for admins', async () => {
    const res = mockRes()
    await getAllTeachers({ profile: { ...teacher, role: 'admin' }, query: {}, headers: {} } as any, res)
    expect(res.json.mock.calls[0][0].data[0]).toHaveProperty('permissions')
  })
})

describe('inspection report PDF', () => {
  const caller = { profileId: 'p-t', role: 'teacher', schoolId: 'sch1' }
  it('a teacher cannot replace their report PDF', async () => {
    await expect(recordReportPdf(caller, 'rep1', { file_url: 'sch1/reports/rep1/b.pdf' })).rejects.toThrow(/Access denied/)
    expect(updates).toHaveLength(0)
  })
  it('only a file in the report folder can be recorded', async () => {
    const admin = { profileId: 'p-a', role: 'super_admin', schoolId: 'sch1' }
    await expect(recordReportPdf(admin, 'rep1', { file_url: 'sch9/reports/other/x.pdf' })).rejects.toThrow(/invalid report PDF path/)
    expect(updates).toHaveLength(0)
  })
})
