// Real router + real role middleware; auth and Supabase stubbed. Served on a random local port and
// called with Node's fetch (no supertest dependency).
jest.mock('../middlewares/auth.middleware', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    const role = req.headers['x-test-role']
    if (role) req.profile = { id: 'p1', role }
    next()
  },
}))
jest.mock('../services/module-access.service', () => ({
  decideStaffModuleAccess: () => ({ allowed: false }),
  loadProfilePermissions: async () => ({}),
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
  for (const op of ['select', 'insert', 'update', 'delete', 'eq', 'gte', 'lte', 'ilike', 'order', 'range', 'or']) b[op] = record(op)
  const next = () => Promise.resolve(queue[table]?.shift() ?? { data: null, error: null })
  b.single = () => next()
  b.maybeSingle = () => next()
  b.then = (resolve: any, reject: any) => next().then(resolve, reject)
  return b
}
jest.mock('../config/supabase', () => ({ supabase: { from: (t: string) => builder(t) } }))

import express from 'express'
import type { AddressInfo } from 'net'
import router from './platform-billing.routes'
import { generateInvoiceNumber } from '../services/platform-billing.service'

let base = ''
let server: any
beforeAll((done) => {
  const app = express()
  app.use(express.json())
  app.use('/api/platform-billing', router)
  server = app.listen(0, () => {
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/platform-billing`
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
    headers: { 'content-type': 'application/json', ...(role ? { 'x-test-role': role } : {}) },
  })

const json = async (res: Response): Promise<any> => res.json()

const validRecord = {
  school_id: '11111111-1111-4111-8111-111111111111',
  billing_plan_id: '22222222-2222-4222-8222-222222222222',
  billing_cycle: 'Monthly',
  amount: 150,
  currency: 'lyd',
  start_date: '2026-10-01',
  due_date: '2026-11-01',
  payment_status: 'unpaid',
}

describe('access', () => {
  it.each(['admin', 'teacher', 'student', 'staff'])('%s gets 403', async (role) => {
    expect((await call('/plans', role)).status).toBe(403)
  })
  it('no profile gets 401', async () => {
    expect((await call('/plans', null)).status).toBe(401)
  })
  it('super admin can list plans', async () => {
    queue.billing_plans = [{ data: [{ id: 'p', name: 'Basic' }], error: null }]
    const res = await call('/plans', 'super_admin')
    expect(res.status).toBe(200)
    expect((await json(res)).data).toEqual([{ id: 'p', name: 'Basic' }])
  })
})

describe('records', () => {
  it('creates with a server invoice number and normalised currency', async () => {
    queue.billing_records = [{ data: { id: 'r1', invoice_number: 'x', school: { name: 'Al Noor' }, plan: { name: 'Basic' } }, error: null }]
    const res = await call('/records', 'super_admin', { method: 'POST', body: JSON.stringify({ ...validRecord, invoice_number: 'HACKED-1' }) })
    expect(res.status).toBe(201)
    const body = await json(res)
    expect(body.data).toMatchObject({ id: 'r1', school_name: 'Al Noor', subscription_plan: 'Basic' })
    const insert = calls.find((c) => c.op === 'insert')!.args[0]
    expect(insert.invoice_number).toMatch(/^INV-\d{4}-[A-Z2-9]{8}$/)
    expect(insert.currency).toBe('LYD')
  })

  it('rejects invalid input with 400', async () => {
    const res = await call('/records', 'super_admin', { method: 'POST', body: JSON.stringify({ ...validRecord, amount: -5, due_date: 'tomorrow' }) })
    expect(res.status).toBe(400)
    expect(calls.find((c) => c.op === 'insert')).toBeUndefined()
  })

  it('lists with paging and escapes search wildcards', async () => {
    queue.billing_records = [{ data: [{ id: 'r1' }], error: null, count: 51 }]
    const res = await call('/records?page=2&limit=25&search=50%25_off', 'super_admin')
    const body = await json(res)
    expect(body.pagination).toEqual({ total: 51, page: 2, limit: 25, totalPages: 3 })
    expect(calls.find((c) => c.op === 'range')!.args).toEqual([25, 49])
    expect(calls.find((c) => c.op === 'ilike')!.args).toEqual(['invoice_number', '%50\\%\\_off%'])
  })

  it('"overdue" filter includes past-due unpaid/pending; "unpaid" only not-yet-due', async () => {
    queue.billing_records = [{ data: [], error: null, count: 0 }, { data: [], error: null, count: 0 }]
    await call('/records?status=overdue', 'super_admin')
    const or = calls.find((c) => c.op === 'or')!.args[0]
    expect(or).toMatch(/^payment_status\.eq\.overdue,and\(payment_status\.in\.\(unpaid,pending\),due_date\.lt\.\d{4}-\d{2}-\d{2}\)$/)
    calls.length = 0
    await call('/records?status=unpaid', 'super_admin')
    expect(calls.filter((c) => c.op === 'eq').map((c) => c.args)).toContainEqual(['payment_status', 'unpaid'])
    expect(calls.find((c) => c.op === 'gte')!.args[0]).toBe('due_date')
  })

  it('records carry an effective status (past-due unpaid -> overdue)', async () => {
    queue.billing_records = [{ data: { id: 'r1', payment_status: 'unpaid', due_date: '2020-01-01' }, error: null }]
    const body = await json(await call('/records/33333333-3333-4333-8333-333333333333', 'super_admin'))
    expect(body.data).toMatchObject({ payment_status: 'unpaid', effective_status: 'overdue' })
  })

  it('caps the page size at 100', async () => {
    expect((await call('/records?limit=1000', 'super_admin')).status).toBe(400)
  })

  it('mark-paid sets status and date', async () => {
    queue.billing_records = [{ data: { id: 'r1', payment_status: 'paid' }, error: null }]
    const res = await call('/records/33333333-3333-4333-8333-333333333333/mark-paid', 'super_admin', { method: 'POST', body: '{}' })
    expect(res.status).toBe(200)
    const update = calls.find((c) => c.op === 'update')!.args[0]
    expect(update.payment_status).toBe('paid')
    expect(update.payment_date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('bad id is 400, missing record is 404', async () => {
    expect((await call('/records/not-a-uuid', 'super_admin')).status).toBe(400)
    queue.billing_records = [{ data: null, error: null }]
    expect((await call('/records/33333333-3333-4333-8333-333333333333', 'super_admin')).status).toBe(404)
  })
})

describe('plans', () => {
  it('refuses to delete a plan used by invoices (409)', async () => {
    queue.billing_records = [{ data: null, error: null, count: 3 }]
    const res = await call('/plans/44444444-4444-4444-8444-444444444444', 'super_admin', { method: 'DELETE' })
    expect(res.status).toBe(409)
    expect(calls.find((c) => c.table === 'billing_plans' && c.op === 'delete')).toBeUndefined()
  })
})

describe('generateInvoiceNumber', () => {
  it('is unique across many calls', () => {
    const set = new Set(Array.from({ length: 2000 }, () => generateInvoiceNumber()))
    expect(set.size).toBe(2000)
  })
})
