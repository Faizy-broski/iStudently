// VLaby device limit: the util (register / refuse / release) and the real router guards,
// against an in-memory fake of the few Supabase calls used. Auth is stubbed.
const mockDb: Record<string, any[]> = {}
const mockFail: Record<string, { code?: string; message: string } | undefined> = {}
let mockClock = 0
let mockSeq = 0

jest.mock('../config/supabase', () => ({
  supabase: {
    from: (table: string) => {
      let op: 'select' | 'insert' | 'update' | 'delete' = 'select'
      let payload: any
      let order: { c: string; asc: boolean } | undefined
      let lim: number | undefined
      const filters: Array<(r: any) => boolean> = []
      const rows = () => (mockDb[table] ??= [])
      const run = (): { data: any; error: any } => {
        const fail = mockFail[table]
        if (fail) return { data: null, error: fail }
        const match = (r: any) => filters.every((f) => f(r))
        if (op === 'insert') {
          const row = { id: `00000000-0000-4000-8000-${String(++mockSeq).padStart(12, '0')}`, first_seen_at: new Date(++mockClock * 1000).toISOString(), last_seen_at: new Date(mockClock * 1000).toISOString(), ...payload }
          if (table === 'vlaby_devices' && rows().some((r) => r.profile_id === row.profile_id && r.device_id === row.device_id)) {
            return { data: null, error: { code: '23505', message: 'duplicate key' } }
          }
          rows().push(row)
          return { data: [row], error: null }
        }
        if (op === 'update') {
          const hit = rows().filter(match)
          hit.forEach((r) => Object.assign(r, payload))
          return { data: hit, error: null }
        }
        if (op === 'delete') {
          const hit = rows().filter(match)
          mockDb[table] = rows().filter((r) => !hit.includes(r))
          return { data: hit, error: null }
        }
        let out = rows().filter(match)
        if (order) out = [...out].sort((a, b) => (a[order!.c] < b[order!.c] ? -1 : 1) * (order!.asc ? 1 : -1))
        if (lim !== undefined) out = out.slice(0, lim)
        return { data: out, error: null }
      }
      const b: any = {
        select: () => b,
        insert: (p: any) => { op = 'insert'; payload = p; return b },
        update: (p: any) => { op = 'update'; payload = p; return b },
        delete: () => { op = 'delete'; return b },
        eq: (c: string, v: unknown) => { filters.push((r) => r[c] === v); return b },
        is: (c: string, v: unknown) => { filters.push((r) => (r[c] ?? null) === v); return b },
        in: (c: string, vs: unknown[]) => { filters.push((r) => vs.includes(r[c])); return b },
        order: (c: string, o?: { ascending?: boolean }) => { order = { c, asc: o?.ascending !== false }; return b },
        limit: (n: number) => { lim = n; return b },
        maybeSingle: async () => { const r = run(); return { data: r.data?.[0] ?? null, error: r.error } },
        single: async () => { const r = run(); return { data: r.data?.[0] ?? null, error: r.error } },
        then: (resolve: any) => resolve(run()),
      }
      return b
    },
  },
}))

// Campus helpers: 'campus1' belongs to 'school1'.
jest.mock('./campus-validation', () => ({
  schoolRootId: async (id: string) => (id === 'campus1' ? 'school1' : id),
  schoolScopeIds: async (id: string) => (id === 'school1' ? ['school1', 'campus1'] : [id]),
}))
jest.mock('../middlewares/auth.middleware', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    const role = req.headers['x-test-role']
    if (role) req.profile = { id: req.headers['x-test-profile'] ?? 'u1', role, school_id: req.headers['x-test-school'] ?? 'school1' }
    next()
  },
}))
jest.mock('../services/module-access.service', () => ({
  decideStaffModuleAccess: () => ({ allowed: false }),
  loadProfilePermissions: async () => ({}),
}))

import express from 'express'
import type { AddressInfo } from 'net'
import vlabyRouter from '../routes/vlaby.routes'
import { checkAndRegisterDevice, describeDevice, releaseOwnDevice } from './vlaby-devices'

const SCHOOL = '11111111-1111-4111-8111-111111111111'
const A = 'device-aaaaaaaa'
const B = 'device-bbbbbbbb'
const CHROME_ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36'

const check = (deviceId: string | null, over: Partial<Parameters<typeof checkAndRegisterDevice>[0]> = {}) =>
  checkAndRegisterDevice({ schoolId: 'school1', profileId: 'u1', role: 'student', deviceId, userAgent: CHROME_ANDROID, ...over })

beforeEach(() => {
  for (const k of Object.keys(mockDb)) delete mockDb[k]
  for (const k of Object.keys(mockFail)) delete mockFail[k]
  mockClock = 0
  mockSeq = 0
  mockDb.school_settings = [{ id: 's-set-1', school_id: 'school1', campus_id: null, vlaby_device_limit: 2 }]
  mockDb.schools = [{ id: SCHOOL }]
})

describe('checkAndRegisterDevice', () => {
  it('allows everything and tracks nothing when the school has no limit', async () => {
    mockDb.school_settings = [{ id: 's-set-1', school_id: 'school1', campus_id: null, vlaby_device_limit: null }]
    expect(await check(A)).toEqual({ allowed: true })
    expect(await check(null)).toEqual({ allowed: true })
    expect(mockDb.vlaby_devices ?? []).toHaveLength(0)
  })

  it('registers a new device while under the limit, with a readable label', async () => {
    expect(await check(A)).toEqual({ allowed: true })
    expect(mockDb.vlaby_devices).toHaveLength(1)
    expect(mockDb.vlaby_devices[0]).toMatchObject({ profile_id: 'u1', device_id: A, school_id: 'school1', label: 'Chrome on Android', platform: 'android' })
    expect(await check(B)).toEqual({ allowed: true })
    expect(mockDb.vlaby_devices).toHaveLength(2)
  })

  it('refuses a new device over the limit and returns the user\'s devices', async () => {
    await check(A)
    await check(B)
    const res: any = await check('device-cccccccc')
    expect(res.allowed).toBe(false)
    expect(res.code).toBe('VLABY_DEVICE_LIMIT')
    expect(res.limit).toBe(2)
    expect(res.devices).toHaveLength(2)
    expect(res.devices.every((d: any) => d.is_current === false)).toBe(true)
    expect(mockDb.vlaby_devices).toHaveLength(2)
  })

  it('lets a known device back in and refreshes last_seen_at', async () => {
    await check(A)
    const before = mockDb.vlaby_devices[0].last_seen_at
    expect(await check(A)).toEqual({ allowed: true })
    expect(mockDb.vlaby_devices).toHaveLength(1)
    expect(mockDb.vlaby_devices[0].last_seen_at).not.toBe(before)
  })

  it('never limits a super admin', async () => {
    mockDb.school_settings[0].vlaby_device_limit = 1
    for (const id of [A, B, 'device-cccccccc']) expect(await check(id, { role: 'super_admin' })).toEqual({ allowed: true })
    expect(mockDb.vlaby_devices ?? []).toHaveLength(0)
  })

  it('asks for a device id when a limit applies and the id is missing or malformed', async () => {
    const missing: any = await check(null)
    expect(missing).toMatchObject({ allowed: false, code: 'VLABY_DEVICE_ID_REQUIRED', limit: 2 })
    const bad: any = await check('short')
    expect(bad.code).toBe('VLABY_DEVICE_ID_REQUIRED')
    const weird: any = await check('has spaces and !! chars')
    expect(weird.code).toBe('VLABY_DEVICE_ID_REQUIRED')
    expect(mockDb.vlaby_devices ?? []).toHaveLength(0)
  })

  it('uses the main school\'s limit for a campus user', async () => {
    expect(await check(A, { schoolId: 'campus1' })).toEqual({ allowed: true })
    expect(await check(B, { schoolId: 'campus1' })).toEqual({ allowed: true })
    const res: any = await check('device-cccccccc', { schoolId: 'campus1' })
    expect(res.code).toBe('VLABY_DEVICE_LIMIT')
  })

  it('fails open only when the migration has not been run', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    mockFail.vlaby_devices = { code: '42P01', message: 'relation "vlaby_devices" does not exist' }
    expect(await check(A)).toEqual({ allowed: true })
    delete mockFail.vlaby_devices
    mockFail.school_settings = { code: '42703', message: 'column school_settings.vlaby_device_limit does not exist' }
    expect(await check(A)).toEqual({ allowed: true })
    mockFail.school_settings = { code: 'PGRST205', message: "Could not find the table 'public.vlaby_devices' in the schema cache" }
    expect(await check(A)).toEqual({ allowed: true })
    warn.mockRestore()
  })

  it('does not fail open on other database errors', async () => {
    mockFail.school_settings = { code: '57014', message: 'statement timeout' }
    await expect(check(A)).rejects.toMatchObject({ code: '57014' })
  })

  it('keeps only the oldest devices when the limit is lowered below what a user has', async () => {
    await check(A)
    await check(B)
    mockDb.school_settings[0].vlaby_device_limit = 1
    expect(await check(A)).toEqual({ allowed: true })
    const res: any = await check(B)
    expect(res.code).toBe('VLABY_DEVICE_LIMIT')
    expect(res.devices.find((d: any) => d.is_current)).toBeTruthy()
  })
})

describe('releasing a device', () => {
  it('frees a slot for a new device', async () => {
    mockDb.school_settings[0].vlaby_device_limit = 1
    await check(A)
    expect(((await check(B)) as any).code).toBe('VLABY_DEVICE_LIMIT')
    expect(await releaseOwnDevice('u1', mockDb.vlaby_devices[0].id)).toBe(true)
    expect(await check(B)).toEqual({ allowed: true })
    expect(mockDb.vlaby_devices.map((r) => r.device_id)).toEqual([B])
  })

  it('cannot release another user\'s device', async () => {
    await check(A, { profileId: 'u2' })
    const id = mockDb.vlaby_devices[0].id
    expect(await releaseOwnDevice('u1', id)).toBe(false)
    expect(mockDb.vlaby_devices).toHaveLength(1)
    expect(await releaseOwnDevice('u1', 'not-a-uuid')).toBe(false)
  })
})

describe('describeDevice', () => {
  it('names the browser and the system', () => {
    expect(describeDevice(CHROME_ANDROID)).toEqual({ label: 'Chrome on Android', platform: 'android' })
    expect(describeDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1')).toEqual({ label: 'Safari on iOS', platform: 'ios' })
    expect(describeDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36 Edg/120.0')).toEqual({ label: 'Edge on Windows', platform: 'windows' })
    expect(describeDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7; rv:121.0) Gecko/20100101 Firefox/121.0')).toEqual({ label: 'Firefox on macOS', platform: 'macos' })
    expect(describeDevice('')).toEqual({ label: 'Unknown device', platform: 'unknown' })
  })
})

describe('vlaby device routes', () => {
  let base = ''
  let server: any
  beforeAll((done) => {
    const app = express()
    app.use(express.json())
    app.use('/api/vlaby', vlabyRouter)
    server = app.listen(0, () => {
      base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/vlaby`
      done()
    })
  })
  afterAll((done) => { server.close(() => done()) })

  type Reply = { status: number; json: () => Promise<any> }
  const call = (method: string, path: string, role: string | null, extra: Record<string, string> = {}, body?: unknown): Promise<Reply> =>
    fetch(`${base}${path}`, {
      method,
      headers: { 'content-type': 'application/json', ...(role ? { 'x-test-role': role } : {}), ...extra },
      body: body === undefined ? undefined : JSON.stringify(body),
    }) as unknown as Promise<Reply>

  it('rejects the super-admin endpoints for everyone else', async () => {
    for (const role of ['admin', 'teacher', 'student', 'parent']) {
      expect((await call('GET', `/device-limit?school_id=${SCHOOL}`, role)).status).toBe(403)
      expect((await call('PUT', '/device-limit', role, {}, { school_id: SCHOOL, limit: 3 })).status).toBe(403)
      expect((await call('GET', `/devices?school_id=${SCHOOL}`, role)).status).toBe(403)
      expect((await call('DELETE', '/devices/00000000-0000-4000-8000-000000000001', role)).status).toBe(403)
      expect((await call('DELETE', `/devices/user/${SCHOOL}?school_id=${SCHOOL}`, role)).status).toBe(403)
    }
    expect((await call('GET', `/device-limit?school_id=${SCHOOL}`, null)).status).toBe(401)
  })

  it('lets the super admin read, set and clear the limit, and validates it', async () => {
    const read = await (await call('GET', `/device-limit?school_id=${SCHOOL}`, 'super_admin')).json()
    expect(read.data).toEqual({ school_id: SCHOOL, limit: null })

    const set = await call('PUT', '/device-limit', 'super_admin', {}, { school_id: SCHOOL, limit: 3 })
    expect(set.status).toBe(200)
    expect((await (await call('GET', `/device-limit?school_id=${SCHOOL}`, 'super_admin')).json()).data.limit).toBe(3)

    for (const limit of [0, 21, 1.5, '3', undefined]) {
      expect((await call('PUT', '/device-limit', 'super_admin', {}, { school_id: SCHOOL, limit })).status).toBe(400)
    }
    expect((await call('PUT', '/device-limit', 'super_admin', {}, { school_id: 'nope', limit: 3 })).status).toBe(400)
    expect((await call('PUT', '/device-limit', 'super_admin', {}, { school_id: '22222222-2222-4222-8222-222222222222', limit: 3 })).status).toBe(404)

    expect((await call('PUT', '/device-limit', 'super_admin', {}, { school_id: SCHOOL, limit: null })).status).toBe(200)
    expect((await (await call('GET', `/device-limit?school_id=${SCHOOL}`, 'super_admin')).json()).data.limit).toBeNull()
  })

  it('answers 503 not_migrated when the column is missing', async () => {
    mockFail.school_settings = { code: '42703', message: 'column does not exist' }
    const res = await call('PUT', '/device-limit', 'super_admin', {}, { school_id: SCHOOL, limit: 2 })
    expect(res.status).toBe(503)
    expect((await res.json()).code).toBe('not_migrated')
  })

  it('lists school devices with names, and the super admin can remove or reset them', async () => {
    mockDb.school_settings = [{ id: 'x', school_id: SCHOOL, campus_id: null, vlaby_device_limit: 5 }]
    mockDb.profiles = [{ id: 'u1', first_name: 'Ali', last_name: 'Khan', role: 'student' }]
    mockDb.vlaby_devices = [
      { id: '00000000-0000-4000-8000-0000000000a1', school_id: SCHOOL, profile_id: 'u1', device_id: A, label: 'Chrome on Android', platform: 'android', first_seen_at: '2026-01-01T00:00:00Z', last_seen_at: '2026-01-02T00:00:00Z' },
      { id: '00000000-0000-4000-8000-0000000000a2', school_id: SCHOOL, profile_id: 'u1', device_id: B, label: 'Edge on Windows', platform: 'windows', first_seen_at: '2026-01-01T00:00:00Z', last_seen_at: '2026-01-03T00:00:00Z' },
    ]
    const list = await (await call('GET', `/devices?school_id=${SCHOOL}`, 'super_admin')).json()
    expect(list.data).toHaveLength(2)
    expect(list.data[0]).toMatchObject({ user_name: 'Ali Khan', role: 'student', label: 'Edge on Windows' })
    expect(list.data[0].user_agent).toBeUndefined()

    expect((await call('DELETE', '/devices/00000000-0000-4000-8000-0000000000a1', 'super_admin')).status).toBe(200)
    expect((await call('DELETE', '/devices/00000000-0000-4000-8000-0000000000a1', 'super_admin')).status).toBe(404)
    mockDb.vlaby_devices.push({ id: '00000000-0000-4000-8000-0000000000a3', school_id: SCHOOL, profile_id: 'u1', device_id: 'device-cccccccc', first_seen_at: 'x', last_seen_at: 'x' })
    const reset = await (await call('DELETE', `/devices/user/${'00000000-0000-4000-8000-0000000000b1'}?school_id=${SCHOOL}`, 'super_admin')).json()
    expect(reset.data.deleted).toBe(0)
    mockDb.profiles[0].id = '00000000-0000-4000-8000-0000000000b1'
    mockDb.vlaby_devices.forEach((r) => (r.profile_id = '00000000-0000-4000-8000-0000000000b1'))
    const reset2 = await (await call('DELETE', `/devices/user/${'00000000-0000-4000-8000-0000000000b1'}?school_id=${SCHOOL}`, 'super_admin')).json()
    expect(reset2.data.deleted).toBe(2)
    expect(mockDb.vlaby_devices).toHaveLength(0)
  })

  it('shows a user only their own devices and lets them release only those', async () => {
    mockDb.school_settings = [{ id: 'x', school_id: 'school1', campus_id: null, vlaby_device_limit: 2 }]
    mockDb.vlaby_devices = [
      { id: '00000000-0000-4000-8000-0000000000c1', school_id: 'school1', profile_id: 'u1', device_id: A, label: 'Chrome on Android', platform: 'android', first_seen_at: '2026-01-01T00:00:00Z', last_seen_at: '2026-01-02T00:00:00Z' },
      { id: '00000000-0000-4000-8000-0000000000c2', school_id: 'school1', profile_id: 'u2', device_id: B, label: 'Safari on iOS', platform: 'ios', first_seen_at: '2026-01-01T00:00:00Z', last_seen_at: '2026-01-02T00:00:00Z' },
    ]
    const mine = await (await call('GET', '/my-devices', 'student', { 'x-test-profile': 'u1', 'x-device-id': A })).json()
    expect(mine.data.limit).toBe(2)
    expect(mine.data.devices).toHaveLength(1)
    expect(mine.data.devices[0]).toMatchObject({ is_current: true, label: 'Chrome on Android' })

    expect((await call('DELETE', '/my-devices/00000000-0000-4000-8000-0000000000c2', 'student', { 'x-test-profile': 'u1' })).status).toBe(404)
    expect(mockDb.vlaby_devices).toHaveLength(2)
    expect((await call('DELETE', '/my-devices/00000000-0000-4000-8000-0000000000c1', 'student', { 'x-test-profile': 'u1' })).status).toBe(200)
    expect(mockDb.vlaby_devices).toHaveLength(1)
  })

  it('refuses an experiment on a new device over the limit with a 200 and code', async () => {
    mockDb.school_settings = [{ id: 'x', school_id: 'school1', campus_id: null, vlaby_device_limit: 1 }]
    // VLaby itself is faked; calls to this test server pass through.
    const realFetch = global.fetch
    const spy = jest.spyOn(global, 'fetch').mockImplementation(async (url: any, init?: any) =>
      String(url).includes('vlaby.com')
        ? new Response(JSON.stringify({ status: true, data: { experiment: { id: 5 } } }), { status: 200 })
        : realFetch(url, init))
    try {
      const first = await (await call('GET', '/experiment/5', 'student', { 'x-test-profile': 'u1', 'x-device-id': A, 'x-vlaby-token': 't' })).json()
      expect(first.success).toBe(true)
      const res = await call('GET', '/experiment/5', 'student', { 'x-test-profile': 'u1', 'x-device-id': B, 'x-vlaby-token': 't' })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body).toMatchObject({ success: false, code: 'VLABY_DEVICE_LIMIT', data: { limit: 1 } })
      expect(body.data.devices).toHaveLength(1)
      expect(body.data.devices[0].is_current).toBe(false)
      // A super admin is never refused.
      const admin = await (await call('GET', '/experiment/5', 'super_admin', { 'x-test-profile': 'sa', 'x-device-id': B, 'x-vlaby-token': 't' })).json()
      expect(admin.success).toBe(true)
    } finally {
      spy.mockRestore()
    }
  })
})
