import Constants from 'expo-constants'
import { Platform } from 'react-native'

import { env } from '@/lib/env'

/**
 * Crash and error reporting. Until a hosted crash service is chosen, reports go to the backend
 * (POST /client-errors), which writes one line per report to the server log. Only release builds
 * send; development builds log to the console. To move to a hosted service later, replace `send`.
 */
type User = { id: string; role: string } | null
let user: User = null
let installed = false
const recent = new Map<string, number>()

export function setMonitoringUser(next: User) {
  user = next
}

function describe(e: unknown): { name?: string; message: string; stack?: string } {
  if (e instanceof Error) return { name: e.name, message: e.message || String(e), stack: e.stack }
  return { message: typeof e === 'string' ? e : JSON.stringify(e) ?? String(e) }
}

async function send(body: Record<string, unknown>) {
  try {
    await fetch(`${env.apiUrl}/client-errors`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  } catch {
    // Reporting must never throw (offline, server down).
  }
}

/** Report an error. `context` names where it happened (e.g. "error-boundary", "global"). */
export function reportError(error: unknown, opts: { fatal?: boolean; context?: string; route?: string } = {}) {
  const d = describe(error)
  if (__DEV__) {
    console.warn(`[monitoring] ${opts.context ?? 'error'}:`, d.message)
    return
  }
  // The same error repeating (render loops) is sent once a minute at most.
  const key = `${d.name}:${d.message}`
  const now = Date.now()
  if ((recent.get(key) ?? 0) > now - 60_000) return
  recent.set(key, now)
  void send({
    ...d,
    fatal: !!opts.fatal,
    context: opts.context,
    route: opts.route,
    app_version: Constants.expoConfig?.version,
    build: String(Platform.OS === 'ios' ? (Constants.expoConfig?.ios?.buildNumber ?? '') : (Constants.expoConfig?.android?.versionCode ?? '')),
    platform: Platform.OS,
    os_version: String(Platform.Version),
    profile_id: user?.id,
    role: user?.role,
  })
}

/** Catch uncaught JS errors (they would otherwise only close the app) and report them first. */
export function installGlobalErrorHandler() {
  if (installed) return
  installed = true
  const g = globalThis as unknown as { ErrorUtils?: { getGlobalHandler: () => (e: unknown, fatal?: boolean) => void; setGlobalHandler: (h: (e: unknown, fatal?: boolean) => void) => void } }
  const eu = g.ErrorUtils
  if (!eu) return
  const previous = eu.getGlobalHandler()
  eu.setGlobalHandler((e, fatal) => {
    reportError(e, { fatal, context: 'global' })
    previous(e, fatal)
  })
}
