// Real router + row-scope middleware; auth, family check, Supabase and the controller stubbed.
// Billing elements: updates passed the raw body to the database (school_id could be rewritten, and a
// student element's amount_paid), and creates trusted category/grade/student/element ids from the body.
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
const updates: any[] = []
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
jest.mock('../services/billing-elements.service', () => ({
  billingElementsService: new Proxy(
    {},
    {
      get: (_t, name) => async (...args: any[]) => {
        if (String(name).startsWith('update')) updates.push(args[args.length - 1])
        return { ok: true }
      },
    },
  ),
}))

import express from 'express'
import type { AddressInfo } from 'net'
import router from './billing-elements.routes'

let base = ''
let server: any
beforeAll((done) => {
  const app = express()
  app.use(express.json())
  app.use('/api/billing-elements', router)
  server = app.listen(0, () => {
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/billing-elements`
    done()
  })
})
afterAll(() => {
  server.close()
})
beforeEach(() => {
  updates.length = 0
  for (const k of Object.keys(rows)) delete rows[k]
  Object.assign(rows, { cat1: { school_id: 's1' }, catX: { school_id: 's9' }, st1: { school_id: 'c1' }, stX: { school_id: 's9' }, el1: { school_id: 's1' }, elX: { school_id: 's9' } })
})

const send = (method: string, path: string, body: unknown) =>
  fetch(`${base}${path}`, { method, headers: { 'x-test-role': 'admin', 'content-type': 'application/json' }, body: JSON.stringify(body) })

describe('billing elements routes', () => {
  it('only writes known fields on update', async () => {
    expect((await send('PUT', '/elements/e1', { title: 'T', school_id: 's9', id: 'x' })).status).toBe(200)
    expect((await send('PUT', '/student-elements/se1', { amount: 5, amount_paid: 999, school_id: 's9' })).status).toBe(200)
    expect((await send('PUT', '/categories/c1', { title: 'C', school_id: 's9' })).status).toBe(200)
    expect(updates).toEqual([{ title: 'T' }, { amount: 5 }, { title: 'C' }])
  })

  it("rejects another school's ids in the body", async () => {
    expect((await send('POST', '/elements', { category_id: 'catX', title: 'T' })).status).toBe(404)
    expect((await send('POST', '/elements', { category_id: 'cat1', title: 'T' })).status).toBe(201)
    expect((await send('POST', '/student-elements/mass-assign', { student_ids: ['st1', 'stX'], element_title: 'x' })).status).toBe(404)
    expect((await send('POST', '/student-elements', { student_id: 'st1', billing_element_id: 'elX', element_title: 'x' })).status).toBe(404)
    expect((await send('POST', '/transactions', { student_id: 'stX', student_billing_element_id: 'se1', amount: 1 })).status).toBe(404)
  })
})
