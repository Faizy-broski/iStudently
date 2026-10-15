// Real router + row-scope middleware; auth, family check, Supabase and the controller stubbed.
// Accounting: incomes, expenses and staff payments trusted the category and staff ids in the body.
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
jest.mock('../controllers/accounting.controller', () => ({
  accountingController: new Proxy({}, { get: () => jest.fn(ok) }),
}))

import express from 'express'
import type { AddressInfo } from 'net'
import router from './accounting.routes'

let base = ''
let server: any
beforeAll((done) => {
  const app = express()
  app.use(express.json())
  app.use('/api/accounting', router)
  server = app.listen(0, () => {
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/accounting`
    done()
  })
})
afterAll(() => {
  server.close()
})
beforeEach(() => {
  for (const k of Object.keys(rows)) delete rows[k]
  // Categories are keyed by campus_id, staff by school_id.
  Object.assign(rows, { cat1: { campus_id: 'c1' }, catX: { campus_id: 's9' }, st1: { school_id: 's1' }, stX: { school_id: 's9' } })
})

const send = (method: string, path: string, body: unknown) =>
  fetch(`${base}${path}`, { method, headers: { 'x-test-role': 'admin', 'content-type': 'application/json' }, body: JSON.stringify(body) })

describe('accounting routes', () => {
  it("rejects another school's category", async () => {
    expect((await send('POST', '/incomes', { category_id: 'catX', title: 'x' })).status).toBe(404)
    expect((await send('PUT', '/expenses/e1', { category_id: 'catX' })).status).toBe(404)
    expect((await send('POST', '/incomes', { category_id: 'cat1', title: 'x' })).status).toBe(200)
    expect((await send('POST', '/expenses', { title: 'no category' })).status).toBe(200)
  })

  it("rejects another school's staff on a staff payment", async () => {
    expect((await send('POST', '/staff-payments', { staff_id: 'stX', title: 'x' })).status).toBe(404)
    expect((await send('POST', '/staff-payments', { staff_id: 'st1', title: 'x' })).status).toBe(200)
  })
})
