// Real router + real role and row-scope middleware; auth, campus family check and Supabase stubbed.
// The hostel router used to be mounted with no authentication at all.
jest.mock('../middlewares/auth.middleware', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    const role = req.headers['x-test-role']
    if (role) req.profile = { id: 'p1', role, school_id: 's1' }
    next()
  },
}))
jest.mock('../services/module-access.service', () => ({
  decideStaffModuleAccess: () => ({ allowed: false }),
  loadProfilePermissions: async () => ({}),
}))
// Family = s1 and its campus c1.
jest.mock('../utils/campus-validation', () => ({
  campusIdsAllowed: async (_own: string, ids: string[]) => ids.every((id) => id === 's1' || id === 'c1'),
}))

type Result = { data?: any; error?: any; count?: number }
const queue: Record<string, Result[]> = {}
const calls: { table: string; op: string; args: any[] }[] = []

function builder(table: string) {
  const b: any = {}
  const record = (op: string) => (...args: any[]) => {
    calls.push({ table, op, args })
    return b
  }
  for (const op of ['select', 'insert', 'update', 'delete', 'eq', 'in', 'is', 'gte', 'lte', 'ilike', 'order', 'range', 'or']) b[op] = record(op)
  const next = () => Promise.resolve(queue[table]?.shift() ?? { data: null, error: null })
  b.single = () => next()
  b.maybeSingle = () => next()
  b.then = (resolve: any, reject: any) => next().then(resolve, reject)
  return b
}
jest.mock('../config/supabase', () => ({ supabase: { from: (t: string) => builder(t) } }))

import express from 'express'
import type { AddressInfo } from 'net'
import router from './hostel.routes'

let base = ''
let server: any
beforeAll((done) => {
  const app = express()
  app.use(express.json())
  app.use('/api/hostel', router)
  server = app.listen(0, () => {
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/hostel`
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

const call = (path: string, role: string | null, init: RequestInit = {}) =>
  fetch(`${base}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(role ? { 'x-test-role': role } : {}), ...(init.headers ?? {}) },
  })

describe('hostel routes', () => {
  it('rejects requests without a signed-in user', async () => {
    const r = await call('/buildings?school_id=s1', null)
    expect(r.status).toBe(401)
    expect(calls).toHaveLength(0)
  })

  it('rejects non-admin roles', async () => {
    for (const role of ['student', 'parent', 'teacher']) {
      const r = await call('/stats?school_id=s1', role)
      expect(r.status).toBe(403)
    }
    expect(calls).toHaveLength(0)
  })

  it('lets an admin list buildings', async () => {
    queue.hostel_buildings = [{ data: [{ id: 'b1' }], error: null }]
    const r = await call('/buildings?school_id=s1', 'admin')
    expect(r.status).toBe(200)
    expect(((await r.json()) as any).data).toEqual([{ id: 'b1', room_count: 0 }])
  })

  it('404s a building of another school', async () => {
    queue.hostel_buildings = [{ data: { school_id: 'other' }, error: null }]
    const r = await call('/buildings/b9?school_id=s1', 'admin', { method: 'DELETE' })
    expect(r.status).toBe(404)
    expect(calls.some((c) => c.op === 'delete')).toBe(false)
  })

  it('404s releasing an assignment of another school', async () => {
    queue.hostel_room_assignments = [{ data: { school_id: 'other' }, error: null }]
    const r = await call('/assignments/a9', 'admin', { method: 'DELETE' })
    expect(r.status).toBe(404)
    expect(calls.some((c) => c.op === 'update')).toBe(false)
  })

  it('404s assigning a student of another school', async () => {
    queue.hostel_rooms = [{ data: { school_id: 's1' }, error: null }]
    queue.students = [{ data: { school_id: 'other' }, error: null }]
    const r = await call('/assignments', 'admin', {
      method: 'POST',
      body: JSON.stringify({ room_id: 'r1', student_id: 'st9', school_id: 's1' }),
    })
    expect(r.status).toBe(404)
    expect(calls.some((c) => c.op === 'insert')).toBe(false)
  })

  it('404s a fee payment on another school’s fee', async () => {
    queue.hostel_rental_fees = [{ data: { school_id: 'other' }, error: null }]
    const r = await call('/fees/payment', 'admin', { method: 'POST', body: JSON.stringify({ fee_id: 'f9', amount: 10 }) })
    expect(r.status).toBe(404)
  })

  it('requires school_id for files and filters by it', async () => {
    expect((await call('/files?entity_type=room&entity_id=r1', 'admin')).status).toBe(400)
    queue.hostel_room_files = [{ data: [], error: null }]
    const r = await call('/files?entity_type=room&entity_id=r1&school_id=s1', 'admin')
    expect(r.status).toBe(200)
    expect(calls.some((c) => c.table === 'hostel_room_files' && c.op === 'eq' && c.args[0] === 'school_id' && c.args[1] === 's1')).toBe(true)
  })
})
