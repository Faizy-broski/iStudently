import { supabase } from '../config/supabase';

/**
 * Mints short-lived signed URLs for the private 'training-certificates' bucket
 * (308_create_training_certificates_storage_bucket.sql). Mirrors
 * backend/src/services/hifzi/signed-url.service.ts exactly. Callers are
 * responsible for their own authorization check before calling this — it
 * only ever mints a URL for a key it's given, no policy decision here.
 */

export const TRAINING_CERTIFICATES_BUCKET = 'training-certificates';
const SIGNED_URL_TTL_SECONDS = Number(process.env.TRAINING_CERT_SIGNED_URL_TTL || 300); // 5 minutes

export async function createTrainingCertificateSignedUrl(storageKey: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(TRAINING_CERTIFICATES_BUCKET)
    .createSignedUrl(storageKey, SIGNED_URL_TTL_SECONDS);
  if (error || !data) {
    console.error('Error creating training-certificates signed URL:', error);
    return null;
  }
  return data.signedUrl;
}

export async function uploadTrainingCertificate(storageKey: string, file: Buffer): Promise<boolean> {
  const { error } = await supabase.storage
    .from(TRAINING_CERTIFICATES_BUCKET)
    .upload(storageKey, file, { contentType: 'application/pdf', upsert: true });
  if (error) {
    console.error('Error uploading to training-certificates:', error);
    return false;
  }
  return true;
}
