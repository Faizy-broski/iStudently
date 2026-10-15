// Real router + row-scope middleware; auth, family check, Supabase and the controller stubbed.
// Schedule requests and templates used to be editable/deletable by id from any school.
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
const ok = (_req: any, res: any) => res.json({ success: true })
jest.mock('../controllers/schedule-requests.controller', () =>
  new Proxy({}, { get: (_t, name) => (name === '__esModule' ? true : jest.fn(ok)) }),
)

import express from 'express'
import type { AddressInfo } from 'net'
import router from './schedule-requests.routes'

let base = ''
let server: any
beforeAll((done) => {
  const app = express()
  app.use(express.json())
  app.use('/api/schedule-requests', router)
  server = app.listen(0, () => {
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/schedule-requests`
    done()
  })
})
afterAll(() => {
  server.close()
})
beforeEach(() => {
  for (const k of Object.keys(rows)) delete rows[k]
  Object.assign(rows, { r1: { school_id: 's1' }, rX: { school_id: 's9' }, tplX: { school_id: 's9' }, stu1: { school_id: 'c1' }, stuX: { school_id: 's9' }, co1: { school_id: 's1' }, coX: { school_id: 's9' }, tX: { school_id: 's9' }, pX: { school_id: 's9' } })
})

const call = (method: string, path: string, body?: unknown, role = 'admin') =>
  fetch(`${base}${path}`, { method, headers: { 'x-test-role': role, 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })

describe('schedule-requests routes', () => {
  it("rejects other schools' requests, templates, students and courses", async () => {
    expect((await call('PUT', '/rX', { priority: 1 })).status).toBe(404)
    expect((await call('DELETE', '/rX')).status).toBe(404)
    expect((await call('DELETE', '/templates/tplX')).status).toBe(404)
    expect((await call('POST', '/', { student_id: 'stuX', course_id: 'co1' }, 'student')).status).toBe(404)
    expect((await call('POST', '/mass', { student_ids: ['stu1'], course_id: 'coX' })).status).toBe(404)
    expect((await call('PUT', '/r1', { priority: 1 })).status).toBe(200)
  })

  it("rejects another school's teacher or period as a preference", async () => {
    expect((await call('POST', '/mass', { student_ids: ['stu1'], course_id: 'co1', with_teacher_id: 'tX' })).status).toBe(404)
    expect((await call('POST', '/', { student_id: 'stu1', course_id: 'co1', not_period_id: 'pX' })).status).toBe(404)
    expect((await call('PUT', '/r1', { with_period_id: 'pX' })).status).toBe(404)
  })

  it('students list and request courses only for themselves', async () => {
    rows.stu2 = { school_id: 's1' }
    expect((await call('GET', '/?academic_year_id=y1', undefined, 'student')).status).toBe(403)
    expect((await call('GET', '/?academic_year_id=y1&student_id=stu2', undefined, 'student')).status).toBe(403)
    expect((await call('GET', '/?academic_year_id=y1&student_id=stu1', undefined, 'student')).status).toBe(200)
    expect((await call('POST', '/', { student_id: 'stu2', course_id: 'co1' }, 'student')).status).toBe(403)
    expect((await call('POST', '/', { student_id: 'stu1', course_id: 'co1' }, 'student')).status).toBe(200)
    expect((await call('GET', '/?academic_year_id=y1')).status).toBe(200)
  })
})
