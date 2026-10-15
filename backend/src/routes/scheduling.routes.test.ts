// Real router + row-scope middleware; auth, family check, Supabase and the controller stubbed.
// Schedules, class lists (student names), enroll/drop and teacher availability used to accept ids
// from any school.
jest.mock('../middlewares/auth.middleware', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    const role = req.headers['x-test-role']
    if (role) req.profile = { id: 'p1', role, school_id: 's1', student_id: role === 'student' ? 'stu1' : null }
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
      b.eq = (_c: string, v: string) => ((ids = [v]), b)
      b.in = (_c: string, v: string[]) => ((ids = v), b)
      b.maybeSingle = async () => ({ data: rows[ids[0]] ?? null, error: null })
      b.then = (resolve: any) => resolve({ data: ids.filter((i) => rows[i]).map((i) => ({ id: i, ...rows[i] })), error: null })
      return b
    },
  },
}))
jest.mock('../utils/student-access', () => ({
  ...jest.requireActual('../utils/student-access'),
  canViewClassList: async (req: any, cp: string) => !['student', 'parent'].includes(req.profile?.role) || cp === 'cp1',
}))
const ok = (_req: any, res: any) => res.json({ success: true })
jest.mock('../controllers/scheduling.controller', () =>
  new Proxy({}, { get: (_t, name) => (name === '__esModule' ? true : jest.fn(ok)) }),
)

import express from 'express'
import type { AddressInfo } from 'net'
import router from './scheduling.routes'

let base = ''
let server: any
beforeAll((done) => {
  const app = express()
  app.use(express.json())
  app.use('/api/scheduling', router)
  server = app.listen(0, () => {
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/scheduling`
    done()
  })
})
afterAll(() => {
  server.close()
})
beforeEach(() => {
  for (const k of Object.keys(rows)) delete rows[k]
  Object.assign(rows, { stu1: { school_id: 'c1' }, stu2: { school_id: 's1' }, stuX: { school_id: 's9' }, cp1: { school_id: 's1' }, cpX: { school_id: 's9' }, tX: { school_id: 's9' } })
})

const call = (method: string, path: string, body?: unknown, role = 'admin') =>
  fetch(`${base}${path}`, { method, headers: { 'x-test-role': role, 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })

describe('scheduling routes', () => {
  it("hides other schools' schedules, class lists and teacher availability", async () => {
    expect((await call('GET', '/student/stuX', undefined, 'teacher')).status).toBe(404)
    expect((await call('GET', '/class-list/cpX', undefined, 'student')).status).toBe(404)
    // Students and parents: only classes they (their children) are enrolled in.
    rows.cp2 = { school_id: 's1' }
    expect((await call('GET', '/class-list/cp2', undefined, 'student')).status).toBe(403)
    expect((await call('GET', '/class-list/cp2', undefined, 'parent')).status).toBe(403)
    expect((await call('GET', '/class-list/cp1', undefined, 'parent')).status).toBe(200)
    expect((await call('GET', '/class-list/cp2', undefined, 'teacher')).status).toBe(200)
    expect((await call('GET', '/teacher-availability/tX', undefined, 'teacher')).status).toBe(404)
    expect((await call('GET', '/student/stu1', undefined, 'teacher')).status).toBe(200)
    expect((await call('GET', '/check-conflicts?student_id=stuX&course_period_id=cp1')).status).toBe(404)
    expect((await call('GET', '/check-conflicts?student_id=stu1&course_period_id=cpX')).status).toBe(404)
  })

  it('rejects enroll/drop when any student or the course period is foreign', async () => {
    expect((await call('POST', '/mass-enroll', { student_ids: ['stu1', 'stuX'], course_period_id: 'cp1' })).status).toBe(404)
    expect((await call('POST', '/mass-drop', { student_ids: ['stu1', 'missing'], course_period_id: 'cp1' })).status).toBe(404)
    expect((await call('POST', '/enroll', { student_id: 'stu1', course_period_id: 'cpX' })).status).toBe(404)
    expect((await call('POST', '/mass-enroll', { student_ids: ['stu1', 'stu2'], course_period_id: 'cp1' })).status).toBe(200)
  })

  it("a student sees only their own schedule", async () => {
    rows.stu2 = { school_id: 's1' }
    expect((await call('GET', '/student/stu1', undefined, 'student')).status).toBe(200)
    expect((await call('GET', '/student/stu1/history', undefined, 'student')).status).toBe(200)
    expect((await call('GET', '/student/stu2', undefined, 'student')).status).toBe(403)
    expect((await call('GET', '/student/stu2/history', undefined, 'student')).status).toBe(403)
  })
})
