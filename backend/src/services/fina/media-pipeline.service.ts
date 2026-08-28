import { randomUUID, createHash } from 'crypto'
import sharp from 'sharp'
import { supabase } from '../../config/supabase'
import { CallerContext } from './types'
import { computeScopeFromTags, ConsentLevel } from './consent-engine.service'
import { logAuditFromCaller } from './audit-logger.service'
import { enqueueFinaJob } from '../../utils/fina-jobs'

/**
 * Ingest + manual-tagging pipeline (spec §9, adapted per the plan's Phase 1
 * deviation: no automated face detection, so every media asset requires a
 * human staff attestation before it can leave 'pending_tagging'). This file
 * (along with media-variants.service.ts) is one of the few places in the
 * module allowed to read raw fina_media/fina_face_tags rows outside
 * consent-gate.service.ts — it operates BEFORE the gate applies, on content
 * nobody has been granted view access to yet.
 */

export const FINA_MEDIA_BUCKET = 'fina-media'
const MAX_IMAGE_BYTES = 25 * 1024 * 1024
const MAX_VIDEO_BYTES = 200 * 1024 * 1024

const ALLOWED_TYPES: Record<string, { ext: string; kind: 'image' | 'video' }> = {
  'image/jpeg': { ext: 'jpg', kind: 'image' },
  'image/png': { ext: 'png', kind: 'image' },
  'image/webp': { ext: 'webp', kind: 'image' },
  'video/mp4': { ext: 'mp4', kind: 'video' },
  'video/webm': { ext: 'webm', kind: 'video' },
}

// super_admin excluded — spec §12: SYSADMIN has no Publish access, and media
// upload/tagging directly feeds publishing.
const UPLOAD_ROLES = ['admin', 'media_officer', 'teacher']

export interface UploadFileInput {
  buffer: Buffer
  mimetype: string
  originalname: string
  size: number
}

/** Strips every API-facing response of the two fields that must never leave
 * the server: storage_key (a raw private-bucket path) and variants (raw
 * storage keys for each rendition) — spec §10 "no endpoint ever returns
 * storage_key or a raw URL". */
export function toPublicMedia(row: Record<string, any>) {
  const { storage_key, variants, ...safe } = row
  return safe
}

function assertUploadAuthorized(caller: CallerContext) {
  if (!UPLOAD_ROLES.includes(caller.role)) {
    throw new Error('Access denied: staff access required to upload media')
  }
}

async function assertTaggingAuthorized(caller: CallerContext, mediaSchoolId: string) {
  if (!UPLOAD_ROLES.includes(caller.role)) throw new Error('Access denied: staff access required')
  if (caller.schoolId !== mediaSchoolId) {
    throw new Error('Access denied: media belongs to a different school')
  }
}

export async function uploadMedia(caller: CallerContext, file: UploadFileInput, albumId?: string | null) {
  assertUploadAuthorized(caller)

  if (albumId) {
    const { data: album } = await supabase.from('fina_albums').select('id, school_id').eq('id', albumId).maybeSingle()
    if (!album || album.school_id !== caller.schoolId) throw new Error('Album not found')
  }

  const mimeBase = file.mimetype.split(';')[0].trim().toLowerCase()
  const typeInfo = ALLOWED_TYPES[mimeBase]
  if (!typeInfo) throw new Error(`Unsupported file type: ${file.mimetype}`)

  const maxBytes = typeInfo.kind === 'image' ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES
  if (file.size > maxBytes) throw new Error(`File too large (max ${Math.round(maxBytes / (1024 * 1024))}MB)`)

  const { matchesFileSignature } = await import('../../utils/file-signature')
  if (!matchesFileSignature(file.buffer, mimeBase)) {
    throw new Error('File content does not match its declared type')
  }

  let processedBuffer: Buffer
  let width: number | null = null
  let height: number | null = null

  if (typeInfo.kind === 'image') {
    // .rotate() auto-orients using the EXIF orientation tag, THEN we
    // re-encode without calling .withMetadata() — sharp drops all metadata
    // (including GPS) on output by default, which is how the EXIF strip
    // actually happens here, not a separate step.
    const pipeline = sharp(file.buffer).rotate()
    const encoded =
      mimeBase === 'image/jpeg' ? pipeline.jpeg({ quality: 90 }) :
      mimeBase === 'image/png' ? pipeline.png() :
      pipeline.webp({ quality: 90 })
    processedBuffer = await encoded.toBuffer()
    const meta = await sharp(processedBuffer).metadata()
    width = meta.width ?? null
    height = meta.height ?? null
  } else {
    // Video: no metadata/GPS stripping in this build — doing so needs
    // ffmpeg or equivalent container-level tooling, deliberately not added
    // as a new infra dependency this phase. Documented gap, not silent.
    processedBuffer = file.buffer
  }

  const hash = createHash('sha256').update(processedBuffer).digest('hex')

  const { data: existing } = await supabase
    .from('fina_media')
    .select('*')
    .eq('school_id', caller.schoolId)
    .eq('original_hash', hash)
    .maybeSingle()
  if (existing) {
    return toPublicMedia(existing) // same-school dedupe — spec §9 step 3
  }

  const storagePath = `${caller.schoolId}/${randomUUID()}.${typeInfo.ext}`
  const { error: uploadError } = await supabase.storage
    .from(FINA_MEDIA_BUCKET)
    .upload(storagePath, processedBuffer, { contentType: mimeBase, upsert: false })
  if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`)

  const { data: created, error: insertError } = await supabase
    .from('fina_media')
    .insert({
      school_id: caller.schoolId,
      uploader_id: caller.profileId,
      kind: typeInfo.kind,
      storage_key: storagePath,
      original_hash: hash,
      width,
      height,
      bytes: processedBuffer.length,
      processing_state: 'pending_tagging',
      album_id: albumId ?? null,
    })
    .select()
    .single()

  if (insertError || !created) {
    await supabase.storage.from(FINA_MEDIA_BUCKET).remove([storagePath]).catch(() => {})
    throw new Error(`Failed to record media: ${insertError?.message}`)
  }

  await logAuditFromCaller(caller, 'media.uploaded', { subjectType: 'media', subjectId: created.id, meta: { kind: typeInfo.kind } })

  return toPublicMedia(created)
}

async function loadMediaForTaggingAction(mediaId: string) {
  const { data: media, error } = await supabase.from('fina_media').select('*').eq('id', mediaId).maybeSingle()
  if (error || !media) throw new Error('Media not found')
  return media
}

export async function addFaceTag(
  caller: CallerContext,
  mediaId: string,
  input: { studentId: string | null; bbox?: { x: number; y: number; w: number; h: number } }
) {
  const media = await loadMediaForTaggingAction(mediaId)
  await assertTaggingAuthorized(caller, media.school_id)
  if (media.processing_state !== 'pending_tagging') {
    throw new Error('Cannot tag: this media has already been confirmed')
  }

  if (input.studentId) {
    const { data: student } = await supabase.from('students').select('id, school_id').eq('id', input.studentId).maybeSingle()
    if (!student || student.school_id !== media.school_id) {
      throw new Error('Student not found in this school')
    }
  }

  const { data: created, error } = await supabase
    .from('fina_face_tags')
    .insert({
      media_id: mediaId,
      student_id: input.studentId,
      bbox: input.bbox ?? { x: 0, y: 0, w: 1, h: 1 },
      source: 'manual',
      tagged_by: caller.profileId,
    })
    .select()
    .single()

  if (error) {
    if ((error as any).code === '23505') throw new Error('This student is already tagged in this photo')
    throw new Error(`Failed to add tag: ${error.message}`)
  }

  if (input.studentId) {
    // A real tag now exists — clear a stale "no identifiable students" flag
    // if one had been set, so confirm-tagging's mutual-exclusion guard stays
    // consistent with the actual tag set.
    await supabase.from('fina_media').update({ no_identifiable_students: false }).eq('id', mediaId).eq('no_identifiable_students', true)
  }

  return created
}

export async function removeFaceTag(caller: CallerContext, mediaId: string, tagId: string) {
  const media = await loadMediaForTaggingAction(mediaId)
  await assertTaggingAuthorized(caller, media.school_id)
  if (media.processing_state !== 'pending_tagging') {
    throw new Error('Cannot edit tags: this media has already been confirmed')
  }

  const { error } = await supabase.from('fina_face_tags').delete().eq('id', tagId).eq('media_id', mediaId)
  if (error) throw new Error(`Failed to remove tag: ${error.message}`)
}

export async function setNoIdentifiableStudents(caller: CallerContext, mediaId: string, value: boolean) {
  const media = await loadMediaForTaggingAction(mediaId)
  await assertTaggingAuthorized(caller, media.school_id)
  if (media.processing_state !== 'pending_tagging') {
    throw new Error('Cannot edit tagging: this media has already been confirmed')
  }

  if (value) {
    const { count } = await supabase.from('fina_face_tags').select('id', { count: 'exact', head: true }).eq('media_id', mediaId)
    if ((count ?? 0) > 0) {
      throw new Error('Remove the existing tags before marking "no identifiable students"')
    }
  }

  const { data: updated, error } = await supabase
    .from('fina_media')
    .update({ no_identifiable_students: value })
    .eq('id', mediaId)
    .select()
    .single()
  if (error) throw new Error(`Failed to update: ${error.message}`)
  return toPublicMedia(updated)
}

/**
 * Locks tagging, computes the effective consent scope NOW (before variants
 * exist), and enqueues variant/blur generation. This is the hard gate: a
 * post (Phase 2) can never attach media that hasn't passed through here.
 */
export async function confirmTagging(caller: CallerContext, mediaId: string) {
  const media = await loadMediaForTaggingAction(mediaId)
  await assertTaggingAuthorized(caller, media.school_id)
  if (media.processing_state !== 'pending_tagging') {
    throw new Error('This media has already been confirmed')
  }

  const { data: tags, error: tagsError } = await supabase.from('fina_face_tags').select('student_id').eq('media_id', mediaId)
  if (tagsError) throw new Error(`Failed to load tags: ${tagsError.message}`)

  const tagRows = tags || []
  if (tagRows.length === 0 && !media.no_identifiable_students) {
    throw new Error('Tag the students in this photo, or mark "no identifiable students", before confirming')
  }

  const hasUnresolvedFace = tagRows.some((t) => t.student_id === null)
  const studentIds = [...new Set(tagRows.map((t) => t.student_id).filter(Boolean) as string[])]
  const scope = await computeScopeFromTags(studentIds, hasUnresolvedFace)

  const { data: updated, error: updateError } = await supabase
    .from('fina_media')
    .update({
      min_consent_level: scope,
      has_unconsented: scope === ConsentLevel.DENY_ALL,
      processing_state: 'pending_variants',
      confirmed_at: new Date().toISOString(),
      confirmed_by: caller.profileId,
    })
    .eq('id', mediaId)
    .eq('processing_state', 'pending_tagging') // atomic guard against a concurrent double-confirm
    .select()
    .single()

  if (updateError || !updated) throw new Error('Failed to confirm tagging — it may have already been confirmed')

  await enqueueFinaJob('generate_media_variants', { mediaId }, 3)
  await logAuditFromCaller(caller, 'media.tagging_confirmed', {
    subjectType: 'media',
    subjectId: mediaId,
    meta: { studentCount: studentIds.length, scope },
  })

  return toPublicMedia(updated)
}

/** Feeds the manual-tagging screen (Phase 1 frontend): the media row, its
 * current tags (resolved with basic student display info), and the list of
 * candidate students the caller may tag (their own school's roster). */
export async function getMediaForTagging(caller: CallerContext, mediaId: string) {
  const media = await loadMediaForTaggingAction(mediaId)
  await assertTaggingAuthorized(caller, media.school_id)

  const { data: tags, error: tagsError } = await supabase
    .from('fina_face_tags')
    .select('id, student_id, bbox, source, student:students(id, profile:profiles(first_name, last_name))')
    .eq('media_id', mediaId)
  if (tagsError) throw new Error(`Failed to load tags: ${tagsError.message}`)

  const { data: candidates, error: candidatesError } = await supabase
    .from('students')
    .select('id, profile:profiles(first_name, last_name), section:sections(name)')
    .eq('school_id', media.school_id)
  if (candidatesError) throw new Error(`Failed to load candidate students: ${candidatesError.message}`)

  return { media: toPublicMedia(media), tags: tags || [], candidateStudents: candidates || [] }
}

/** Staff-facing queue of media awaiting tagging at the caller's school. */
export async function listPendingTagging(caller: CallerContext) {
  if (!UPLOAD_ROLES.includes(caller.role)) throw new Error('Access denied: staff access required')
  const { data, error } = await supabase
    .from('fina_media')
    .select('*')
    .eq('school_id', caller.schoolId)
    .eq('processing_state', 'pending_tagging')
    .order('uploaded_at', { ascending: true })
  if (error) throw new Error(`Failed to load pending media: ${error.message}`)
  return (data || []).map(toPublicMedia)
}

/** Feeds the composer's photo/video picker (Phase 2) — the caller's own
 * fully-processed media, ready to attach to a post. */
export async function listMyReadyMedia(caller: CallerContext) {
  if (!UPLOAD_ROLES.includes(caller.role)) throw new Error('Access denied: staff access required')
  const { data, error } = await supabase
    .from('fina_media')
    .select('*')
    .eq('uploader_id', caller.profileId)
    .eq('processing_state', 'ready')
    .order('uploaded_at', { ascending: false })
    .limit(60)
  if (error) throw new Error(`Failed to load your media: ${error.message}`)
  return (data || []).map(toPublicMedia)
}
