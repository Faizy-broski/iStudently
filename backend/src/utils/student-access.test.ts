// Who may read a student's grades / a class's grades.
const students: Record<string, { school_id: string }> = { 'st-a': { school_id: 'campus-a1' }, 'st-b': { school_id: 'school-b' } }
const coursePeriods: Record<string, { school_id: string | null; campus_id: string | null }> = {
  'cp-a': { school_id: 'school-a', campus_id: 'campus-a1' },
  'cp-b': { school_id: 'school-b', campus_id: null },
}
const links = new Set(['parent-1:st-a'])

jest.mock('../config/supabase', () => ({
  supabase: {
    from: (table: string) => {
      const filters: Record<string, string> = {}
      const q: any = {
        select: () => q,
        eq: (col: string, v: string) => ((filters[col] = v), q),
        limit: async () => ({ data: links.has(`${filters['parent.profile_id']}:${filters.student_id}`) ? [{ id: 'l' }] : [], error: null }),
        maybeSingle: async () => ({ data: (table === 'students' ? students : coursePeriods)[filters.id] ?? null, error: null }),
      }
      return q
    },
  },
}))
jest.mock('./campus-validation', () => ({ campusIdsAllowed: async (_own: string, ids: string[]) => ids.every((i) => i === 'school-a' || i === 'campus-a1') }))

import { canViewCoursePeriod, canViewStudent } from './student-access'

const as = (role: string, extra: object = {}) => ({ profile: { id: `${role}-1`, role, school_id: 'school-a', ...extra } as any })

describe('canViewStudent', () => {
  it('student: only themselves', async () => {
    expect(await canViewStudent(as('student', { student_id: 'st-a' }), 'st-a')).toBe(true)
    expect(await canViewStudent(as('student', { student_id: 'st-a' }), 'st-b')).toBe(false)
  })
  it('parent: only linked children', async () => {
    expect(await canViewStudent(as('parent'), 'st-a')).toBe(true)
    expect(await canViewStudent({ profile: { id: 'parent-2', role: 'parent', school_id: 'school-a' } as any }, 'st-a')).toBe(false)
  })
  it('admin / teacher: own school family only', async () => {
    expect(await canViewStudent(as('admin'), 'st-a')).toBe(true)
    expect(await canViewStudent(as('teacher'), 'st-b')).toBe(false)
    expect(await canViewStudent(as('admin'), 'missing')).toBe(false)
  })
  it('super admin: any', async () => {
    expect(await canViewStudent(as('super_admin'), 'st-b')).toBe(true)
  })
})

describe('canViewCoursePeriod', () => {
  it('never for students or parents', async () => {
    expect(await canViewCoursePeriod(as('student'), 'cp-a')).toBe(false)
    expect(await canViewCoursePeriod(as('parent'), 'cp-a')).toBe(false)
  })
  it('staff roles: own school family only', async () => {
    expect(await canViewCoursePeriod(as('teacher'), 'cp-a')).toBe(true)
    expect(await canViewCoursePeriod(as('admin'), 'cp-b')).toBe(false)
  })
})
