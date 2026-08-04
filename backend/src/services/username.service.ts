import { supabase } from '../config/supabase'
import bcrypt from 'bcrypt'
import { encryptSecret, decryptSecret } from '../utils/crypto'
import { validateCampusAccess } from '../utils/campus-validation'

export async function generateUniqueUsername(): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const candidate = Math.floor(10000000 + Math.random() * 90000000).toString()
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', candidate)
      .maybeSingle()
    if (!data) return candidate
  }
  throw new Error('Unable to generate unique username after 20 attempts')
}

function generatePlainPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  return Array.from({ length: 10 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('')
}

export async function generateCredentials(): Promise<{ username: string; plainPassword: string }> {
  const username = await generateUniqueUsername()
  const plainPassword = generatePlainPassword()
  return { username, plainPassword }
}

/**
 * Best-effort mirror of a plaintext password into the display-cache columns
 * (system_password hash + login_password_enc) so "view/print credentials"
 * screens can redisplay it later. Deliberately never throws: the caller has
 * already changed the REAL Supabase Auth password by this point, so failing
 * here (e.g. CREDENTIALS_ENCRYPTION_KEY missing in this environment) must not
 * roll that back into a state where the auth password changed but nothing
 * persisted says what it changed to — that's the exact silent-divergence bug
 * this exists to avoid. Worst case, the cache just goes stale and a future
 * "view credentials" call regenerates fresh ones.
 */
export async function syncPasswordDisplayCache(profileId: string, plainPassword: string): Promise<void> {
  try {
    const hashedPassword = await bcrypt.hash(plainPassword, 10)
    const { error } = await supabase
      .from('profiles')
      .update({
        system_password: hashedPassword,
        login_password_enc: encryptSecret(plainPassword),
      })
      .eq('id', profileId)
    if (error) throw error
  } catch (err: any) {
    console.warn(`⚠️ Password was updated but could not be cached for display (profile ${profileId}):`, err?.message ?? err)
  }
}

/**
 * Applies an admin-driven username and/or password change to a profile —
 * shared by the student/parent/teacher/staff "Edit Credentials" flows so
 * they all behave identically instead of each hand-rolling a subset of this.
 *
 * - Username: written directly (this IS the login identifier — some accounts
 *   have no real email, so a working username is often their only way in).
 *   A blank/whitespace-only value is ignored rather than clearing it, since
 *   every profile must always have a username to log in with.
 * - Password: synced to Supabase Auth FIRST (the actual authority), then
 *   mirrored into system_password/login_password_enc so "view/print
 *   credentials" screens don't go stale relative to what was just set here.
 */
export async function applyCredentialUpdate(
  profileId: string,
  updates: { username?: string; password?: string }
): Promise<{ username?: string }> {
  const result: { username?: string } = {}

  if (updates.username !== undefined) {
    const trimmed = updates.username.trim()
    if (trimmed) {
      const { error } = await supabase.from('profiles').update({ username: trimmed }).eq('id', profileId)
      if (error) {
        if (error.code === '23505') throw new Error('That username is already taken — please choose another.')
        throw new Error(`Failed to update username: ${error.message}`)
      }
      result.username = trimmed
    }
  }

  if (updates.password !== undefined) {
    if (updates.password.length < 8) throw new Error('Password must be at least 8 characters long')

    const { error: authError } = await supabase.auth.admin.updateUserById(profileId, { password: updates.password })
    if (authError) throw new Error(`Failed to update password: ${authError.message}`)

    // Best-effort only — must not undo the auth password change above if it fails.
    await syncPasswordDisplayCache(profileId, updates.password)
  }

  return result
}

export async function regenerateCredentials(
  profileId: string,
  adminSchoolId: string
): Promise<{ username: string; plainPassword: string }> {
  const { data: profile, error: fetchError } = await supabase
    .from('profiles')
    .select('id, school_id')
    .eq('id', profileId)
    .maybeSingle()

  if (fetchError || !profile) throw new Error('Profile not found')

  const hasAccess = await validateCampusAccess(adminSchoolId, profile.school_id)
  if (!hasAccess) throw new Error('Access denied')

  const { username, plainPassword } = await generateCredentials()

  // Sync Supabase auth password FIRST — if this fails, bail out before persisting/
  // displaying credentials that wouldn't actually work for username→email→signIn.
  const { error: authError } = await supabase.auth.admin.updateUserById(profileId, { password: plainPassword })
  if (authError) throw new Error(`Failed to update auth password: ${authError.message}`)

  // Username/flags need no encryption — safe to persist unconditionally.
  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      username,
      force_password_change: true,
      username_generated_at: new Date().toISOString(),
    })
    .eq('id', profileId)

  if (updateError) throw updateError

  // Best-effort only — must not undo the auth password change above if it fails.
  await syncPasswordDisplayCache(profileId, plainPassword)

  return { username, plainPassword }
}

/**
 * Fetch a profile's current login credentials for redisplay (e.g. printing an
 * ID card). Never resets an existing password — only generates one the first
 * time a profile has none (login_password_enc IS NULL).
 */
export async function getOrCreateStoredCredentials(
  profileId: string,
  adminSchoolId: string
): Promise<{ username: string; password: string }> {
  const { data: profile, error: fetchError } = await supabase
    .from('profiles')
    .select('id, username, login_password_enc, school_id')
    .eq('id', profileId)
    .maybeSingle()

  if (fetchError || !profile) {
    // Diagnostic checks to see if profileId is actually a record ID from another table
    const [isParent, isStaff, isStudent] = await Promise.all([
      supabase.from('parents').select('id, profile_id').eq('id', profileId).maybeSingle(),
      supabase.from('staff').select('id, profile_id').eq('id', profileId).maybeSingle(),
      supabase.from('students').select('id, profile_id').eq('id', profileId).maybeSingle()
    ]);
    console.error(`[Diagnostic] ID ${profileId} not in profiles. Found in - Parents: ${!!isParent.data}, Staff: ${!!isStaff.data}, Students: ${!!isStudent.data}`);
    if (isParent.data) console.error(`[Diagnostic] Found parent. Actual profile_id is: ${isParent.data.profile_id}`);
    throw new Error('Profile not found')
  }

  const hasAccess = await validateCampusAccess(adminSchoolId, profile.school_id)
  if (!hasAccess) throw new Error('Access denied')

  if (!profile.login_password_enc) {
    const { username, plainPassword } = await regenerateCredentials(profileId, adminSchoolId)
    return { username, password: plainPassword }
  }

  return {
    username: profile.username,
    password: decryptSecret(profile.login_password_enc),
  }
}

/**
 * Same as getOrCreateStoredCredentials, but for super admins fetching
 * credentials for a profile in ANY school — they aren't scoped to one
 * school_id, so the campus-access check doesn't apply.
 */
export async function getStoredCredentialsAsSuperAdmin(
  profileId: string
): Promise<{ username: string; password: string }> {
  const { data: profile, error: fetchError } = await supabase
    .from('profiles')
    .select('id, username, login_password_enc, school_id')
    .eq('id', profileId)
    .maybeSingle()

  if (fetchError || !profile) {
    throw new Error('Profile not found')
  }

  if (!profile.login_password_enc) {
    const { username, plainPassword } = await regenerateCredentials(profileId, profile.school_id)
    return { username, password: plainPassword }
  }

  return {
    username: profile.username,
    password: decryptSecret(profile.login_password_enc),
  }
}
