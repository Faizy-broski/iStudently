import type { AccountGate, Me } from '@studently/api-client'
import type { Session } from '@supabase/supabase-js'
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

import { hasSavedLocale, locale, setLocale } from '@/i18n'
import { auth, onAccountGate } from '@/lib/api'
import { setMonitoringUser } from '@/lib/monitoring'
import { supabase } from '@/lib/supabase'

export type SignInResult =
  | { ok: true }
  | { ok: false; error: 'not_found' | 'invalid' | 'rate_limited' | 'network' | 'other'; code?: string; message?: string }

/** Result of GET /auth/me for the signed-in user. */
export type MeState =
  | { status: 'loading' }
  | { status: 'ready'; me: Me }
  /** Server refused the account (suspended school, expired trial, rejected agreement). */
  | { status: 'blocked'; gate: AccountGate; message?: string }
  | { status: 'error'; message?: string; retryable: boolean }

interface SessionState {
  session: Session | null
  loading: boolean
  me: MeState
  refreshMe(): Promise<void>
  signIn(identifier: string, password: string): Promise<SignInResult>
  signOut(): Promise<void>
}

const SessionContext = createContext<SessionState | null>(null)

const BLOCKING_GATES: AccountGate[] = ['SCHOOL_SUSPENDED', 'TRIAL_EXPIRED', 'AGREEMENT_REJECTED']

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [me, setMe] = useState<MeState>({ status: 'loading' })
  const userId = session?.user.id

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => data.subscription.unsubscribe()
  }, [])

  // Apply a /auth/me response.
  const applyMe = useCallback((res: Awaited<ReturnType<typeof auth.getMe>>) => {
    if (res.success && res.data) {
      // First sign-in on this device: use the language saved on the account (set on the web or another phone).
      const accountLang = res.data.profile.language
      if (!hasSavedLocale() && accountLang && accountLang !== locale) setLocale(accountLang)
      setMonitoringUser({ id: res.data.profile.id, role: res.data.profile.role })
      return setMe({ status: 'ready', me: res.data })
    }
    if (res.code && BLOCKING_GATES.includes(res.code as AccountGate)) {
      return setMe({ status: 'blocked', gate: res.code as AccountGate, message: res.error })
    }
    setMe({ status: 'error', message: res.error, retryable: res.retryable ?? false })
  }, [])

  const refreshMe = useCallback(async () => {
    setMe({ status: 'loading' })
    applyMe(await auth.getMe())
  }, [applyMe])

  // Load /auth/me whenever a different user signs in.
  // A different user (or none): back to loading during render, then fetch.
  const [meFor, setMeFor] = useState<string | undefined>(undefined)
  if (meFor !== userId) {
    setMeFor(userId)
    setMe({ status: 'loading' })
  }
  useEffect(() => {
    if (!userId) return setMonitoringUser(null)
    let alive = true
    auth.getMe().then((res) => {
      if (alive) applyMe(res)
    })
    return () => {
      alive = false
    }
  }, [userId, applyMe])

  // Any API call that hits a 2FA/suspension/agreement 403 re-checks the account state.
  useEffect(
    () =>
      onAccountGate((gate, message) => {
        if (BLOCKING_GATES.includes(gate)) setMe({ status: 'blocked', gate, message })
        else refreshMe()
      }),
    [refreshMe],
  )

  async function signIn(identifier: string, password: string): Promise<SignInResult> {
    // Same two-step flow as the web: usernames are resolved to an email first.
    let email = identifier.trim()
    if (!email.includes('@')) {
      const resolved = await auth.resolveUsername(email)
      if (!resolved.ok) return { ok: false, error: resolved.reason }
      email = resolved.email
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (!error) return { ok: true }
    if (__DEV__) console.warn('[auth] signIn failed', error.status, error.code, error.message)
    const detail = { code: error.code, message: error.message }
    if (error.code === 'invalid_credentials') return { ok: false, error: 'invalid', ...detail }
    if (error.status === 429 || error.code === 'over_request_rate_limit') return { ok: false, error: 'rate_limited', ...detail }
    if (!error.status) return { ok: false, error: 'network', ...detail }
    return { ok: false, error: 'other', ...detail }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <SessionContext.Provider value={{ session, loading, me, refreshMe, signIn, signOut }}>
      {children}
    </SessionContext.Provider>
  )
}

export function useSession() {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession must be used inside SessionProvider')
  return ctx
}
