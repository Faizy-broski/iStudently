import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

import { createApiClient } from './client'
import { agreementApi } from './modules/agreement'
import { classDiaryApi } from './modules/class-diary'
import { eventsApi } from './modules/events'
import { grievancesApi } from './modules/grievances'
import { messagingApi } from './modules/messaging'
import { parentDashboardApi } from './modules/parent-dashboard'
import { platformApi } from './modules/platform'
import { quizApi } from './modules/quiz'
import { studentDashboardApi } from './modules/student-dashboard'
import { twoFaApi } from './modules/two-fa'

// Contract tests: every call a shared module makes must match a route the backend defines,
// so the app never ships calls to endpoints that don't exist (or that changed method).

const BACKEND_ROUTES = join(__dirname, '../../../backend/src/routes')

/** "GET /attendance/:studentId/today" style entries parsed from an Express router file. */
function backendRoutes(file: string) {
  const src = readFileSync(join(BACKEND_ROUTES, file), 'utf8')
  const patterns: RegExp[] = []
  for (const m of src.matchAll(/router\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/g)) {
    const path = m[2].replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/:\w+/g, '[^/]+')
    patterns.push(new RegExp(`^${m[1].toUpperCase()} ${path}$`))
  }
  return { size: patterns.length, has: (call: string) => patterns.some((re) => re.test(call)) }
}

/** Records "METHOD /path" (query string removed, mount prefix stripped) for every call. */
function recorder(prefix: string) {
  const calls: string[] = []
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    const path = new URL(url).pathname.replace(/^\/api/, '').replace(prefix, '') || '/'
    calls.push(`${init?.method ?? 'GET'} ${path}`)
    return new Response(JSON.stringify({ success: true, data: null }), { status: 200 })
  })
  const api = createApiClient({ baseUrl: 'https://api.test/api', getToken: async () => 't', fetch: fetch as any })
  return { api, calls }
}

/** Calls every method of a module with plausible arguments. */
async function callAll(mod: Record<string, (...args: any[]) => Promise<unknown>>) {
  for (const fn of Object.values(mod)) await fn('x', 1)
}

describe('student-dashboard module matches backend/src/routes/student-dashboard.routes.ts', () => {
  it('every call has a backend route', async () => {
    const routes = backendRoutes('student-dashboard.routes.ts')
    expect(routes.size).toBeGreaterThan(20)
    const { api, calls } = recorder('/student-dashboard')
    await callAll(studentDashboardApi(api) as any)
    expect(calls.length).toBeGreaterThan(20)
    const missing = calls.filter((c) => !routes.has(c))
    expect(missing).toEqual([])
  })
})

describe('parent-dashboard module matches backend/src/routes/parent-dashboard.routes.ts', () => {
  it('every call has a backend route', async () => {
    const routes = backendRoutes('parent-dashboard.routes.ts')
    expect(routes.size).toBeGreaterThan(20)
    const { api, calls } = recorder('/parent-dashboard')
    await callAll(parentDashboardApi(api) as any)
    expect(calls.length).toBeGreaterThan(20)
    expect(calls.filter((c) => !routes.has(c))).toEqual([])
  })

  it('a bogus path is rejected (the matcher is not too loose)', () => {
    const routes = backendRoutes('parent-dashboard.routes.ts')
    expect(routes.has('GET /attendance/abc/nonexistent')).toBe(false)
    expect(routes.has('POST /students')).toBe(false)
    expect(routes.has('GET /attendance/abc/today')).toBe(true)
  })
})

describe('messaging module matches backend/src/routes/messaging.routes.ts', () => {
  it('every call has a backend route', async () => {
    const routes = backendRoutes('messaging.routes.ts')
    expect(routes.size).toBeGreaterThan(10)
    const { api, calls } = recorder('/messaging')
    await callAll(messagingApi(api) as any)
    expect(calls.length).toBe(15)
    expect(calls.filter((c) => !routes.has(c))).toEqual([])
  })
})

describe('grievances module matches backend/src/routes/grievance.routes.ts', () => {
  it('every call has a backend route', async () => {
    const routes = backendRoutes('grievance.routes.ts')
    expect(routes.size).toBeGreaterThan(15)
    const { api, calls } = recorder('/grievances')
    await callAll(grievancesApi(api) as any)
    expect(calls.length).toBe(20)
    expect(calls.filter((c) => !routes.has(c))).toEqual([])
  })
})

describe('events module matches backend/src/routes/event.routes.ts', () => {
  it('every call has a backend route', async () => {
    const routes = backendRoutes('event.routes.ts')
    const { api, calls } = recorder('/events')
    await callAll(eventsApi(api) as any)
    expect(calls.length).toBe(10)
    expect(calls.filter((c) => !routes.has(c))).toEqual([])
  })
})

describe('class-diary module matches backend/src/routes/class-diary.routes.ts', () => {
  it('every call has a backend route', async () => {
    const routes = backendRoutes('class-diary.routes.ts')
    const { api, calls } = recorder('/class-diary')
    await callAll(classDiaryApi(api) as any)
    expect(calls.length).toBe(11)
    expect(calls.filter((c) => !routes.has(c))).toEqual([])
  })
})

describe('quiz (student) module matches backend/src/routes/quiz.routes.ts', () => {
  it('every call has a backend route', async () => {
    const routes = backendRoutes('quiz.routes.ts')
    const { api, calls } = recorder('/quiz')
    await callAll(quizApi(api) as any)
    expect(calls.length).toBe(5)
    expect(calls.filter((c) => !routes.has(c))).toEqual([])
  })
})

describe('platform (super admin) module matches dashboard, school and platform-billing routes', () => {
  it('every call has a backend route in the right router', async () => {
    const routers: Record<string, ReturnType<typeof backendRoutes>> = {
      dashboard: backendRoutes('dashboard.routes.ts'),
      schools: backendRoutes('school.routes.ts'),
      'platform-billing': backendRoutes('platform-billing.routes.ts'),
      feedback: backendRoutes('feedback.routes.ts'),
      quotes: backendRoutes('quotes.routes.ts'),
      'user-profiles': backendRoutes('user-profiles.routes.ts'),
      auth: backendRoutes('auth.routes.ts'),
      'login-page-config': backendRoutes('login-page-config.routes.ts'),
      public: backendRoutes('public-pages.routes.ts'),
      'sidebar-config': backendRoutes('sidebar-config.routes.ts'),
      'school-settings': backendRoutes('school-settings.routes.ts'),
      'custom-fields': backendRoutes('custom-fields.routes.ts'),
    }
    const calls: { method: string; path: string; headers: Record<string, string> }[] = []
    const fetch = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ method: init?.method ?? 'GET', path: new URL(url).pathname.replace(/^\/api/, ''), headers: init?.headers as Record<string, string> })
      return new Response(JSON.stringify({ success: true, data: null }), { status: 200 })
    })
    const api = createApiClient({ baseUrl: 'https://api.test/api', getToken: async () => 't', fetch: fetch as any })
    await callAll(platformApi(api) as any)
    expect(calls.length).toBe(63)

    const missing = calls.filter(({ method, path }) => {
      const [, mount, ...rest] = path.split('/')
      const router = routers[mount]
      return !router || !router.has(`${method} /${rest.join('/')}`)
    })
    expect(missing).toEqual([])
  })

  it('never sends X-School-Id (no impersonation from the app)', async () => {
    const seen: Record<string, string>[] = []
    const fetch = vi.fn(async (_u: string, init?: RequestInit) => {
      seen.push(init?.headers as Record<string, string>)
      return new Response('{}', { status: 200 })
    })
    const api = createApiClient({ baseUrl: 'https://api.test/api', getToken: async () => 't', fetch: fetch as any })
    await callAll(platformApi(api) as any)
    expect(seen.some((h) => Object.keys(h).some((k) => k.toLowerCase() === 'x-school-id'))).toBe(false)
  })
})

describe('two-fa module matches backend/src/routes/two-fa.routes.ts', () => {
  it('every call has a backend route', async () => {
    const routes = backendRoutes('two-fa.routes.ts')
    const { api, calls } = recorder('/two-fa')
    await callAll(twoFaApi(api) as any)
    expect(calls.length).toBe(10)
    expect(calls.filter((c) => !routes.has(c))).toEqual([])
  })
})

describe('agreement module matches backend/src/routes/user-agreement.routes.ts', () => {
  it('every call has a backend route', async () => {
    const routes = backendRoutes('user-agreement.routes.ts')
    const { api, calls } = recorder('/user-agreements')
    await callAll(agreementApi(api) as any)
    expect(calls.length).toBe(8)
    expect(calls.filter((c) => !routes.has(c))).toEqual([])
  })
})
