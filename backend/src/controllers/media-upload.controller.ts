import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import { supabase } from '../config/supabase'
import { getEffectiveSchoolId } from '../utils/campus-validation'
import { randomUUID } from 'crypto'

const BUCKET = 'media-recordings'

// Allowed MIME types for audio / video recordings from WebRTC
const ALLOWED_TYPES: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/webm;codecs=opus': 'webm',
  'audio/ogg': 'ogg',
  'audio/ogg;codecs=opus': 'ogg',
  'audio/mp4': 'm4a',
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
