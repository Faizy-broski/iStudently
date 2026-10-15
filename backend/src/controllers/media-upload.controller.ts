import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import { supabase } from '../config/supabase'
import { getEffectiveSchoolId } from '../utils/campus-validation'
import { randomUUID } from 'crypto'

const BUCKET = 'media-recordings'
const IMAGE_BUCKET = 'school-assets'

// Allowed MIME types for audio / video recordings from WebRTC
const ALLOWED_TYPES: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/webm;codecs=opus': 'webm',
  'audio/ogg': 'ogg',
  'audio/ogg;codecs=opus': 'ogg',
  'audio/mp4': 'm4a',
  // Speed Reading recordings from the app (speech recognizer output)
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/wave': 'wav',
  'video/webm': 'webm',
  'video/webm;codecs=vp8,opus': 'webm',
  'video/webm;codecs=vp9,opus': 'webm',
  'video/mp4': 'mp4',
}

const MAX_SIZE_BYTES = 50 * 1024 * 1024 // 50 MB

/**
 * POST /api/media/upload
 *
 * Accepts a multipart form-data upload with field name "file".
 * Stores the recording in Supabase Storage under:
 *   media-recordings/{school_id}/{uuid}.{ext}
 *
 * Returns the public URL so Tiptap can embed an <audio> or <video> element.
 */
export const uploadMediaRecording = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const adminSchoolId = req.profile?.school_id
    if (!adminSchoolId) {
      res.status(401).json({ success: false, error: 'Unauthorized' })
      return
    }

    // multer attaches req.file when using upload.single('file')
    const file = (req as any).file as Express.Multer.File | undefined
    if (!file) {
      res.status(400).json({ success: false, error: 'No file uploaded' })
      return
    }

    if (file.size > MAX_SIZE_BYTES) {
      res.status(413).json({ success: false, error: 'File too large (max 50 MB)' })
      return
    }

    // Normalise MIME type (browsers sometimes append codec params)
    const mimeBase = file.mimetype.split(';')[0].trim().toLowerCase()
    const ext = ALLOWED_TYPES[mimeBase] ?? ALLOWED_TYPES[file.mimetype.toLowerCase()]
    if (!ext) {
      res.status(415).json({ success: false, error: `Unsupported media type: ${file.mimetype}` })
      return
    }

    const campus_id = req.body?.campus_id as string | undefined
    const effectiveSchoolId = await getEffectiveSchoolId(adminSchoolId, campus_id)

    const fileName = `${effectiveSchoolId}/${randomUUID()}.${ext}`

    // Upload to Supabase Storage (service role bypasses RLS)
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      })

    if (uploadError) {
      console.error('[MediaUpload] Supabase storage error:', uploadError)
      res.status(500).json({ success: false, error: 'Storage upload failed: ' + uploadError.message })
      return
    }

    // Get the public URL
    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(fileName)

    res.status(201).json({
      success: true,
      data: {
        url: urlData.publicUrl,
        mime_type: file.mimetype,
        size: file.size,
        path: fileName,
      },
    })
  } catch (error: any) {
    console.error('[MediaUpload] Unexpected error:', error)
    res.status(500).json({ success: false, error: error.message || 'Upload failed' })
  }
}

const ATTACHMENT_BUCKET = 'school-assets'

const ALLOWED_ATTACHMENT_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'text/plain': 'txt',
  'text/csv': 'csv',
  'text/html': 'html',
  'application/xhtml+xml': 'html',
  'application/zip': 'zip',
  'application/x-zip-compressed': 'zip',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
}

// Attachments served from the public bucket must never render as a live page
// (uploaded HTML could host scripts/phishing under our storage domain), so these
// types are stored as a generic binary and the browser downloads them instead.
const DOWNLOAD_ONLY_EXTENSIONS = new Set(['html'])

const MAX_ATTACHMENT_SIZE_BYTES = 15 * 1024 * 1024 // 15 MB

/**
 * POST /api/media/upload-attachment
 *
 * Accepts a multipart form-data upload with field name "file".
 * Stores the file in Supabase Storage under:
 *   school-assets/{school_id}/message-attachments/{uuid}.{ext}
 *
 * Returns the public URL plus the original filename so the UI can show a
 * real file name instead of the storage path.
 */
export const uploadMessageAttachment = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const adminSchoolId = req.profile?.school_id
    if (!adminSchoolId) {
      res.status(401).json({ success: false, error: 'Unauthorized' })
      return
    }

    const file = (req as any).file as Express.Multer.File | undefined
    if (!file) {
      res.status(400).json({ success: false, error: 'No file uploaded' })
      return
    }

    if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
      res.status(413).json({ success: false, error: 'File too large (max 15 MB)' })
      return
    }

    const mimeBase = file.mimetype.split(';')[0].trim().toLowerCase()
    const ext = ALLOWED_ATTACHMENT_TYPES[mimeBase]
    if (!ext) {
      res.status(415).json({ success: false, error: `Unsupported file type: ${file.mimetype}` })
      return
    }

    const campus_id = req.body?.campus_id as string | undefined
    const effectiveSchoolId = await getEffectiveSchoolId(adminSchoolId, campus_id)

    const fileName = `${effectiveSchoolId}/message-attachments/${randomUUID()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from(ATTACHMENT_BUCKET)
      .upload(fileName, file.buffer, {
        contentType: DOWNLOAD_ONLY_EXTENSIONS.has(ext) ? 'application/octet-stream' : file.mimetype,
        upsert: false,
      })

    if (uploadError) {
      console.error('[AttachmentUpload] Supabase storage error:', uploadError)
      res.status(500).json({ success: false, error: 'Storage upload failed: ' + uploadError.message })
      return
    }

    const { data: urlData } = supabase.storage.from(ATTACHMENT_BUCKET).getPublicUrl(fileName)

    res.status(201).json({
      success: true,
      data: {
        url: urlData.publicUrl,
        mime_type: file.mimetype,
        size: file.size,
        path: fileName,
        name: file.originalname,
      },
    })
  } catch (error: any) {
    console.error('[AttachmentUpload] Unexpected error:', error)
    res.status(500).json({ success: false, error: error.message || 'Upload failed' })
  }
}

const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'image/svg': 'svg',
  'image/x-icon': 'ico',
  'image/vnd.microsoft.icon': 'ico',
  'image/bmp': 'bmp',
  'image/tiff': 'tiff',
  'image/avif': 'avif',
}

const MAX_IMAGE_SIZE_BYTES = 25 * 1024 * 1024 // 25 MB

/** Checks the file's leading bytes against the claimed image type (raster formats + SVG text). */
export function imageBytesMatch(mime: string, buf: Buffer): boolean {
  if (!buf || buf.length < 4) return false
  const hex = (n: number) => buf.subarray(0, n).toString('hex')
  switch (mime) {
    case 'image/jpeg':
    case 'image/jpg':
      return hex(3) === 'ffd8ff'
    case 'image/png':
      return hex(8) === '89504e470d0a1a0a'
    case 'image/gif':
      return buf.subarray(0, 6).toString('ascii') === 'GIF87a' || buf.subarray(0, 6).toString('ascii') === 'GIF89a'
    case 'image/webp':
      return buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP'
    case 'image/bmp':
      return buf.subarray(0, 2).toString('ascii') === 'BM'
    case 'image/x-icon':
    case 'image/vnd.microsoft.icon':
      return hex(4) === '00000100'
    case 'image/tiff':
      return hex(4) === '49492a00' || hex(4) === '4d4d002a'
    case 'image/avif':
      return buf.subarray(4, 12).toString('ascii').startsWith('ftypavi')
    case 'image/svg+xml':
    case 'image/svg': {
      const head = buf.subarray(0, 512).toString('utf8').replace(/^\uFEFF/, '').trimStart().toLowerCase()
      return head.startsWith('<svg') || head.startsWith('<?xml')
    }
    default:
      return false
  }
}

/**
 * POST /api/media/upload-image
 *
 * Accepts a multipart form-data upload with field name "file".
 * Stores the image in Supabase Storage under:
 *   school-assets/{school_id}/public-pages/{uuid}.{ext}
 *
 * Returns the public URL.
 */
export const uploadImageAsset = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    let adminSchoolId = req.profile?.school_id
    if (!adminSchoolId) {
      if (req.profile?.role === 'super_admin') {
        adminSchoolId = 'system'
      } else {
        res.status(401).json({ success: false, error: 'Unauthorized' })
        return
      }
    }

    const file = (req as any).file as Express.Multer.File | undefined
    if (!file) {
      res.status(400).json({ success: false, error: 'No file uploaded' })
      return
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      res.status(413).json({ success: false, error: 'File too large (max 25 MB)' })
      return
    }

    // Only listed image types, and the bytes must match the claimed type (no more fallback that
    // stored any content in the public bucket under a client-chosen content type).
    const mimeBase = (file.mimetype || '').split(';')[0].trim().toLowerCase()
    const ext = ALLOWED_IMAGE_TYPES[mimeBase]
    if (!ext || !imageBytesMatch(mimeBase, file.buffer)) {
      res.status(415).json({ success: false, error: 'Unsupported or invalid image file' })
      return
    }

    const fileName = `${adminSchoolId}/public-pages/${randomUUID()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from(IMAGE_BUCKET)
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      })

    if (uploadError) {
      console.error('[ImageUpload] Supabase storage error:', uploadError)
      res.status(500).json({ success: false, error: 'Storage upload failed: ' + uploadError.message })
      return
    }

    const { data: urlData } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(fileName)

    res.status(201).json({
      success: true,
      data: {
        url: urlData.publicUrl,
        mime_type: file.mimetype,
        size: file.size,
        path: fileName,
      },
    })
  } catch (error: any) {
    console.error('[ImageUpload] Unexpected error:', error)
    res.status(500).json({ success: false, error: error.message || 'Upload failed' })
  }
}

// ── Library files (covers + digital documents) ───────────────────────────────

const LIBRARY_BUCKET = 'books'

const LIBRARY_COVER_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

/** Same list the web's book dialogs accept (no HTML: the bucket is public). */
const LIBRARY_DOCUMENT_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'text/plain': 'txt',
  ...LIBRARY_COVER_TYPES,
}

const LIBRARY_COVER_MAX = 5 * 1024 * 1024
const LIBRARY_DOCUMENT_MAX = 50 * 1024 * 1024
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * POST /api/media/upload-library-file  (multipart: file, kind = 'cover' | 'document', category_id?)
 *
 * The app's replacement for the web's direct Storage uploads (lib/api/storage.ts
 * uploadLibraryCoverImage / uploadLibraryDocument): same bucket and path layout,
 *   books/{school_id}/covers/{uuid}.{ext}
 *   books/{school_id}/documents/{category_id|uncategorized}/{uuid}.{ext}
 * so the E-Library reader handles both alike. Covers: JPEG/PNG/WebP up to 5 MB;
 * documents: PDF/Office/txt/images up to 50 MB.
 */
export const uploadLibraryFile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schoolId = req.profile?.school_id
    if (!schoolId) {
      res.status(401).json({ success: false, error: 'Unauthorized' })
      return
    }
    const file = (req as any).file as Express.Multer.File | undefined
    if (!file) {
      res.status(400).json({ success: false, error: 'No file uploaded' })
      return
    }
    const kind = req.body?.kind === 'cover' ? 'cover' : 'document'
    const types = kind === 'cover' ? LIBRARY_COVER_TYPES : LIBRARY_DOCUMENT_TYPES
    const max = kind === 'cover' ? LIBRARY_COVER_MAX : LIBRARY_DOCUMENT_MAX
    if (file.size > max) {
      res.status(413).json({ success: false, error: `File too large (max ${max / 1024 / 1024} MB)` })
      return
    }
    const ext = types[(file.mimetype || '').split(';')[0].trim().toLowerCase()]
    if (!ext) {
      res.status(415).json({ success: false, error: `Unsupported file type: ${file.mimetype}` })
      return
    }
    // Images must really be images (the bucket is public).
    if (LIBRARY_COVER_TYPES[(file.mimetype || '').split(';')[0].trim().toLowerCase()] && !imageBytesMatch(file.mimetype.split(';')[0].trim().toLowerCase(), file.buffer)) {
      res.status(415).json({ success: false, error: 'File content does not match its type' })
      return
    }
    const categoryId = typeof req.body?.category_id === 'string' && UUID_PATTERN.test(req.body.category_id) ? req.body.category_id : null
    const path = kind === 'cover' ? `${schoolId}/covers/${randomUUID()}.${ext}` : `${schoolId}/documents/${categoryId ?? 'uncategorized'}/${randomUUID()}.${ext}`

    const { error: uploadError } = await supabase.storage.from(LIBRARY_BUCKET).upload(path, file.buffer, { contentType: file.mimetype, cacheControl: '3600', upsert: false })
    if (uploadError) {
      console.error('[LibraryUpload] Supabase storage error:', uploadError)
      res.status(500).json({ success: false, error: 'Storage upload failed: ' + uploadError.message })
      return
    }
    const { data: urlData } = supabase.storage.from(LIBRARY_BUCKET).getPublicUrl(path)
    res.status(201).json({ success: true, data: { url: urlData.publicUrl, path, name: file.originalname, size: file.size, mime_type: file.mimetype } })
  } catch (error: any) {
    console.error('[LibraryUpload] Unexpected error:', error)
    res.status(500).json({ success: false, error: error.message || 'Upload failed' })
  }
}
