// Real router + row-scope middleware; auth, family check, Supabase and the controller stubbed.
// Student bulk import: the target grade/section (and the per-row ones in "whole school" mode) were
// never checked, so an admin could enroll new students into another school's classes.
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
jest.mock('../controllers/student.controller', () => ({
  StudentController: class {
    constructor() {
      return new Proxy({}, { get: () => jest.fn(ok) })
    }
  },
}))
jest.mock('../services/parent.service', () => ({ getStudentRelatives: jest.fn() }))

import express from 'express'
import type { AddressInfo } from 'net'
import router from './student.routes'

let base = ''
let server: any
beforeAll((done) => {
  const app = express()
  app.use(express.json())
  app.use('/api/students', router)
  server = app.listen(0, () => {
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/students`
    done()
  })
})
afterAll(() => {
  server.close()
})
beforeEach(() => {
  for (const k of Object.keys(rows)) delete rows[k]
  Object.assign(rows, { g1: { school_id: 'c1' }, gX: { school_id: 's9' }, sec1: { school_id: 's1' }, secX: { school_id: 's9' } })
})

const post = (body: unknown) =>
  fetch(`${base}/bulk-import`, { method: 'POST', headers: { 'x-test-role': 'admin', 'content-type': 'application/json' }, body: JSON.stringify(body) })
const student = { first_name: 'A', last_name: 'B', email: '' }

describe('student bulk import', () => {
  it("rejects another school's target grade or section", async () => {
    expect((await post({ students: [student], grade_level_id: 'gX' })).status).toBe(404)
    expect((await post({ students: [student], grade_level_id: 'g1', section_id: 'secX' })).status).toBe(404)
    expect((await post({ students: [student], grade_level_id: 'g1', section_id: 'sec1' })).status).toBe(200)
  })

  it("rejects another school's per-row grade or section (whole school mode)", async () => {
    expect((await post({ students: [{ ...student, grade_level_id: 'g1' }, { ...student, grade_level_id: 'gX' }] })).status).toBe(404)
    expect((await post({ students: [{ ...student, grade_level_id: 'g1', section_id: 'secX' }] })).status).toBe(404)
    expect((await post({ students: [{ ...student, grade_level_id: 'g1', section_id: 'sec1' }] })).status).toBe(200)
  })
})
