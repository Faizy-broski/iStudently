import { createClient } from '@supabase/supabase-js'

/**
 * Re-authenticates the signed-in user with their CURRENT password before a destructive action
 * (account deletion), so a stolen/unlocked session cannot do it alone. Signs in again with a
 * throwaway client (no session kept) and never touches the shared service-role clients.
 * Returns false on a wrong password; throws only if the auth service itself is unreachable.
 */
export async function verifyPassword(email: string | undefined, password: unknown): Promise<boolean> {
  if (!email || typeof password !== 'string' || !password || password.length > 256) return false
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Auth service is not configured')
  const client = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error) {
    // Bad credentials are a normal "no"; anything else (network, 5xx) must not read as a wrong password.
    if (error.status === 400 || error.status === 401 || /invalid login credentials/i.test(error.message)) return false
    throw new Error(`Password check failed: ${error.message}`)
  }
  return !!data.session
}
