// Real router: scales and grade rows addressed by id must belong to the caller's school family.
jest.mock('../middlewares/auth.middleware', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.profile = { id: 'p1', role: req.headers['x-test-role'] ?? 'admin', school_id: 'school-a' }
    next()
  },
}))
jest.mock('../middlewares/role.middleware', () => ({ requireAdmin: (_req: any, _res: any, next: any) => next() }))
jest.mock('../controllers/grading-scales.controller', () => new Proxy({}, { get: () => (_req: any, res: any) => res.json({ success: true, reached: true }) }))
const scales: Record<string, { school_id: string }> = { 'sc-a': { school_id: 'campus-a1' }, 'sc-b': { school_id: 'school-b' } }
const grades: Record<string, { grading_scale_id: string }> = { 'g-a': { grading_scale_id: 'sc-a' }, 'g-b': { grading_scale_id: 'sc-b' } }
jest.mock('../config/supabase', () => ({
  supabase: {
    from: (table: string) => {
      let id = ''
      const q: any = { select: () => q, eq: (_c: string, v: string) => ((id = v), q), maybeSingle: async () => ({ data: (table === 'grading_scales' ? scales : grades)[id] ?? null }) }
      return q
    },
  },
}))
jest.mock('../utils/campus-validation', () => ({ campusIdsAllowed: async (_own: string, ids: string[]) => ids.every((i) => i === 'school-a' || i === 'campus-a1') }))

import express from 'express'
import type { AddressInfo } from 'net'
import router from './grading-scales.routes'

let base = ''
let server: any
beforeAll((done) => {
  const app = express()
  app.use(express.json())
  app.use('/api/grading-scales', router)
  server = app.listen(0, () => {
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/grading-scales`
    done()
  })
})
afterAll((done) => {
  server.close(() => done())
})

const call = (method: string, path: string, role = 'admin') => fetch(`${base}${path}`, { method, headers: { 'content-type': 'application/json', 'x-test-role': role }, body: method === 'GET' ? undefined : '{}' })

describe('grading scale ownership', () => {
  it('own school: reaches the handler', async () => {
    expect((await call('PUT', '/sc-a')).status).toBe(200)
    expect((await call('DELETE', '/sc-a/grades/g-a')).status).toBe(200)
    expect((await call('GET', '/')).status).toBe(200)
  })

  it('another school: 404 for scale and grade row', async () => {
    expect((await call('PUT', '/sc-b')).status).toBe(404)
    expect((await call('DELETE', '/sc-b')).status).toBe(404)
    expect((await call('POST', '/sc-b/grades')).status).toBe(404)
    expect((await call('GET', '/sc-b/grades')).status).toBe(404)
  })

  it('a grade row must belong to the scale in the URL', async () => {
    expect((await call('PUT', '/sc-a/grades/g-b')).status).toBe(404)
  })

  it('super admin: any scale', async () => {
    expect((await call('PUT', '/sc-b', 'super_admin')).status).toBe(200)
  })
})
