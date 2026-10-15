// Real router + controller + campus validation; auth, the dashboard service and Supabase stubbed.
jest.mock('../middlewares/auth.middleware', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.profile = { id: 'p1', role: 'admin', school_id: 'main' }
    next()
  },
}))
jest.mock('../services/module-access.service', () => ({
  decideStaffModuleAccess: () => ({ allowed: false }),
  loadProfilePermissions: async () => ({}),
}))
const getSchoolStats = jest.fn(async () => ({ ok: true }))
const getAttendanceData = jest.fn(async () => [])
jest.mock('../services/school-dashboard.service', () => ({
  SchoolDashboardService: jest.fn().mockImplementation(() => ({ getSchoolStats, getAttendanceData })),
}))
// schools: 'branch' belongs to 'main'; 'other' belongs to someone else.
const PARENTS: Record<string, string | null> = { branch: 'main', other: 'elsewhere' }
jest.mock('../config/supabase', () => ({
  supabase: {
    from: () => {
      let id = ''
      const b: any = {
        select: () => b,
        eq: (_c: string, v: string) => ((id = v), b),
        single: async () => (id in PARENTS ? { data: { id, parent_school_id: PARENTS[id] }, error: null } : { data: null, error: { message: 'none' } }),
      }
      return b
    },
  },
}))

import express from 'express'
import type { AddressInfo } from 'net'
import router from './school-dashboard.routes'

let base = ''
let server: any
beforeAll((done) => {
  const app = express()
  app.use('/api/school-dashboard', router)
  server = app.listen(0, () => {
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/school-dashboard`
    done()
  })
})
afterAll((done) => {
  server.close(() => done())
})
beforeEach(() => jest.clearAllMocks())

describe('school dashboard campus_id', () => {
  it('uses the own school when no campus is given', async () => {
    expect((await fetch(`${base}/stats`)).status).toBe(200)
    expect(getSchoolStats).toHaveBeenCalledWith('main', undefined, undefined)
  })

  it('allows a branch of the own school', async () => {
    expect((await fetch(`${base}/attendance?campus_id=branch`)).status).toBe(200)
    expect(getAttendanceData).toHaveBeenCalledWith('branch')
  })

  it("refuses another school's campus", async () => {
    const res = await fetch(`${base}/attendance?campus_id=other`)
    expect(res.status).toBe(403)
    expect(getAttendanceData).not.toHaveBeenCalled()
    expect((await fetch(`${base}/stats?campus_id=unknown`)).status).toBe(403)
    expect(getSchoolStats).not.toHaveBeenCalled()
  })
})
