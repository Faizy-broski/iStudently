// Real router + row-scope middleware + controller; auth, family check, Supabase and the service stubbed.
// Texts used to be readable/editable by id from any school; session logs by any role.
jest.mock('../middlewares/auth.middleware', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    const role = req.headers['x-test-role']
    if (role) req.profile = { id: req.headers['x-test-id'] ?? 'p1', role, school_id: 's1' }
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
      let id = ''
      b.select = () => b
      b.eq = (_c: string, v: string) => ((id = v), b)
      b.maybeSingle = async () => ({ data: rows[id] ?? null, error: null })
      return b
    },
  },
}))
const service = {
  getText: jest.fn(async (id: string) => ({ id, title: 't' })),
  updateText: jest.fn(async (id: string) => ({ id })),
  deleteText: jest.fn(async () => undefined),
  getSessionLog: jest.fn(async (id: string) => ({ id, student_id: 'stu-1' })),
}
jest.mock('../services/speed-reading.service', () => ({ speedReadingService: service }))

import express from 'express'
import type { AddressInfo } from 'net'
import router from './speed-reading.routes'

let base = ''
let server: any
beforeAll((done) => {
  const app = express()
  app.use(express.json())
  app.use('/api/speed-reading', router)
  server = app.listen(0, () => {
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/speed-reading`
    done()
  })
})
afterAll(() => {
  server.close()
})
beforeEach(() => {
  for (const k of Object.keys(rows)) delete rows[k]
  jest.clearAllMocks()
})

const call = (method: string, path: string, role: string, id?: string) =>
  fetch(`${base}${path}`, { method, headers: { 'x-test-role': role, ...(id ? { 'x-test-id': id } : {}), 'content-type': 'application/json' }, body: method === 'GET' || method === 'DELETE' ? undefined : '{}' })

describe('speed-reading texts', () => {
  it("hides another school's text from read, edit and delete", async () => {
    rows['t1'] = { school_id: 's9' }
    expect((await call('GET', '/texts/t1', 'student')).status).toBe(404)
    expect((await call('PUT', '/texts/t1', 'teacher')).status).toBe(404)
    expect((await call('DELETE', '/texts/t1', 'admin')).status).toBe(404)
    expect(service.getText).not.toHaveBeenCalled()
    expect(service.updateText).not.toHaveBeenCalled()
    expect(service.deleteText).not.toHaveBeenCalled()
  })

  it("serves a text of the caller's school family (campus included)", async () => {
    rows['t2'] = { school_id: 'c1' }
    expect((await call('GET', '/texts/t2', 'student')).status).toBe(200)
    expect(service.getText).toHaveBeenCalledWith('t2')
  })
})

describe('speed-reading session logs', () => {
  it("lets staff open any log of the family, a student only their own", async () => {
    expect((await call('GET', '/logs/l1', 'admin')).status).toBe(200)
    expect((await call('GET', '/logs/l1', 'teacher')).status).toBe(200)
    expect((await call('GET', '/logs/l1', 'student', 'stu-1')).status).toBe(200)
    expect((await call('GET', '/logs/l1', 'student', 'stu-2')).status).toBe(404)
    expect((await call('GET', '/logs/l1', 'parent')).status).toBe(404)
  })
})
