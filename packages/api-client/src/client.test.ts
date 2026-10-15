import { describe, expect, it, vi } from 'vitest'
import { createApiClient } from './client'
import { appConfigApi } from './modules/app-config'
import { authApi } from './modules/auth'

function mockFetch(status: number, body?: unknown) {
  return vi.fn(async (_url: string, _init?: RequestInit) =>
    new Response(body === undefined ? null : JSON.stringify(body), { status }),
  )
}

function setup(fetchImpl: ReturnType<typeof mockFetch>, token: string | null = 'tok') {
  const onUnauthorized = vi.fn()
  const onAccountGate = vi.fn()
  const api = createApiClient({
    baseUrl: 'https://api.test/api',
    getToken: async () => token,
    onUnauthorized,
    onAccountGate,
    fetch: fetchImpl as unknown as typeof fetch,
  })
  return { api, onUnauthorized, onAccountGate }
}

describe('createApiClient', () => {
  it('sends bearer token and JSON body, returns server envelope', async () => {
    const f = mockFetch(200, { success: true, data: { id: 1 } })
    const { api } = setup(f)
    const res = await api.post<{ id: number }>('/x', { a: 1 })
    expect(res).toMatchObject({ success: true, data: { id: 1 } })
    const [url, init] = f.mock.calls[0]
    expect(url).toBe('https://api.test/api/x')
    expect((init!.headers as Record<string, string>).Authorization).toBe('Bearer tok')
    expect(init!.body).toBe('{"a":1}')
  })

  it('returns AUTH_REQUIRED without calling fetch when signed out', async () => {
    const f = mockFetch(200, {})
    const { api } = setup(f, null)
    expect((await api.get('/x')).code).toBe('AUTH_REQUIRED')
    expect(f).not.toHaveBeenCalled()
  })

  it('resolveUsername tells not-found, rate-limited and network apart', async () => {
    expect(await authApi(setup(mockFetch(404, { success: false, error: 'User not found' }), null).api).resolveUsername('x')).toEqual({ ok: false, reason: 'not_found' })
    expect(await authApi(setup(mockFetch(429, { success: false, code: 'RATE_LIMITED' }), null).api).resolveUsername('x')).toEqual({ ok: false, reason: 'rate_limited' })
    expect(await authApi(setup(mockFetch(500, { success: false }), null).api).resolveUsername('x')).toEqual({ ok: false, reason: 'network' })
  })

  it('wraps a bare array response in the envelope', async () => {
    const { api } = setup(mockFetch(200, [{ id: 'c1' }]))
    const res = await api.get<{ id: string }[]>('/setup/campuses')
    expect(res.success).toBe(true)
    expect(res.data).toEqual([{ id: 'c1' }])
  })

  it('public requests skip the token', async () => {
    const f = mockFetch(200, { success: true, email: 'a@b.c' })
    const { api } = setup(f, null)
    expect(await authApi(api).resolveUsername('ali')).toEqual({ ok: true, email: 'a@b.c' })
    expect((f.mock.calls[0][1]!.headers as Record<string, string>).Authorization).toBeUndefined()
  })

  it('calls onUnauthorized on 401', async () => {
    const { api, onUnauthorized } = setup(mockFetch(401, { error: 'bad' }))
    expect((await api.get('/x')).code).toBe('SESSION_EXPIRED')
    expect(onUnauthorized).toHaveBeenCalledOnce()
  })

  it.each(['TWO_FA_REQUIRED', 'TWO_FA_SETUP_REQUIRED', 'SCHOOL_SUSPENDED', 'TRIAL_EXPIRED', 'AGREEMENT_REJECTED'])(
    'reports account gate %s on 403',
    async (code) => {
      const { api, onAccountGate } = setup(mockFetch(403, { success: false, error: 'msg', code }))
      expect((await api.get('/x')).code).toBe(code)
      expect(onAccountGate).toHaveBeenCalledWith(code, 'msg')
    },
  )

  it('plain 403 is a normal error, not a gate', async () => {
    const { api, onAccountGate } = setup(mockFetch(403, { error: 'Forbidden' }))
    expect(await api.get('/x')).toMatchObject({ success: false, error: 'Forbidden', status: 403 })
    expect(onAccountGate).not.toHaveBeenCalled()
  })

  it('marks 503 as retryable', async () => {
    const { api } = setup(mockFetch(503, { success: false, error: 'down', retryable: true }))
    expect(await api.get('/x')).toMatchObject({ success: false, retryable: true })
  })

  it('handles 204 with no body', async () => {
    const { api } = setup(mockFetch(204))
    expect(await api.del('/x')).toMatchObject({ success: true, status: 204 })
  })

  it('maps thrown fetch to NETWORK_ERROR', async () => {
    const f = vi.fn(async () => {
      throw new TypeError('Network request failed')
    })
    const { api } = setup(f as any)
    expect((await api.get('/x')).code).toBe('NETWORK_ERROR')
  })

  it('times out', async () => {
    const f = vi.fn(
      (_u: string, init?: RequestInit) =>
        new Promise<Response>((_, reject) => init!.signal!.addEventListener('abort', () => reject(new Error('aborted')))),
    )
    const { api } = setup(f as any)
    expect((await api.get('/x', { timeout: 10 })).code).toBe('TIMEOUT')
  })

  it('does not set JSON content-type for FormData', async () => {
    const f = mockFetch(200, { success: true })
    const { api } = setup(f)
    const fd = new FormData()
    fd.append('a', '1')
    await api.post('/upload', fd)
    const init = f.mock.calls[0][1]!
    expect((init.headers as Record<string, string>)['Content-Type']).toBeUndefined()
    expect(init.body).toBe(fd)
  })
})

describe('authApi.getMe', () => {
  it('calls GET /auth/me with the bearer token', async () => {
    const f = mockFetch(200, { success: true, data: { profile: { role: 'student' }, gates: {}, plugins: [], school: null } })
    const { api } = setup(f)
    const res = await authApi(api).getMe()
    expect(res.data?.profile.role).toBe('student')
    expect(f.mock.calls[0][0]).toBe('https://api.test/api/auth/me')
    expect(f.mock.calls[0][1]!.method).toBe('GET')
  })
})

describe('appConfigApi.get', () => {
  it('is public (no token needed)', async () => {
    const f = mockFetch(200, { success: true, data: { flags: {} } })
    const { api } = setup(f, null)
    const res = await appConfigApi(api).get()
    expect(res.success).toBe(true)
    expect(f.mock.calls[0][0]).toBe('https://api.test/api/public/app-config')
  })
})
