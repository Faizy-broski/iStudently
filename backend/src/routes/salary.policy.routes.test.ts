// Real router + row-scope middleware; auth, family check, Supabase and the controller stubbed.
// Salary: a policy group could be read, changed or have teachers removed by id from any school.
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
jest.mock('../controllers/salary.controller', () => ({
  salaryController: new Proxy({}, { get: () => jest.fn(ok) }),
}))
jest.mock('../services/cron.service', () => ({ cronService: {} }))

import express from 'express'
import type { AddressInfo } from 'net'
import router from './salary.routes'

let base = ''
let server: any
beforeAll((done) => {
  const app = express()
  app.use(express.json())
  app.use('/api/salary', router)
  server = app.listen(0, () => {
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/salary`
    done()
  })
})
afterAll(() => {
  server.close()
})
beforeEach(() => {
  for (const k of Object.keys(rows)) delete rows[k]
  Object.assign(rows, { pg1: { school_id: 's1' }, pgX: { school_id: 's9' }, st1: { school_id: 'c1' }, stX: { school_id: 's9' } })
})

const send = (method: string, path: string, body?: unknown) =>
  fetch(`${base}${path}`, { method, headers: { 'x-test-role': 'admin', 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })

describe('salary policy routes', () => {
  it("rejects another school's policy group or staff", async () => {
    expect((await send('GET', '/policies/pgX')).status).toBe(404)
    expect((await send('GET', '/policies/pg1')).status).toBe(200)
    expect((await send('DELETE', '/policies/pgX/teachers/st1')).status).toBe(404)
    expect((await send('DELETE', '/policies/pg1/teachers/stX')).status).toBe(404)
    expect((await send('DELETE', '/policies/pg1/teachers/st1')).status).toBe(200)
    expect((await send('POST', '/policies/pgX/assign', { school_id: 's1', staff_ids: ['st1'] })).status).toBe(404)
  })
})
