import { API_URL } from '@/config/api'

/**
 * View-only mode for pages whose module a role grants "can use" but not "can edit".
 *
 * The server already refuses those writes (role.middleware.ts). This is the matching client
 * side: while the current page is view-only, any write request (POST/PUT/PATCH/DELETE) to the
 * API is stopped before it is sent and answered with the same kind of 403 the server would
 * give, so every existing save/delete/create button fails immediately with a clear message
 * instead of appearing to work. It patches window.fetch once, so it covers every API helper
 * and hand-written fetch in the app without touching individual pages.
 */

export interface ViewOnlyState {
  active: boolean
  message: string
}

// Requests that are never "edits of the module": account self-service, notifications,
// feedback, user-preference helpers. Everything else that writes is blocked in view-only mode.
const ALWAYS_ALLOWED_PATHS = [
  '/auth/',
  '/two-fa',
  '/push',
  '/feedback',
  '/export-templates',
  '/user-profiles/my-permissions',
]

let state: ViewOnlyState = { active: false, message: '' }
let installed = false

export function setViewOnlyState(next: ViewOnlyState): void {
  state = next
}

function isWrite(method: string | undefined): boolean {
  return !['GET', 'HEAD', 'OPTIONS'].includes((method || 'GET').toUpperCase())
}

export function installViewOnlyGuard(): void {
  if (installed || typeof window === 'undefined') return
  installed = true

  const originalFetch = window.fetch.bind(window)
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    if (state.active) {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      const method = init?.method ?? (typeof input === 'object' && 'method' in input ? input.method : 'GET')
      if (url.startsWith(API_URL) && isWrite(method)) {
        const path = url.slice(API_URL.length).split('?')[0]
        if (!ALWAYS_ALLOWED_PATHS.some((p) => path.startsWith(p))) {
          return Promise.resolve(
            new Response(JSON.stringify({ success: false, error: state.message }), {
              status: 403,
              headers: { 'Content-Type': 'application/json' },
            })
          )
        }
      }
    }
    return originalFetch(input, init)
  }
}
