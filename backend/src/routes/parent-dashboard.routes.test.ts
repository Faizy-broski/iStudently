// Real router; auth, the link check and the controller stubbed. Parents may only read linked children.
jest.mock('../middlewares/auth.middleware', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    const role = req.headers['x-test-role']
    if (role) req.profile = { id: 'p1', role, school_id: 's1' }
    next()
  },
}))
jest.mock('../utils/student-access', () => ({
  canViewStudent: async (_req: any, id: string) => id === 'mine',
}))
const ok = (_req: any, res: any) => res.json({ success: true })
jest.mock('../controllers/parent-dashboard.controller', () => ({
  parentDashboardController: new Proxy({}, { get: () => jest.fn(ok) }),
}))

import express from 'express'
import type { AddressInfo } from 'net'
import router from './parent-dashboard.routes'

let base = ''
let server: any
beforeAll((done) => {
  const app = express()
  app.use('/api/parent-dashboard', router)
  server = app.listen(0, () => {
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/parent-dashboard`
    done()
  })
})
afterAll(() => server.close())

const get = (path: string) => fetch(`${base}${path}`, { headers: { 'x-test-role': 'parent' } })

describe('parent-dashboard routes', () => {
  it("rejects children that are not linked to the parent", async () => {
    for (const p of ['fees/other/payment-history', 'grades/other/final', 'id-card/other', 'report-card/other', 'discipline/other', 'attendance/other/detailed', 'timetable/other']) {
      expect((await get(`/${p}`)).status).toBe(403)
    }
    expect((await get('/fees/mine/payment-history')).status).toBe(200)
    expect((await get('/students')).status).toBe(200)
  })
})
