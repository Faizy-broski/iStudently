// Real router + row-scope middleware; auth, family check, Supabase and the controller stubbed.
// Fees: a direct payment or a fee override could name another school's student or fee category.
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
jest.mock('../controllers/fees.controller', () => ({
  feesController: new Proxy({}, { get: () => jest.fn(ok) }),
}))

import express from 'express'
import type { AddressInfo } from 'net'
import router from './fees.routes'

let base = ''
let server: any
beforeAll((done) => {
  const app = express()
  app.use(express.json())
  app.use('/api/fees', router)
  server = app.listen(0, () => {
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/fees`
    done()
  })
})
afterAll(() => {
  server.close()
})
beforeEach(() => {
  for (const k of Object.keys(rows)) delete rows[k]
  Object.assign(rows, {
    st1: { school_id: 'c1' },
    stX: { school_id: 's9' },
    cat1: { school_id: 's1' },
    catX: { school_id: 's9' },
    g1: { school_id: 's1' },
    gX: { school_id: 's9' },
    sec1: { school_id: 'c1' },
    secX: { school_id: 's9' },
  })
})

const post = (path: string, body: unknown) =>
  fetch(`${base}${path}`, { method: 'POST', headers: { 'x-test-role': 'admin', 'content-type': 'application/json' }, body: JSON.stringify(body) })

describe('fees routes', () => {
  it("rejects another school's student on a direct payment", async () => {
    expect((await post('/payments/record', { student_id: 'stX', amount: 10 })).status).toBe(404)
    expect((await post('/payments/record', { student_id: 'st1', amount: 10 })).status).toBe(200)
  })

  it("rejects another school's student or category on an override", async () => {
    expect((await post('/overrides', { student_id: 'stX', fee_category_id: 'cat1', override_amount: 1 })).status).toBe(404)
    expect((await post('/overrides', { student_id: 'st1', fee_category_id: 'catX', override_amount: 1 })).status).toBe(404)
    expect((await post('/overrides', { student_id: 'st1', fee_category_id: 'cat1', override_amount: 1 })).status).toBe(200)
  })

  it("rejects another school's student, grades or sections when generating fees", async () => {
    expect((await post('/generate-for-student', { student_id: 'stX', grade_id: 'g1', academic_year: 'y' })).status).toBe(404)
    expect((await post('/generate-for-student', { student_id: 'st1', grade_id: 'gX', academic_year: 'y' })).status).toBe(404)
    expect((await post('/generate-for-student', { student_id: 'st1', grade_id: 'g1', academic_year: 'y' })).status).toBe(200)
    expect((await post('/generate-monthly', { grade_level_id: ['g1', 'gX'] })).status).toBe(404)
    expect((await post('/generate-monthly', { grade_level_id: ['g1'], section_id: ['secX'] })).status).toBe(404)
    expect((await post('/generate-monthly', { grade_level_id: ['g1'], section_id: ['sec1'] })).status).toBe(200)
  })
})
