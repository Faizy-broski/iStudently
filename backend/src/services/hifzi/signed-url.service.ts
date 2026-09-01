import { supabase } from '../../config/supabase'

/**
 * Mints short-lived signed URLs for the private 'hifzi-media' bucket
 * (270_create_hifzi_media_storage_bucket.sql). Mirrors
 * backend/src/services/fina/signed-url.service.ts exactly. Callers are
 * responsible for their own authorization check before calling this — it
 * only ever mints a URL for a key it's given, no policy decision here.
 */

export const HIFZI_MEDIA_BUCKET = 'hifzi-media'
const SIGNED_URL_TTL_SECONDS = Number(process.env.HIFZI_SIGNED_URL_TTL || 300) // 5 minutes, matches fina-media's convention

export async function createHifziMediaSignedUrl(storageKey: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(HIFZI_MEDIA_BUCKET).createSignedUrl(storageKey, SIGNED_URL_TTL_SECONDS)
  if (error || !data) {
    console.error('Error creating hifzi-media signed URL:', error)
    return null
  }
  return data.signedUrl
}

export async function uploadHifziMedia(storageKey: string, file: Buffer, contentType: string): Promise<boolean> {
  const { error } = await supabase.storage.from(HIFZI_MEDIA_BUCKET).upload(storageKey, file, { contentType, upsert: false })
  if (error) {
    console.error('Error uploading to hifzi-media:', error)
    return false
  }
  return true
}
