import { supabase } from '../../config/supabase'

export const FINA_MEDIA_BUCKET = 'fina-media'
const SIGNED_URL_TTL_SECONDS = Number(process.env.FINA_SIGNED_URL_TTL || 300) // 5 minutes, matches inspection-media's convention

/**
 * Mints a short-lived signed URL for a storage key. Callers MUST have
 * already passed the key through consent-gate.service.ts's
 * resolveMediaDecision() — this function does no authorization itself, it
 * only ever mints a URL for a key it's given.
 */
export async function createFinaMediaSignedUrl(storageKey: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(FINA_MEDIA_BUCKET).createSignedUrl(storageKey, SIGNED_URL_TTL_SECONDS)
  if (error || !data) {
    console.error('Error creating fina-media signed URL:', error)
    return null
  }
  return data.signedUrl
}
