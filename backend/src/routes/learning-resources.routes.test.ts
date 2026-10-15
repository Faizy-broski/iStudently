// Real router + row-scope middleware; auth, family check, Supabase and the controller stubbed.
jest.mock('../middlewares/auth.middleware', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    const role = req.headers['x-test-role']
    if (role) req.profile = { id: 'p1', role, school_id: 's1', student_id: role === 'student' ? 'stu1' : null }
    next()
  },
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
jest.mock('../controllers/learning-resources.controller', () => new Proxy({}, { get: (_t, name) => (name === '__esModule' ? true : jest.fn(ok)) }))

import express from 'express'
import type { AddressInfo } from 'net'
import router from './learning-resources.routes'

let base = ''
let server: any
beforeAll((done) => {
  const app = express()
  app.use(express.json())
  app.use('/api/learning-resources', router)
  server = app.listen(0, () => {
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/learning-resources`
    done()
  })
})
afterAll(() => server.close())
beforeEach(() => {
  for (const k of Object.keys(rows)) delete rows[k]
  Object.assign(rows, { sec1: { school_id: 'c1' }, secX: { school_id: 's9' }, lr1: { school_id: 's1' }, lrX: { school_id: 's9' }, stu1: { school_id: 's1' }, stu2: { school_id: 's1' }, t1: { school_id: 'c1' }, tX: { school_id: 's9' }, sub1: { school_id: 's1' }, subX: { school_id: 's9' } })
})

const call = (method: string, path: string, body?: unknown, role = 'student') =>
  fetch(`${base}${path}`, { method, headers: { 'x-test-role': role, 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })

describe('learning-resources routes', () => {
  it("hides other schools' sections and resources", async () => {
    expect((await call('GET', '/section?section_id=secX')).status).toBe(404)
    expect((await call('GET', '/section?section_id=sec1')).status).toBe(200)
    expect((await call('GET', '/lrX')).status).toBe(404)
    expect((await call('GET', '/lr1')).status).toBe(200)
    expect((await call('PUT', '/lrX', { title: 'x' }, 'teacher')).status).toBe(404)
  })

  it('a student records views only as themselves, on their school resources', async () => {
    expect((await call('POST', '/view', { resource_id: 'lr1', student_id: 'stu1' })).status).toBe(200)
    expect((await call('POST', '/view', { resource_id: 'lr1', student_id: 'stu2' })).status).toBe(403)
    expect((await call('POST', '/view', { resource_id: 'lrX', student_id: 'stu1' })).status).toBe(404)
  })
  it("keeps a teacher's list and new resources to the school family", async () => {
    expect((await call('GET', '/teacher?teacher_id=tX', undefined, 'teacher')).status).toBe(404)
    expect((await call('GET', '/teacher?teacher_id=t1', undefined, 'teacher')).status).toBe(200)
    expect((await call('POST', '/', { school_id: 's9', teacher_id: 't1', section_id: 'sec1' }, 'teacher')).status).toBe(404)
    expect((await call('POST', '/', { school_id: 's1', teacher_id: 'tX', section_id: 'sec1' }, 'teacher')).status).toBe(404)
    expect((await call('POST', '/', { school_id: 's1', teacher_id: 't1', section_id: 'secX' }, 'teacher')).status).toBe(404)
    expect((await call('POST', '/', { school_id: 's1', teacher_id: 't1', section_id: 'sec1', subject_id: 'subX' }, 'teacher')).status).toBe(404)
    expect((await call('POST', '/', { school_id: 's1', campus_id: 'c1', teacher_id: 't1', section_id: 'sec1', subject_id: 'sub1' }, 'teacher')).status).toBe(200)
    expect((await call('PUT', '/lr1', { section_id: 'secX' }, 'teacher')).status).toBe(404)
  })
})
