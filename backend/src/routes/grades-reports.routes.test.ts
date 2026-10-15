// Real router + row-scope middleware; auth, family check, Supabase and the controller stubbed.
// Transcripts batch: admins for the school's students, a student for themselves, a parent for linked children.
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
jest.mock('../controllers/grades-reports.controller', () =>
  new Proxy({}, { get: (_t, name) => (name === '__esModule' ? true : jest.fn(ok)) }),
)

import express from 'express'
import type { AddressInfo } from 'net'
import router from './grades-reports.routes'

let base = ''
let server: any
beforeAll((done) => {
  const app = express()
  app.use(express.json())
  app.use('/api/grades-reports', router)
  server = app.listen(0, () => {
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/grades-reports`
    done()
  })
})
afterAll(() => {
  server.close()
})
beforeEach(() => {
  for (const k of Object.keys(rows)) delete rows[k]
  Object.assign(rows, { stuA: { school_id: 'c1', profile_id: 'pA' }, stuX: { school_id: 's9', profile_id: 'pX' }, cp1: { school_id: 's1' }, cpX: { school_id: 's9' } })
})

const call = (method: string, path: string, body?: unknown, role = 'admin', headers: Record<string, string> = {}) =>
  fetch(`${base}${path}`, { method, headers: { 'x-test-role': role, 'content-type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) })

describe('grades-reports routes', () => {
  it('generates transcripts for admins, and for a student only about themselves', async () => {
    const self = { 'x-test-id': 'pA', 'x-test-student': 'stuA' }
    expect((await call('POST', '/transcripts/generate', { student_ids: ['stuA'] }, 'student', self)).status).toBe(200)
    expect((await call('POST', '/transcripts/generate', { student_ids: ['stuX'] }, 'student', self)).status).toBe(403)
    expect((await call('POST', '/transcripts/generate', { student_ids: ['stuA'] }, 'teacher')).status).toBe(403)
    expect((await call('POST', '/transcripts/generate', { student_ids: ['stuX'] })).status).toBe(404)
    expect((await call('POST', '/transcripts/generate', { student_ids: ['stuA'] })).status).toBe(200)
  })
})
