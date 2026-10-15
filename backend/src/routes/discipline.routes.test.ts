// Real router + controller; auth, family check and Supabase stubbed. Librarians see and file only
// library-related student referrals; referrals and fields by id must be in the caller's family.
jest.mock('../middlewares/auth.middleware', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    const role = req.headers['x-test-role']
    if (role) req.profile = { id: 'me', role, school_id: 's1' }
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
const calls: { table: string; op: string; args: any[] }[] = []
jest.mock('../config/supabase', () => ({
  supabase: {
    from: (table: string) => {
      const b: any = {}
      let ids: string[] = []
      const rec = (op: string) => (...args: any[]) => (calls.push({ table, op, args }), b)
      b.select = rec('select')
      b.order = rec('order')
      b.range = rec('range')
      b.gte = rec('gte')
      b.lte = rec('lte')
      b.in = (c: string, v: string[]) => (calls.push({ table, op: 'in', args: [c, v] }), (ids = v), b)
      b.eq = (c: string, v: any) => (calls.push({ table, op: 'eq', args: [c, v] }), c === 'id' && (ids = [v]), b)
      b.insert = (v: any) => (calls.push({ table, op: 'insert', args: [v] }), b)
      b.update = rec('update')
      b.maybeSingle = async () => ({ data: rows[ids[0]] ?? null, error: null })
      b.single = async () => ({ data: rows[ids[0]] ?? null, error: rows[ids[0]] ? null : { code: 'PGRST116', message: 'none' } })
      b.then = (resolve: any) => resolve({ data: table === 'discipline_referrals' ? [] : ids.filter((i) => rows[i]).map((i) => ({ id: i, ...rows[i] })), error: null, count: 0 })
      return b
    },
  },
}))

import express from 'express'
import type { AddressInfo } from 'net'
import router from './discipline.routes'

let base = ''
let server: any
beforeAll((done) => {
  const app = express()
  app.use(express.json())
  app.use('/api', router)
  server = app.listen(0, () => {
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/discipline`
    done()
  })
})
afterAll(() => server.close())
beforeEach(() => {
  calls.length = 0
  for (const k of Object.keys(rows)) delete rows[k]
  Object.assign(rows, {
    lib1: { school_id: 's1', library_related: true },
    beh1: { school_id: 's1', library_related: false },
    other: { school_id: 's9', library_related: true },
    f1: { school_id: 's1' },
    fX: { school_id: 's9' },
  })
})
const call = (method: string, path: string, role: string, body?: unknown) =>
  fetch(`${base}${path}`, { method, headers: { 'x-test-role': role, 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })

describe('discipline referrals', () => {
  it('lets a librarian list only library-related student referrals', async () => {
    expect((await call('GET', '/referrals', 'librarian')).status).toBe(200)
    const eqs = calls.filter((c) => c.table === 'discipline_referrals' && c.op === 'eq').map((c) => c.args)
    expect(eqs).toContainEqual(['library_related', true])
    expect(eqs).toContainEqual(['target_type', 'student'])
  })

  it('does not narrow a teacher unless asked', async () => {
    await call('GET', '/referrals', 'teacher')
    expect(calls.some((c) => c.op === 'eq' && c.args[0] === 'library_related')).toBe(false)
    calls.length = 0
    await call('GET', '/referrals?library_related=true', 'teacher')
    expect(calls.some((c) => c.op === 'eq' && c.args[0] === 'library_related')).toBe(true)
  })

  it('hides behaviour referrals and other schools from a librarian by id', async () => {
    expect((await call('GET', '/referrals/lib1', 'librarian')).status).toBe(200)
    expect((await call('GET', '/referrals/beh1', 'librarian')).status).toBe(404)
    expect((await call('GET', '/referrals/other', 'teacher')).status).toBe(404)
    expect((await call('GET', '/referrals/beh1', 'teacher')).status).toBe(200)
  })

  it('files a librarian report as library-related, by the librarian, students only', async () => {
    expect((await call('POST', '/referrals', 'librarian', { student_id: 'st1', reporter_id: 'someone-else', library_related: false })).status).toBe(201)
    const [row] = calls.find((c) => c.op === 'insert')!.args[0]
    expect(row.library_related).toBe(true)
    expect(row.reporter_id).toBe('me')
    expect((await call('POST', '/referrals', 'librarian', { target_type: 'teacher', staff_id: 't1' })).status).toBe(403)
  })

  it('lets a teacher mark a referral library-related', async () => {
    await call('POST', '/referrals', 'teacher', { student_id: 'st1', library_related: true })
    expect(calls.find((c) => c.op === 'insert')!.args[0][0].library_related).toBe(true)
  })

  it("keeps admins off other schools' referrals and fields, and librarians off editing", async () => {
    expect((await call('PATCH', '/referrals/other', 'admin', { field_values: {} })).status).toBe(404)
    expect((await call('DELETE', '/referrals/other', 'admin')).status).toBe(404)
    expect((await call('PATCH', '/fields/fX', 'admin', { name: 'x' })).status).toBe(404)
    expect((await call('DELETE', '/fields/fX', 'admin')).status).toBe(404)
    expect((await call('PATCH', '/referrals/lib1', 'librarian', { field_values: {} })).status).toBe(403)
    expect((await call('GET', '/referrals', 'student')).status).toBe(403)
  })
})
