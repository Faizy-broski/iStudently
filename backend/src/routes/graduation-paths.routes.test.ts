// Real router + row-scope middleware; auth, family check, Supabase and the controller stubbed.
// Graduation paths: any signed-in user could read or change another school's path by id, and
// assign another school's grade levels, subjects or students.
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
jest.mock('../controllers/graduation-paths.controller', () =>
  new Proxy({}, { get: (_t, name) => (name === '__esModule' ? true : jest.fn(ok)) }),
)

import express from 'express'
import type { AddressInfo } from 'net'
import router from './graduation-paths.routes'

let base = ''
let server: any
beforeAll((done) => {
  const app = express()
  app.use(express.json())
  app.use('/api/graduation-paths', router)
  server = app.listen(0, () => {
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/graduation-paths`
    done()
  })
})
afterAll(() => {
  server.close()
})
beforeEach(() => {
  for (const k of Object.keys(rows)) delete rows[k]
  Object.assign(rows, { p1: { school_id: 's1' }, pX: { school_id: 's9' }, g1: { school_id: 'c1' }, gX: { school_id: 's9' }, subX: { school_id: 's9' }, stuX: { school_id: 's9' } })
})

const call = (method: string, path: string, body?: unknown, role = 'admin') =>
  fetch(`${base}${path}`, { method, headers: { 'x-test-role': role, 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })

describe('graduation-paths routes', () => {
  it("rejects another school's paths and assignments", async () => {
    expect((await call('GET', '/pX')).status).toBe(404)
    expect((await call('DELETE', '/pX')).status).toBe(404)
    expect((await call('POST', '/p1/grade-levels', { grade_level_ids: ['g1', 'gX'] })).status).toBe(404)
    expect((await call('POST', '/p1/subjects', { subjects: [{ subject_id: 'subX', credits: 1 }] })).status).toBe(404)
    expect((await call('POST', '/p1/students', { student_ids: ['stuX'] })).status).toBe(404)
    expect((await call('GET', '/p1/students/stuX/credits')).status).toBe(404)
    expect((await call('POST', '/p1/grade-levels', { grade_level_ids: ['g1'] })).status).toBe(200)
  })
})
