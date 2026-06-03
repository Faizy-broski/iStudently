import { supabase } from '../config/supabase'
import bcrypt from 'bcrypt'

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
  schoolId: string
): Promise<{ username: string; plainPassword: string }> {
  const { data: profile, error: fetchError } = await supabase
    .from('profiles')
    .select('id, school_id')
    .eq('id', profileId)
    .eq('school_id', schoolId)
    .maybeSingle()

  if (fetchError || !profile) throw new Error('Profile not found or access denied')

  const { username, plainPassword } = await generateCredentials()
  const hashedPassword = await bcrypt.hash(plainPassword, 10)

  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      username,
      system_password: hashedPassword,
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
