// Real router + row-scope middleware; auth, family check, Supabase and the controller stubbed.
// Quiz: handlers took school_id / campus_id from the query or body as given, so a teacher could list
// another school's quizzes, question bank or course periods, or create rows under it.
jest.mock('../middlewares/auth.middleware', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    const role = req.headers['x-test-role']
    if (role) req.profile = { id: 'p1', role, school_id: 's1', student_id: role === 'student' ? 'stu1' : null }
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
jest.mock('../controllers/quiz.controller', () =>
  new Proxy({}, { get: (_t, name) => (name === '__esModule' ? true : jest.fn(ok)) }),
)

import express from 'express'
import type { AddressInfo } from 'net'
import router from './quiz.routes'

let base = ''
let server: any
beforeAll((done) => {
  const app = express()
  app.use(express.json())
  app.use('/api/quiz', router)
  server = app.listen(0, () => {
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/quiz`
    done()
  })
})
afterAll(() => {
  server.close()
})
beforeEach(() => {
  for (const k of Object.keys(rows)) delete rows[k]
  Object.assign(rows, { e1: { school_id: 's1' }, eX: { school_id: 's9' }, t1: { school_id: 'c1' }, tX: { school_id: 's9' }, sec1: { school_id: 's1' }, secX: { school_id: 's9' }, st1: { school_id: 's1' }, stX: { school_id: 's9' } })
})

const call = (method: string, path: string, body?: unknown, role = 'admin') =>
  fetch(`${base}${path}`, { method, headers: { 'x-test-role': role, 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })

describe('quiz routes', () => {
  it('keeps query and body school_id / campus_id to the school family', async () => {
    expect((await call('GET', '/?school_id=s9', undefined, 'teacher')).status).toBe(404)
    expect((await call('GET', '/questions?campus_id=s9', undefined, 'teacher')).status).toBe(404)
    expect((await call('GET', '/helpers/course-periods?school_id=s9', undefined, 'teacher')).status).toBe(404)
    expect((await call('POST', '/', { title: 'x', school_id: 's9' }, 'teacher')).status).toBe(404)
    expect((await call('GET', '/?school_id=s1&campus_id=c1', undefined, 'teacher')).status).toBe(200)
    expect((await call('GET', '/helpers/course-periods?school_id=s1', undefined, 'teacher')).status).toBe(200)
    expect((await call('POST', '/', { title: 'x', school_id: 's1', campus_id: 'c1' }, 'teacher')).status).toBe(200)
  })
})
