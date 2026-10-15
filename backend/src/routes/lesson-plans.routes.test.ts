// Real router + row-scope middleware; auth, family check, Supabase and the controller stubbed.
// Lesson plans: any signed-in user could read, change or delete another school's lessons and files by id.
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
jest.mock('../controllers/lesson-plans.controller', () => ({
  LessonPlansController: class {
    constructor() {
      return new Proxy({}, { get: () => jest.fn(ok) })
    }
  },
}))

import express from 'express'
import type { AddressInfo } from 'net'
import router from './lesson-plans.routes'

let base = ''
let server: any
beforeAll((done) => {
  const app = express()
  app.use(express.json())
  app.use('/api/lesson-plans', router)
  server = app.listen(0, () => {
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/lesson-plans`
    done()
  })
})
afterAll(() => {
  server.close()
})
beforeEach(() => {
  for (const k of Object.keys(rows)) delete rows[k]
  Object.assign(rows, { l1: { school_id: 'c1' }, lX: { school_id: 's9' }, fX: { lesson: { school_id: 's9' } }, cp1: { school_id: 's1' }, cpX: { school_id: 's9' }, tX: { school_id: 's9' } })
})

const call = (method: string, path: string, body?: unknown, role = 'teacher') =>
  fetch(`${base}${path}`, { method, headers: { 'x-test-role': role, 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })

describe('lesson-plans routes', () => {
  it("rejects another school's lessons, files, course periods and teachers", async () => {
    expect((await call('GET', '/lX')).status).toBe(404)
    expect((await call('GET', '/l1')).status).toBe(200)
    expect((await call('PUT', '/lX/items', { items: [] })).status).toBe(404)
    expect((await call('DELETE', '/files/fX')).status).toBe(404)
    expect((await call('POST', '/', { course_period_id: 'cpX', teacher_id: 't1' })).status).toBe(404)
    expect((await call('POST', '/', { course_period_id: 'cp1', teacher_id: 'tX' })).status).toBe(404)
    expect((await call('GET', '/?course_period_id=cpX')).status).toBe(404)
  })
})
