import sharp from 'sharp'
import { supabase } from '../../config/supabase'
import { registerFinaJobHandler } from './jobs-runner.service'
import { FINA_MEDIA_BUCKET } from './media-pipeline.service'

/**
 * Handler for the 'generate_media_variants' fina_jobs kind — runs off the
 * request path (spec §9's explicit "media never processed in-request"
 * requirement). Registered with the poller as a side effect of importing
 * this module (see the bottom of this file); backend/src/app.ts imports it
 * once at startup purely for that registration.
 *
 * Video: this build does not transcode or generate thumbnails/blurred
 * renditions for video (no ffmpeg dependency added this phase — see
 * media-pipeline.service.ts's upload-time comment on the same limitation
 * for EXIF/GPS stripping). variants stays empty for video; the serving
 * layer (media.controller.ts / consent-gate.service.ts) knows that a video
 * with no blurred variant must be DENIED outright when its scope is
 * DENY_ALL, never degraded to "blurred", since no blurred file exists to
 * serve — a stricter behavior than images get, not a weaker one.
 */

const VARIANT_SIZES: { name: 'thumb' | 'sm' | 'md' | 'lg'; width: number }[] = [
  { name: 'thumb', width: 200 },
  { name: 'sm', width: 480 },
  { name: 'md', width: 960 },
  { name: 'lg', width: 1600 },
]

async function downloadOriginal(storageKey: string): Promise<Buffer> {
  const { data, error } = await supabase.storage.from(FINA_MEDIA_BUCKET).download(storageKey)
  if (error || !data) throw new Error(`Failed to download original: ${error?.message}`)
  const arrayBuffer = await data.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

async function uploadVariant(schoolId: string, mediaId: string, name: string, buffer: Buffer): Promise<string> {
  const key = `${schoolId}/variants/${mediaId}/${name}.jpg`
  const { error } = await supabase.storage.from(FINA_MEDIA_BUCKET).upload(key, buffer, { contentType: 'image/jpeg', upsert: true })
  if (error) throw new Error(`Failed to upload variant '${name}': ${error.message}`)
  return key
}

/** Gaussian blur then a pixelation pass (downscale with nearest-neighbor,
 * then upscale) over the WHOLE image — belt and braces, per spec §9 step 7.
 * Applied to the entire frame, not a per-face crop, since this build has no
 * face-bounding-box detection to blur selectively (see the plan's Phase 1
 * deviation note) — whole-image blur is the correct, more-restrictive
 * fallback when a photo's scope is DENY_ALL. */
async function buildBlurredVariant(image: ReturnType<typeof sharp>, originalWidth: number, originalHeight: number, maxWidth = 960): Promise<Buffer> {
  const width = Math.min(originalWidth, maxWidth)
  const height = Math.max(1, Math.round(originalHeight * (width / originalWidth)))
  const pixelWidth = Math.max(1, Math.round(width / 20))
  const pixelHeight = Math.max(1, Math.round(height / 20))
  return image
    .clone()
    .resize(pixelWidth, pixelHeight, { kernel: 'nearest' })
    .resize(width, height, { kernel: 'nearest' })
    .blur(25)
    .jpeg({ quality: 70 })
    .toBuffer()
}

export async function handleGenerateMediaVariants(payload: Record<string, any>): Promise<void> {
  const mediaId = payload.mediaId as string
  const { data: media, error } = await supabase.from('fina_media').select('*').eq('id', mediaId).maybeSingle()
  if (error || !media) throw new Error(`Media not found for variant generation: ${mediaId}`)

  if (media.kind === 'video') {
    const { error: updateError } = await supabase
      .from('fina_media')
      .update({ variants: {}, processing_state: 'ready' })
      .eq('id', mediaId)
    if (updateError) throw new Error(`Failed to finalize video media: ${updateError.message}`)
    return
  }

  const original = await downloadOriginal(media.storage_key)
  const baseImage = sharp(original)
  const meta = await baseImage.metadata()
  const width = meta.width || 1600
  const height = meta.height || 1200

  const variants: Record<string, string> = {}
  for (const size of VARIANT_SIZES) {
    const buffer = await baseImage.clone().resize({ width: size.width, withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer()
    variants[size.name] = await uploadVariant(media.school_id, mediaId, size.name, buffer)
  }

  const blurredBuffer = await buildBlurredVariant(baseImage, width, height)
  variants.blurred = await uploadVariant(media.school_id, mediaId, 'blurred', blurredBuffer)

  const { error: updateError } = await supabase
    .from('fina_media')
    .update({ variants, processing_state: 'ready' })
    .eq('id', mediaId)
  if (updateError) throw new Error(`Failed to finalize image media: ${updateError.message}`)
}

registerFinaJobHandler('generate_media_variants', handleGenerateMediaVariants)
