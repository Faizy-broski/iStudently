// Real router + row-scope middleware; auth, family check, Supabase and the controller stubbed.
// Final grades: any signed-in user could read a class's or a student's final grades by id, and
// teachers could save grades into other schools' course periods.
jest.mock('../middlewares/auth.middleware', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    const role = req.headers['x-test-role']
    if (role) req.profile = { id: req.headers['x-test-id'] ?? 'p1', role, school_id: 's1', staff_id: 't1', student_id: req.headers['x-test-student'] }
    next()
  },
}))
jest.mock('../services/module-access.service', () => ({
  decideStaffModuleAccess: () => ({ allowed: false }),
  loadProfilePermissions: async () => ({}),
}))
jest.mock('../utils/campus-validation', () => ({
  campusIdsAllowed: async (_own: string, ids: string[]) => ids.every((id) => id === 's1' || id === 'c1'),
}))
const rows: Record<string, any> = {}
jest.mock('../config/supabase', () => ({
  supabase: {
    from: () => {
      const b: any = {}
      let ids: string[] = []
      b.select = () => b
      b.or = () => b
      b.limit = () => b
      b.eq = (_c: string, v: string) => ((ids = [v]), b)
      b.in = (_c: string, v: string[]) => ((ids = v), b)
      b.maybeSingle = async () => ({ data: rows[ids[0]] ?? null, error: null })
      b.then = (resolve: any) => resolve({ data: ids.filter((i) => rows[i]).map((i) => ({ id: i, ...rows[i] })), error: null })
      return b
    },
  },
}))
const ok = (_req: any, res: any) => res.json({ success: true })
jest.mock('../controllers/final-grades.controller', () =>
  new Proxy({}, { get: (_t, name) => (name === '__esModule' ? true : jest.fn(ok)) }),
)

import express from 'express'
import type { AddressInfo } from 'net'
import router from './final-grades.routes'

let base = ''
let server: any
beforeAll((done) => {
  const app = express()
  app.use(express.json())
  app.use('/api/final-grades', router)
  server = app.listen(0, () => {
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/final-grades`
    done()
  })
})
afterAll(() => {
  server.close()
})
beforeEach(() => {
  for (const k of Object.keys(rows)) delete rows[k]
  Object.assign(rows, { stuA: { school_id: 'c1', profile_id: 'pA' }, stuX: { school_id: 's9', profile_id: 'pX' }, cp1: { school_id: 's1', teacher_id: 't1' }, cpCo: { school_id: 's1', teacher_id: 't2', secondary_teacher_id: 't1' }, cpOther: { school_id: 's1', teacher_id: 't2' }, cpX: { school_id: 's9' } })
})

const call = (method: string, path: string, body?: unknown, role = 'admin', headers: Record<string, string> = {}) =>
  fetch(`${base}${path}`, { method, headers: { 'x-test-role': role, 'content-type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) })

describe('final-grades routes', () => {
  it('keeps a teacher to their own course periods (admins pass)', async () => {
    expect((await call('GET', '/?course_period_id=cpOther', undefined, 'teacher')).status).toBe(403)
    expect((await call('POST', '/', { student_id: 'stuA', course_period_id: 'cpOther' }, 'teacher')).status).toBe(403)
    expect((await call('POST', '/calculate', { course_period_id: 'cpOther' }, 'teacher')).status).toBe(403)
    expect((await call('POST', '/completion', { course_period_id: 'cpOther' }, 'teacher')).status).toBe(403)
    expect((await call('POST', '/', { student_id: 'stuA', course_period_id: 'cpCo' }, 'teacher')).status).toBe(200)
    expect((await call('POST', '/', { student_id: 'stuA', course_period_id: 'cpOther' })).status).toBe(200)
  })

  it('keeps class lists to staff of the family and one student to that student', async () => {
    expect((await call('GET', '/?course_period_id=cp1', undefined, 'student')).status).toBe(403)
    expect((await call('GET', '/?course_period_id=cpX', undefined, 'teacher')).status).toBe(404)
    expect((await call('GET', '/student/stuX', undefined, 'teacher')).status).toBe(404)
    expect((await call('GET', '/breakdown/stuA', undefined, 'student', { 'x-test-id': 'pA', 'x-test-student': 'stuA' })).status).toBe(200)
  })

  it("rejects saving into another school's course period or for its students", async () => {
    expect((await call('POST', '/', { student_id: 'stuA', course_period_id: 'cpX' }, 'teacher')).status).toBe(404)
    expect((await call('POST', '/', { student_id: 'stuX', course_period_id: 'cp1' }, 'teacher')).status).toBe(404)
    expect((await call('POST', '/', { student_id: 'stuA', course_period_id: 'cp1' }, 'teacher')).status).toBe(200)
  })

  it('generates grade lists for staff, and for a student only about themselves', async () => {
    const body = (ids: string[]) => ({ student_ids: ids, marking_period_ids: ['mp1'], options: {} })
    const self = { 'x-test-id': 'pA', 'x-test-student': 'stuA' }
    expect((await call('POST', '/generate', body(['stuA']), 'student', self)).status).toBe(200)
    expect((await call('POST', '/generate', body(['stuA', 'stuX']), 'student', self)).status).toBe(403)
    expect((await call('POST', '/generate', body(['stuA']), 'teacher')).status).toBe(200)
    expect((await call('POST', '/generate', body(['stuX']), 'teacher')).status).toBe(404)
    expect((await call('POST', '/generate', body(['stuX']))).status).toBe(404)
    expect((await call('POST', '/generate', body(['stuA']))).status).toBe(200)
  })
})
