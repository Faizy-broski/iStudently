import { createClient } from '@supabase/supabase-js'
import { config } from '../config/env'
import { supabase } from '../config/supabase'

/**
 * Verifies a profile's CURRENT password against Supabase Auth's live
 * credential, via a real signInWithPassword call — not the legacy
 * `profiles.system_password` bcrypt column (two-fa.service.ts's only other
 * re-authentication precedent), which can silently drift out of sync with a
 * user's real password after they change it through the normal Supabase
 * Auth flow. Used for tripartite e-signature confirmation
 * (inspection-signature.service.ts) — a genuinely login-equivalent action,
 * so it deliberately uses the ANON key (like a real login), not the
 * service_role key.
 *
 * The client instance used here is created fresh per call, with
 * persistSession/autoRefreshToken both off — it never shares state with the
 * app's own service-role client or any real user session, and the resulting
 * session (if any) is simply discarded.
 */
export async function verifyPassword(profileId: string, password: string): Promise<boolean> {
  if (!password) return false

  const { data: profile, error } = await supabase.from('profiles').select('email').eq('id', profileId).single()
  if (error || !profile?.email) return false

  const verifyClient = createClient(config.supabase.url, config.supabase.anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { error: signInError } = await verifyClient.auth.signInWithPassword({ email: profile.email, password })
  return !signInError
}
