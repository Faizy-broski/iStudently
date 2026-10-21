import { supabase } from '../config/supabase'

/** Roles that can't delete their own account in the app (the platform owner account). */
const NOT_SELF_DELETABLE = new Set(['super_admin'])
const missingTable = (e: { code?: string } | null) => e?.code === 'PGRST205' || e?.code === '42P01'

export type DeletionResult = { ok: true } | { ok: false; status: number; error: string; code?: string }

/**
 * Account deletion requested by the user (App Store / Play policy). Records the request, then turns
 * sign-in off at once: the profile becomes inactive (the API rejects it) and the auth user is banned
 * (no new sessions or token refreshes). The school / platform team then erases or anonymises the data
 * from account_deletion_requests, keeping only what the school must retain.
 */
export async function requestAccountDeletion(profile: { id: string; role: string; school_id?: string | null }, reason?: string): Promise<DeletionResult> {
  if (NOT_SELF_DELETABLE.has(profile.role)) {
    return { ok: false, status: 400, code: 'not_self_deletable', error: 'This account cannot be deleted from the app. Please contact support.' }
  }

  const { error: insertError } = await supabase.from('account_deletion_requests').insert({
    profile_id: profile.id,
    school_id: profile.school_id ?? null,
    role: profile.role,
    reason: typeof reason === 'string' && reason.trim() ? reason.trim().slice(0, 1000) : null,
  })
  // A second request while one is open is fine: the account is already being deleted.
  if (insertError && insertError.code !== '23505') {
    if (missingTable(insertError)) return { ok: false, status: 503, code: 'not_migrated', error: 'Account deletion is not set up yet. Please contact your school.' }
    throw insertError
  }

  const { error: profileError } = await supabase.from('profiles').update({ is_active: false }).eq('id', profile.id)
  if (profileError) throw profileError

  // ~100 years: Supabase has no permanent ban; the data team removes the user when erasing.
  const { error: banError } = await supabase.auth.admin.updateUserById(profile.id, { ban_duration: '876000h' })
  if (banError) throw banError

  return { ok: true }
}
