jest.mock('../config/supabase', () => ({
  supabase: { from: jest.fn() },
}))

import { supabase } from '../config/supabase'
import { AuthRequest } from '../middlewares/auth.middleware'
import {
  assertCanAccessStudent,
  assertCanAccessCircle,
  isTeacherAssignedToStudent,
  isTeacherAssignedToCircle,
} from './hifzi-access'

// ============================================================================
// Auth-critical, so covered even though utils/ isn't swept by
// jest.config.js's 100%-coverage glob (that's scoped to services/quran/* and
// the four pure Hifzi algorithm services). Same Supabase-mock convention as
// quran-invariants.test.ts's runAllInvariantChecks suite: a per-table FIFO
// result queue behind a chainable select/eq/is/limit/maybeSingle mock.
// ============================================================================

type Result = { data: any; error?: any }

function chainable(result: Result) {
  const obj: any = {}
  for (const m of ['select', 'eq', 'is', 'limit']) obj[m] = jest.fn(() => obj)
  obj.maybeSingle = jest.fn(() => Promise.resolve(result))
  obj.then = (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject)
  return obj
}

const fromMock = supabase.from as jest.Mock
let queues: Record<string, Result[]> = {}
const queue = (table: string, result: Result) => (queues[table] ??= []).push(result)

beforeEach(() => {
  queues = {}
  fromMock.mockReset()
  fromMock.mockImplementation((table: string) => {
    const q = queues[table]
    if (!q || q.length === 0) throw new Error(`Unexpected supabase.from("${table}") — no queued result`)
    return chainable(q.shift()!)
  })
})

function req(profile: any): AuthRequest {
  return { profile } as unknown as AuthRequest
}

describe('assertCanAccessStudent', () => {
  it('allows admin unconditionally, no query made', async () => {
    await expect(assertCanAccessStudent(req({ role: 'admin', id: 'p1' }), 's1')).resolves.toBe(true)
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('allows super_admin unconditionally, no query made', async () => {
    await expect(assertCanAccessStudent(req({ role: 'super_admin', id: 'p1' }), 's1')).resolves.toBe(true)
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('denies when studentId is missing', async () => {
    await expect(assertCanAccessStudent(req({ role: 'admin', id: 'p1' }), '')).resolves.toBe(false)
  })

  it('allows a student accessing their own record (via student_id)', async () => {
    await expect(assertCanAccessStudent(req({ role: 'student', id: 'p1', student_id: 's1' }), 's1')).resolves.toBe(true)
  })

  it('allows a student whose profile id itself is the student id (no separate student_id field)', async () => {
    await expect(assertCanAccessStudent(req({ role: 'student', id: 's1' }), 's1')).resolves.toBe(true)
  })

  it('denies a student accessing another student\'s record', async () => {
    await expect(assertCanAccessStudent(req({ role: 'student', id: 'p1', student_id: 's1' }), 's2')).resolves.toBe(false)
  })

  it('allows a parent linked to the student', async () => {
    queue('parent_student_links', { data: { id: 'link1' } })
    await expect(assertCanAccessStudent(req({ role: 'parent', id: 'p1' }), 's1')).resolves.toBe(true)
  })

  it('denies a parent not linked to the student', async () => {
    queue('parent_student_links', { data: null })
    await expect(assertCanAccessStudent(req({ role: 'parent', id: 'p1' }), 's1')).resolves.toBe(false)
  })

  it('allows a teacher assigned to the student\'s active circle', async () => {
    queue('hifzi_enrollments', { data: [{ circle_id: 'c1' }] })
    await expect(assertCanAccessStudent(req({ role: 'teacher', id: 't1' }), 's1')).resolves.toBe(true)
  })

  it('denies a teacher not assigned to any of the student\'s active circles', async () => {
    queue('hifzi_enrollments', { data: [] })
    await expect(assertCanAccessStudent(req({ role: 'teacher', id: 't1' }), 's1')).resolves.toBe(false)
  })

  it('denies an unrecognized role', async () => {
    await expect(assertCanAccessStudent(req({ role: 'staff', id: 'p1' }), 's1')).resolves.toBe(false)
  })
})

describe('isTeacherAssignedToStudent', () => {
  it('is true when the query returns at least one active-teacher row', async () => {
    queue('hifzi_enrollments', { data: [{ circle_id: 'c1' }] })
    await expect(isTeacherAssignedToStudent('s1', 't1')).resolves.toBe(true)
  })

  it('is false when the query returns no rows', async () => {
    queue('hifzi_enrollments', { data: [] })
    await expect(isTeacherAssignedToStudent('s1', 't1')).resolves.toBe(false)
  })

  it('is false when the query returns null data', async () => {
    queue('hifzi_enrollments', { data: null })
    await expect(isTeacherAssignedToStudent('s1', 't1')).resolves.toBe(false)
  })
})

describe('isTeacherAssignedToCircle', () => {
  it('is true when an active hifzi_circle_teachers row exists', async () => {
    queue('hifzi_circle_teachers', { data: [{ id: 'ct1' }] })
    await expect(isTeacherAssignedToCircle('c1', 't1')).resolves.toBe(true)
  })

  it('is false when no active row exists', async () => {
    queue('hifzi_circle_teachers', { data: [] })
    await expect(isTeacherAssignedToCircle('c1', 't1')).resolves.toBe(false)
  })
})

describe('assertCanAccessCircle', () => {
  it('allows admin unconditionally, no query made', async () => {
    await expect(assertCanAccessCircle(req({ role: 'admin', id: 'p1' }), 'c1')).resolves.toBe(true)
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('allows super_admin unconditionally, no query made', async () => {
    await expect(assertCanAccessCircle(req({ role: 'super_admin', id: 'p1' }), 'c1')).resolves.toBe(true)
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('denies when circleId is missing', async () => {
    await expect(assertCanAccessCircle(req({ role: 'admin', id: 'p1' }), '')).resolves.toBe(false)
  })

  it('allows a teacher assigned to the circle', async () => {
    queue('hifzi_circle_teachers', { data: [{ id: 'ct1' }] })
    await expect(assertCanAccessCircle(req({ role: 'teacher', id: 't1' }), 'c1')).resolves.toBe(true)
  })

  it('denies a teacher not assigned to the circle', async () => {
    queue('hifzi_circle_teachers', { data: [] })
    await expect(assertCanAccessCircle(req({ role: 'teacher', id: 't1' }), 'c1')).resolves.toBe(false)
  })

  it('denies a non-teacher, non-admin role (e.g. student) without querying', async () => {
    await expect(assertCanAccessCircle(req({ role: 'student', id: 's1' }), 'c1')).resolves.toBe(false)
    expect(fromMock).not.toHaveBeenCalled()
  })
})
