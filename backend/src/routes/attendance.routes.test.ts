// Real router; auth, the section check and the controller stubbed. The attendance chart and absence
// summary were admin-only, so the web teacher "Attendance Chart" page always failed.
jest.mock('../middlewares/auth.middleware', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    const role = req.headers['x-test-role']
    if (role) req.profile = { id: 'p1', role, school_id: 's1', staff_id: 'st1' }
    next()
  },
}))
jest.mock('../services/module-access.service', () => ({
  decideStaffModuleAccess: () => ({ allowed: false }),
  loadProfilePermissions: async () => ({}),
}))
jest.mock('../utils/student-access', () => ({
  ...jest.requireActual('../utils/student-access'),
  teachesSection: async (_req: any, section: string) => section === 'mine',
}))
const ok = (_req: any, res: any) => res.json({ success: true })
jest.mock('../controllers/attendance.controller', () => new Proxy({}, { get: (_t, name) => (name === '__esModule' ? true : jest.fn(ok)) }))

import express from 'express'
import type { AddressInfo } from 'net'
import router from './attendance.routes'

let base = ''
let server: any
beforeAll((done) => {
  const app = express()
  app.use('/api/attendance', router)
  server = app.listen(0, () => {
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/attendance`
    done()
  })
})
afterAll(() => server.close())

const get = (path: string, role: string) => fetch(`${base}${path}`, { headers: { 'x-test-role': role } })

describe('attendance report routes', () => {
  it('teachers only for a section they teach; admins for the school', async () => {
    for (const p of ['/reports/daily-summary-grid', '/reports/summary']) {
      expect((await get(`${p}?section_id=mine`, 'teacher')).status).toBe(200)
      expect((await get(`${p}?section_id=other`, 'teacher')).status).toBe(403)
      expect((await get(p, 'teacher')).status).toBe(403)
      expect((await get(p, 'admin')).status).toBe(200)
      expect((await get(p, 'student')).status).toBe(403)
    }
  })
})
