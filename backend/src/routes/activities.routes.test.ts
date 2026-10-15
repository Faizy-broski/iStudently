// Real router + row-scope middleware; auth, family check, Supabase and the controller stubbed.
// Activities: admins could edit/delete any school's activities and enroll its students; eligibility
// read/wrote any school's course periods.
jest.mock('../middlewares/auth.middleware', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    const role = req.headers['x-test-role']
    if (role) req.profile = { id: 'p1', role, school_id: 's1' }
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
const ok = (_req: any, res: any) => res.json({ success: true })
jest.mock('../controllers/activities.controller', () =>
  new Proxy({}, { get: (_t, name) => (name === '__esModule' ? true : jest.fn(ok)) }),
)

import express from 'express'
import type { AddressInfo } from 'net'
import router from './activities.routes'

let base = ''
let server: any
beforeAll((done) => {
  const app = express()
  app.use(express.json())
  app.use('/api', router)
  server = app.listen(0, () => {
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`
    done()
  })
})
afterAll(() => {
  server.close()
})
beforeEach(() => {
  for (const k of Object.keys(rows)) delete rows[k]
  Object.assign(rows, { act1: { school_id: 's1' }, actX: { school_id: 's9' }, stu1: { school_id: 'c1' }, stuX: { school_id: 's9' }, cp1: { school_id: 's1' }, cpX: { school_id: 's9' } })
})

const call = (method: string, path: string, body?: unknown, role = 'admin') =>
  fetch(`${base}${path}`, { method, headers: { 'x-test-role': role, 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })

describe('activities routes', () => {
  it("rejects other schools' activities and students", async () => {
    expect((await call('PATCH', '/activities/actX', { title: 'x' })).status).toBe(404)
    expect((await call('DELETE', '/activities/actX')).status).toBe(404)
    expect((await call('POST', '/activities/act1/students', { student_ids: ['stu1', 'stuX'] })).status).toBe(404)
    expect((await call('DELETE', '/activities/act1/students/stuX')).status).toBe(404)
    expect((await call('POST', '/activities/act1/students', { student_ids: ['stu1'] })).status).toBe(200)
  })

  it("rejects eligibility for another school's course period or students", async () => {
    expect((await call('GET', '/activities/eligibility?course_period_id=cpX&school_date=2026-10-01', undefined, 'teacher')).status).toBe(404)
    expect((await call('POST', '/activities/eligibility', { course_period_id: 'cp1', school_date: '2026-10-01', records: [{ student_id: 'stuX' }] }, 'teacher')).status).toBe(404)
  })
})
