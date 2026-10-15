// Real router + row-scope middleware; auth, family check, Supabase and the controller stubbed.
// Custom fields: any signed-in user could create, change or delete field definitions, and
// "selected campuses" could name another school's campus.
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
jest.mock('../controllers/custom-fields.controller', () => ({
  customFieldsController: new Proxy({}, { get: () => ({ bind: () => jest.fn(ok) }) }),
}))

import express from 'express'
import type { AddressInfo } from 'net'
import router from './custom-fields.routes'

let base = ''
let server: any
beforeAll((done) => {
  const app = express()
  app.use(express.json())
  app.use('/api/custom-fields', router)
  server = app.listen(0, () => {
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/custom-fields`
    done()
  })
})
afterAll(() => {
  server.close()
})

const call = (method: string, path: string, body?: unknown, role = 'admin') =>
  fetch(`${base}${path}`, { method, headers: { 'x-test-role': role, 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })

describe('custom-fields routes', () => {
  it('lets only admins/staff change definitions, on their own campuses', async () => {
    expect((await call('POST', '/', { label: 'x' }, 'student')).status).toBe(403)
    expect((await call('PATCH', '/f1', { label: 'x' }, 'parent')).status).toBe(403)
    expect((await call('DELETE', '/f1', undefined, 'teacher')).status).toBe(403)
    expect((await call('POST', '/', { label: 'x', applicable_school_ids: ['c1', 's9'] })).status).toBe(403)
    expect((await call('POST', '/', { label: 'x', applicable_school_ids: ['c1'] })).status).toBe(200)
    expect((await call('GET', '/student', undefined, 'student')).status).toBe(200)
  })
})
