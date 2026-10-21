import { supabase } from '@/lib/supabase'

/**
 * Confirms the signed-in user's current password before a sensitive change (new password), so an
 * unlocked phone left signed in can't be used to take the account over. Signs in again with the
 * same account; returns false when the password is wrong.
 */
export async function verifyCurrentPassword(password: string): Promise<boolean> {
  const { data } = await supabase.auth.getSession()
  const email = data.session?.user.email
  if (!email || !password) return false
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  return !error
}
