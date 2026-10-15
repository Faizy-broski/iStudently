// Real router; auth, role middleware's dependencies, controller and cron service stubbed.
jest.mock('../middlewares/auth.middleware', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.profile = { id: 'p1', role: req.headers['x-test-role'] ?? 'admin', school_id: 'school-a' }
    next()
  },
}))
jest.mock('../services/module-access.service', () => ({ decideStaffModuleAccess: () => ({ allowed: false }), loadProfilePermissions: async () => ({}) }))
jest.mock('../controllers/salary.controller', () => ({ salaryController: new Proxy({}, { get: () => (_req: any, res: any) => res.json({ success: true }) }) }))
const manualTriggerMonthlySalary = jest.fn(async (id?: string) => ({ ran: id ?? 'ALL' }))
jest.mock('../services/cron.service', () => ({ cronService: { manualTriggerMonthlySalary: (id?: string) => manualTriggerMonthlySalary(id) } }))

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
afterAll((done) => {
  server.close(() => done())
})
beforeEach(() => manualTriggerMonthlySalary.mockClear())

const trigger = (role: string, body: object = {}) =>
  fetch(`${base}/automation/trigger`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-test-role': role }, body: JSON.stringify(body) })

describe('POST /salary/automation/trigger', () => {
  it('a school admin without school_id runs it for their own school, never for all schools', async () => {
    expect((await trigger('admin')).status).toBe(200)
    expect(manualTriggerMonthlySalary).toHaveBeenCalledWith('school-a')
  })

  it('super admin may run it for all schools', async () => {
    await trigger('super_admin')
    expect(manualTriggerMonthlySalary).toHaveBeenCalledWith(undefined)
  })
})
