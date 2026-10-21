// Library policies (admins and librarians) and the teacher-scoped GPA / class rank list.
const saved: unknown[] = []
jest.mock('../services/school.service', () => {
  const svc = {
    getLibrarySettings: async () => ({ fine_per_day: 0.5, max_books_per_student: 3, loan_duration_days: 14 }),
    updateLibrarySettings: async (_s: string, v: unknown) => (saved.push(v), v),
  }
  return { SchoolService: jest.fn(() => svc), schoolService: svc }
})
jest.mock('../services/grades-reports.service', () => ({
  gradesReportsService: {
    getGpaRankList: async () => [
      { student_id: 'mine', class_rank: 2 },
      { student_id: 'other', class_rank: 1 },
    ],
    studentsOfTeacher: async (staffId: string) => new Set(staffId === 't1' ? ['mine'] : []),
  },
}))

import { SchoolController } from './school.controller'
import { getGpaRankList } from './grades-reports.controller'

const res = () => {
  const r: any = { statusCode: 200, body: null }
  r.status = (c: number) => ((r.statusCode = c), r)
  r.json = (b: unknown) => ((r.body = b), r)
  return r
}

describe('library settings', () => {
  const ctl = new SchoolController()
  it('saves valid policies', async () => {
    const r = res()
    await ctl.updateLibrarySettings({ profile: { school_id: 's1' }, body: { fine_per_day: 0, max_books_per_student: 5, loan_duration_days: 21 } } as any, r)
    expect(r.statusCode).toBe(200)
    expect(saved.pop()).toEqual({ fine_per_day: 0, max_books_per_student: 5, loan_duration_days: 21 })
  })
  it.each([
    [{ fine_per_day: -1, max_books_per_student: 3, loan_duration_days: 14 }],
    [{ fine_per_day: 1, max_books_per_student: 0, loan_duration_days: 14 }],
    [{ fine_per_day: 1, max_books_per_student: 2.5, loan_duration_days: 14 }],
    [{ fine_per_day: 1, max_books_per_student: 3, loan_duration_days: 400 }],
  ])('rejects out-of-range values %j', async (body) => {
    const r = res()
    await ctl.updateLibrarySettings({ profile: { school_id: 's1' }, body } as any, r)
    expect(r.statusCode).toBe(400)
  })
  it('returns the policies with defaults', async () => {
    const r = res()
    await ctl.getLibrarySettings({ profile: { school_id: 's1' } } as any, r)
    expect(r.body).toEqual({ success: true, data: { fine_per_day: 0.5, max_books_per_student: 3, loan_duration_days: 14 } })
  })
})

describe('GPA / class rank list', () => {
  const req = (profile: object) => ({ profile: { school_id: 's1', ...profile }, query: { marking_period_id: 'mp1' } }) as any
  it('shows teachers only students in their own classes, keeping whole-grade ranks', async () => {
    const r = res()
    await getGpaRankList(req({ role: 'teacher', staff_id: 't1' }), r)
    expect(r.body.data).toEqual([{ student_id: 'mine', class_rank: 2 }])
  })
  it('shows admins everyone', async () => {
    const r = res()
    await getGpaRankList(req({ role: 'admin' }), r)
    expect(r.body.data).toHaveLength(2)
  })
})
