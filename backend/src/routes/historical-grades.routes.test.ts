// Real routers + row-scope middleware; auth, family check, Supabase and the controller stubbed.
// Historical grades: admins only, and every student, past marking period, grade row and course
// period given by id must be in the caller's school family.
jest.mock('../middlewares/auth.middleware', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    const role = req.headers['x-test-role']
    if (role) req.profile = { id: req.headers['x-test-id'] ?? 'p1', role, school_id: 's1', student_id: req.headers['x-test-student'] }
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
jest.mock('../controllers/historical-grades.controller', () =>
  new Proxy({}, { get: (_t, name) => (name === '__esModule' ? true : jest.fn(ok)) }),
)

import express from 'express'
import type { AddressInfo } from 'net'
import mpRouter from './history-marking-periods.routes'
import gradesRouter from './historical-grades.routes'

let base = ''
let server: any
beforeAll((done) => {
  const app = express()
  app.use(express.json())
  app.use('/api/history-marking-periods', mpRouter)
  app.use('/api/historical-grades', gradesRouter)
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
  Object.assign(rows, {
    stuA: { school_id: 'c1', profile_id: 'pA' },
    stuX: { school_id: 's9', profile_id: 'pX' },
    mp1: { school_id: 's1' },
    mpX: { school_id: 's9' },
    g1: { school_id: 'c1' },
    gX: { school_id: 's9' },
    cpX: { school_id: 's9' },
  })
})

const call = (method: string, path: string, body?: unknown, role = 'admin') =>
  fetch(`${base}${path}`, { method, headers: { 'x-test-role': role, 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })

describe('history marking periods and historical grades routes', () => {
  it('is for admins only', async () => {
    expect((await call('GET', '/history-marking-periods', undefined, 'teacher')).status).toBe(403)
    expect((await call('GET', '/historical-grades/student/stuA/marking-periods', undefined, 'student')).status).toBe(403)
    expect((await call('GET', '/history-marking-periods')).status).toBe(200)
  })

  it("rejects another school's marking periods, students, grade rows and course periods", async () => {
    expect((await call('PUT', '/history-marking-periods/mpX', { name: 'Q1' })).status).toBe(404)
    expect((await call('DELETE', '/history-marking-periods/mp1')).status).toBe(200)
    expect((await call('GET', '/historical-grades/student/stuX/marking-periods')).status).toBe(404)
    expect((await call('POST', '/historical-grades/student/stuA/marking-periods', { marking_period_id: 'mpX' })).status).toBe(404)
    expect((await call('DELETE', '/historical-grades/student/stuA/marking-periods/mpX')).status).toBe(404)
    expect((await call('GET', '/historical-grades/student/stuA?marking_period_id=mpX')).status).toBe(404)
    expect((await call('POST', '/historical-grades/student/stuA', { marking_period_id: 'mp1', course_period_id: 'cpX', course_title: 'Math' })).status).toBe(404)
    expect((await call('POST', '/historical-grades/student/stuA', { marking_period_id: 'mp1', course_title: 'Math' })).status).toBe(200)
    expect((await call('PUT', '/historical-grades/gX', { course_title: 'Math' })).status).toBe(404)
    expect((await call('DELETE', '/historical-grades/g1')).status).toBe(200)
  })
})
