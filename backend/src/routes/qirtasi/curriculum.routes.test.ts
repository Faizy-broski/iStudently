// Per-school curriculum: every query is scoped to the caller's main school, parents must be from
// the same school, and the shared terms level is read-only. Auth, plugin gate and Supabase stubbed.
jest.mock('../../middlewares/auth.middleware', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.profile = { id: 'p1', role: req.headers['x-test-role'] || 'admin', school_id: 'c1' }
    next()
  },
}))
jest.mock('../../middlewares/qirtasi-enabled.middleware', () => ({ requireQirtasiEnabled: (_req: any, _res: any, next: any) => next() }))
jest.mock('../../services/module-access.service', () => ({ decideStaffModuleAccess: () => ({ allowed: false }), loadProfilePermissions: async () => ({}) }))
// Campus c1 belongs to main school s1.
jest.mock('../../utils/campus-validation', () => ({ schoolRootId: async (id: string) => (id === 'c1' || id === 's1' ? 's1' : id) }))

type Result = { data?: any; error?: any }
const queue: Record<string, Result[]> = {}
const calls: { table: string; op: string; args: any[] }[] = []
function builder(table: string) {
  const b: any = {}
  const record = (op: string) => (...args: any[]) => {
    calls.push({ table, op, args })
    return b
  }
  for (const op of ['select', 'insert', 'update', 'delete', 'eq', 'order']) b[op] = record(op)
  const next = () => Promise.resolve(queue[table]?.shift() ?? { data: null, error: null })
  b.single = () => next()
  b.maybeSingle = () => next()
  b.then = (resolve: any, reject: any) => next().then(resolve, reject)
  return b
}
jest.mock('../../config/supabase', () => ({ supabase: { from: (t: string) => builder(t) } }))

import express from 'express'
import type { AddressInfo } from 'net'
import router from './curriculum.routes'

let base = ''
let server: any
beforeAll((done) => {
  const app = express()
  app.use(express.json())
  app.use('/c', router)
  server = app.listen(0, () => {
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/c`
    done()
  })
})
afterAll((done) => {
  server.close(() => done())
})
beforeEach(() => {
  for (const k of Object.keys(queue)) delete queue[k]
  calls.length = 0
})
const call = (path: string, init: RequestInit = {}) => fetch(`${base}${path}`, { ...init, headers: { 'content-type': 'application/json' } })
const scoped = (table: string) => calls.some((c) => c.table === table && c.op === 'eq' && c.args[0] === 'school_id' && c.args[1] === 's1')

describe('qirtasi curriculum is per school', () => {
  it('lists only the main school tree', async () => {
    queue.qirtasi_grades = [{ data: [{ id: 'g1' }], error: null }]
    const r = await call('/grades?parent_id=st1')
    expect(r.status).toBe(200)
    expect(scoped('qirtasi_grades')).toBe(true)
  })

  it('creates under the main school', async () => {
    queue.qirtasi_education_stages = [{ data: { id: 'st1' }, error: null }]
    queue.qirtasi_grades = [{ data: { id: 'g2' }, error: null }]
    const r = await call('/grades', { method: 'POST', body: JSON.stringify({ stage_id: '11111111-1111-4111-8111-111111111111', code: 'G1', name_ar: 'الأول' }) })
    expect(r.status).toBe(201)
    const insert = calls.find((c) => c.table === 'qirtasi_grades' && c.op === 'insert')
    expect(insert?.args[0].school_id).toBe('s1')
    expect(scoped('qirtasi_education_stages')).toBe(true)
  })

  it('rejects a parent from another school', async () => {
    queue.qirtasi_education_stages = [{ data: null, error: null }]
    const r = await call('/grades', { method: 'POST', body: JSON.stringify({ stage_id: '11111111-1111-4111-8111-111111111111', code: 'G1', name_ar: 'الأول' }) })
    expect(r.status).toBe(400)
    expect(calls.some((c) => c.op === 'insert')).toBe(false)
  })

  it('404s editing or deleting another school node', async () => {
    queue.qirtasi_grades = [{ data: null, error: null }, { data: [], error: null }]
    expect((await call('/grades/g9', { method: 'PUT', body: JSON.stringify({ name_ar: 'x' }) })).status).toBe(404)
    expect((await call('/grades/g9', { method: 'DELETE' })).status).toBe(404)
    expect(scoped('qirtasi_grades')).toBe(true)
  })

  it('keeps shared terms readable and read-only', async () => {
    queue.qirtasi_terms = [{ data: [{ id: 't1' }], error: null }]
    expect((await call('/terms')).status).toBe(200)
    expect(scoped('qirtasi_terms')).toBe(false)
    expect((await call('/terms', { method: 'POST', body: JSON.stringify({ name_ar: 'x' }) })).status).toBe(403)
  })
})
