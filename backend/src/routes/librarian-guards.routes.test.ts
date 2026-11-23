// A librarian must not reach school-wide student money or rank data (fees, billing, grades-reports),
// but the staff roles that need it still do. Real routers; auth, Supabase and controllers stubbed.
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
jest.mock('../utils/campus-validation', () => ({ campusIdsAllowed: async () => true }))
jest.mock('../config/supabase', () => ({
  supabase: { from: () => { const b: any = {}; for (const m of ['select', 'eq', 'in', 'not', 'order', 'limit', 'gte', 'lte']) b[m] = () => b; b.maybeSingle = async () => ({ data: null, error: null }); b.single = b.maybeSingle; b.then = (r: any) => r({ data: [], error: null }); return b } },
}))
const ok = (_req: any, res: any) => res.json({ success: true })
jest.mock('../controllers/fees.controller', () => ({ feesController: new Proxy({}, { get: () => jest.fn(ok) }) }))
jest.mock('../controllers/grades-reports.controller', () => new Proxy({}, { get: () => jest.fn(ok) }))

import express from 'express'
import type { AddressInfo } from 'net'
import feesRouter from './fees.routes'
import gradesReportsRouter from './grades-reports.routes'
import billingRouter from './billing-elements.routes'
import { requireStaffNoLibrarian } from '../middlewares/role.middleware'

let base = ''
let server: any
beforeAll((done) => {
  const app = express()
  app.use(express.json())
  app.use('/api/fees', feesRouter)
  app.use('/api/grades-reports', gradesReportsRouter)
  app.use('/api/billing-elements', billingRouter)
  server = app.listen(0, () => {
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`
    done()
  })
})
afterAll(() => server.close())

const call = (method: string, path: string, role: string) =>
  fetch(`${base}${path}`, { method, headers: { 'x-test-role': role, 'content-type': 'application/json' }, body: method === 'GET' ? undefined : '{}' })

describe('librarian is kept out of fees, billing and rank data', () => {
  const reads = ['/fees/students', '/fees/payments/all-with-students', '/fees/dashboard', '/grades-reports/honor-roll', '/grades-reports/class-rank', '/billing-elements/transactions', '/billing-elements/students']
  it.each(reads)('GET %s is 403 for a librarian', async (p) => {
    expect((await call('GET', p, 'librarian')).status).toBe(403)
  })
  it.each(['/fees/payments', '/fees/payments/record', '/billing-elements/transactions', '/billing-elements/student-elements'])('POST %s is 403 for a librarian', async (p) => {
    expect((await call('POST', p, 'librarian')).status).toBe(403)
  })
  it('admins and teachers still pass the same routes', async () => {
    for (const role of ['admin', 'teacher']) {
      expect((await call('GET', '/fees/students', role)).status).toBe(200)
      expect((await call('GET', '/grades-reports/honor-roll', role)).status).toBe(200)
    }
  })
  it('requireStaffNoLibrarian is a function middleware', () => {
    expect(typeof requireStaffNoLibrarian).toBe('function')
  })
})
