// Real router + role middleware; auth and controller stubbed.
jest.mock('../middlewares/auth.middleware', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.profile = { id: 'p1', role: req.headers['x-test-role'] ?? 'student', school_id: 's1' }
    next()
  },
}))
jest.mock('../services/module-access.service', () => ({
  decideStaffModuleAccess: () => ({ allowed: false }),
  loadProfilePermissions: async () => ({}),
}))
const ok = (_req: any, res: any) => res.json({ success: true })
jest.mock('../controllers/default-field-order.controller', () => ({
  DefaultFieldOrderController: { getFieldOrders: ok, saveFieldOrders: ok, updateFieldRequired: ok, deleteFieldOrders: ok, resetAllFieldOrders: ok },
}))

import express from 'express'
import type { AddressInfo } from 'net'
import router from './default-field-order.routes'

let base = ''
let server: any
beforeAll((done) => {
  const app = express()
  app.use(express.json())
  app.use('/api/default-field-orders', router)
  server = app.listen(0, () => {
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/default-field-orders`
    done()
  })
})
afterAll((done) => {
  server.close(() => done())
})

const call = (method: string, path: string, role: string) =>
  fetch(`${base}${path}`, { method, headers: { 'x-test-role': role, 'content-type': 'application/json' }, body: method === 'GET' ? undefined : '{}' })

describe('default field orders', () => {
  it('anyone signed in can read (forms need it)', async () => {
    expect((await call('GET', '/student', 'student')).status).toBe(200)
  })

  it('students, parents and teachers cannot change or reset them', async () => {
    for (const role of ['student', 'parent', 'teacher']) {
      expect((await call('POST', '/student/personal', role)).status).toBe(403)
      expect((await call('POST', '/student/personal/required', role)).status).toBe(403)
      expect((await call('DELETE', '/student/personal', role)).status).toBe(403)
      expect((await call('DELETE', '/student', role)).status).toBe(403)
    }
  })

  it('admins can', async () => {
    expect((await call('POST', '/student/personal', 'admin')).status).toBe(200)
    expect((await call('DELETE', '/student', 'admin')).status).toBe(200)
  })
})
