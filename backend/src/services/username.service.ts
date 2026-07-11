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
  const hashedPassword = await bcrypt.hash(plainPassword, 10)

  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      username,
      system_password: hashedPassword,
      login_password_enc: encryptSecret(plainPassword),
      force_password_change: true,
      username_generated_at: new Date().toISOString(),
    })
    .eq('id', profileId)

  if (updateError) throw updateError

  // Update Supabase auth password so username→email→signInWithPassword works
  await supabase.auth.admin.updateUserById(profileId, { password: plainPassword })
    .catch(() => {})

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
