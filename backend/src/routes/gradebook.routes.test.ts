// Real router + row-scope middleware; auth, family check, Supabase and the controller stubbed.
// Any signed-in user could read any student's grades and any school's assignments; teachers could
// change other schools' assignments and types.
jest.mock('../middlewares/auth.middleware', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    const role = req.headers['x-test-role']
    if (role) req.profile = { id: req.headers['x-test-id'] ?? 'p1', role, school_id: 's1', staff_id: 't1', student_id: req.headers['x-test-student'] }
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
      b.or = () => b
      b.limit = () => b
      b.eq = (_c: string, v: string) => ((ids = [v]), b)
      b.in = (_c: string, v: string[]) => ((ids = v), b)
      b.maybeSingle = async () => ({ data: rows[ids[0]] ?? null, error: null })
      b.then = (resolve: any) => resolve({ data: ids.filter((i) => rows[i]).map((i) => ({ id: i, ...rows[i] })), error: null })
      return b
    },
  },
}))
const ok = (_req: any, res: any) => res.json({ success: true })
jest.mock('../controllers/gradebook.controller', () =>
  new Proxy({}, { get: (_t, name) => (name === '__esModule' ? true : jest.fn(ok)) }),
)

import express from 'express'
import type { AddressInfo } from 'net'
import router from './gradebook.routes'

let base = ''
let server: any
beforeAll((done) => {
  const app = express()
  app.use(express.json())
  app.use('/api/gradebook', router)
  server = app.listen(0, () => {
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/gradebook`
    done()
  })
})
afterAll(() => {
  server.close()
})
beforeEach(() => {
  for (const k of Object.keys(rows)) delete rows[k]
  Object.assign(rows, {
    stuA: { school_id: 'c1', profile_id: 'pA' },
    stuB: { school_id: 's1', profile_id: 'pB' },
    stuX: { school_id: 's9', profile_id: 'pX' },
    a1: { school_id: 's1', course_period_id: 'cp1' }, aOther: { school_id: 's1', course_period_id: 'cpOther' },
    aX: { school_id: 's9' },
    cp1: { school_id: 's1', teacher_id: 't1' }, cpCo: { school_id: 's1', teacher_id: 't2', secondary_teacher_id: 't1' }, cpOther: { school_id: 's1', teacher_id: 't2' }, t2: { school_id: 's1' },
    cpX: { school_id: 's9' },
    typeX: { school_id: 's9' },
  })
})

const call = (method: string, path: string, body?: unknown, role = 'admin', headers: Record<string, string> = {}) =>
  fetch(`${base}${path}`, { method, headers: { 'x-test-role': role, 'content-type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) })

describe('gradebook routes', () => {
  it("limits one student's grades to staff of the family, the student and linked parents", async () => {
    expect((await call('GET', '/grades/student/stuX', undefined, 'teacher')).status).toBe(404)
    expect((await call('GET', '/grades/student/stuA', undefined, 'teacher')).status).toBe(200)
    expect((await call('GET', '/grades/summary/student/stuA', undefined, 'student', { 'x-test-id': 'pA', 'x-test-student': 'stuA' })).status).toBe(200)
    expect((await call('GET', '/grades/summary/student/stuB', undefined, 'student', { 'x-test-id': 'pA', 'x-test-student': 'stuA' })).status).toBe(404)
    expect((await call('GET', '/average/stuB', undefined, 'parent', { 'x-test-id': 'parentWithoutLink' })).status).toBe(404)
  })

  it("rejects other schools' assignments, types and course periods", async () => {
    expect((await call('GET', '/assignments/aX', undefined, 'teacher')).status).toBe(404)
    expect((await call('PUT', '/assignments/a1', { course_period_id: 'cpX' }, 'teacher')).status).toBe(404)
    expect((await call('DELETE', '/assignment-types/typeX', undefined, 'teacher')).status).toBe(404)
    expect((await call('POST', '/assignments/mass-create', { course_period_ids: ['cp1', 'cpX'] })).status).toBe(404)
    expect((await call('POST', '/grades/bulk', { assignment_id: 'a1', course_period_id: 'cp1', grades: [{ student_id: 'stuA' }, { student_id: 'stuX' }] }, 'teacher')).status).toBe(404)
    expect((await call('POST', '/grades/bulk', { assignment_id: 'a1', course_period_id: 'cp1', grades: [{ student_id: 'stuA' }, { student_id: 'stuB' }] }, 'teacher')).status).toBe(200)
  })

  it("keeps a teacher to their own course periods (admins pass)", async () => {
    expect((await call('GET', '/view?course_period_id=cpOther', undefined, 'teacher')).status).toBe(403)
    expect((await call('GET', '/view?course_period_id=cpCo', undefined, 'teacher')).status).toBe(200)
    expect((await call('GET', '/view?course_period_id=cpOther')).status).toBe(200)
    expect((await call('POST', '/assignments', { course_period_id: 'cpOther', title: 'x' }, 'teacher')).status).toBe(403)
    expect((await call('PUT', '/assignments/aOther', { title: 'x' }, 'teacher')).status).toBe(403)
    expect((await call('DELETE', '/assignments/aOther', undefined, 'teacher')).status).toBe(403)
    expect((await call('GET', '/grades/assignment/aOther', undefined, 'teacher')).status).toBe(403)
    expect((await call('POST', '/grades/bulk', { assignment_id: 'aOther', course_period_id: 'cp1', grades: [] }, 'teacher')).status).toBe(403)
    expect((await call('POST', '/grades/import', { course_period_id: 'cpOther', mappings: [] }, 'teacher')).status).toBe(403)
    expect((await call('POST', '/grades/import', { course_period_id: 'cp1', mappings: [] }, 'teacher')).status).toBe(200)
    expect((await call('POST', '/assignments/mass-create', { course_period_ids: ['cp1', 'cpOther'] }, 'teacher')).status).toBe(403)
    expect((await call('GET', '/anomalous?staff_id=t2', undefined, 'teacher')).status).toBe(403)
    expect((await call('PUT', '/assignments/a1', { title: 'x' }, 'teacher')).status).toBe(200)
  })

  it('keeps class-wide grade views to staff', async () => {
    expect((await call('GET', '/view?course_period_id=cp1', undefined, 'student')).status).toBe(403)
    expect((await call('GET', '/grades/assignment/a1', undefined, 'parent')).status).toBe(403)
    expect((await call('GET', '/view?course_period_id=cpX', undefined, 'teacher')).status).toBe(404)
  })

  it('progress reports: staff for the school, a student only for themselves', async () => {
    const self = { 'x-test-id': 'pA', 'x-test-student': 'stuA' }
    expect((await call('POST', '/progress-reports', { student_ids: ['stuA'] }, 'student', self)).status).toBe(200)
    expect((await call('POST', '/progress-reports', { student_ids: ['stuB'] }, 'student', self)).status).toBe(403)
    expect((await call('POST', '/progress-reports', { student_ids: ['stuA'] }, 'teacher')).status).toBe(200)
    expect((await call('POST', '/progress-reports', { student_ids: ['stuX'] }, 'teacher')).status).toBe(404)
    expect((await call('POST', '/progress-reports', { student_ids: ['stuX'] })).status).toBe(404)
  })
})
