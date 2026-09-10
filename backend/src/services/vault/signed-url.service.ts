import { supabase } from '../../config/supabase'

export const VAULT_MEDIA_BUCKET = 'vault-media'
const SIGNED_URL_TTL_SECONDS = Number(process.env.VAULT_SIGNED_URL_TTL || 300) // 5 minutes — this codebase's existing standard (fina/hifzi media use the same default)

/**
 * Mints a short-lived signed URL for a storage key. Callers MUST have
 * already passed the request through requireVaultAccess — this function
 * does no authorization itself, it only ever mints a URL for a key it's
 * given (same documented contract as fina/hifzi's signed-url services).
 */
export async function createVaultMediaSignedUrl(storageKey: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(VAULT_MEDIA_BUCKET).createSignedUrl(storageKey, SIGNED_URL_TTL_SECONDS)
  if (error || !data) {
    console.error('Error creating vault-media signed URL:', error)
    return null
  }
  return data.signedUrl
}
