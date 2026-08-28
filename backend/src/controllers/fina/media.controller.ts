import { Response } from 'express'
import { AuthRequest } from '../../middlewares/auth.middleware'
import { supabase } from '../../config/supabase'
import * as pipeline from '../../services/fina/media-pipeline.service'
import * as gate from '../../services/fina/consent-gate.service'
import { buildWatermarkText, getWatermarkedImage } from '../../services/fina/watermark.service'
import { callerFromFinaRequest as callerFrom } from '../../utils/fina-caller'

const FINA_MEDIA_BUCKET = 'fina-media'
const VALID_VARIANTS = ['thumb', 'sm', 'md', 'lg', 'blurred']

function handleError(res: Response, error: any) {
  const msg = error?.message || 'Unexpected error'
  const status =
    msg.includes('Access denied') || msg.includes('Forbidden') ? 403 :
    msg.includes('not found') || msg.includes('Not found') ? 404 :
    msg.includes('Unsupported') || msg.includes('too large') || msg.includes('does not match') ||
    msg.includes('Cannot ') || msg.includes('already') || msg.includes('Remove ') || msg.includes('Tag the students') ? 400 :
    500
  return res.status(status).json({ success: false, error: msg })
}

export const uploadMedia = async (req: AuthRequest, res: Response) => {
  try {
    const file = (req as any).file as Express.Multer.File | undefined
    if (!file) return res.status(400).json({ success: false, error: 'No file uploaded' })

    const data = await pipeline.uploadMedia(await callerFrom(req), {
      buffer: file.buffer,
      mimetype: file.mimetype,
      originalname: file.originalname,
      size: file.size,
    }, req.body?.album_id || null)
    return res.status(201).json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export const addFaceTag = async (req: AuthRequest, res: Response) => {
  try {
    const data = await pipeline.addFaceTag(await callerFrom(req), req.params.id, {
      studentId: req.body?.student_id ?? null,
      bbox: req.body?.bbox,
    })
    return res.status(201).json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export const removeFaceTag = async (req: AuthRequest, res: Response) => {
  try {
    await pipeline.removeFaceTag(await callerFrom(req), req.params.id, req.params.tagId)
    return res.json({ success: true })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export const setNoIdentifiableStudents = async (req: AuthRequest, res: Response) => {
  try {
    const data = await pipeline.setNoIdentifiableStudents(await callerFrom(req), req.params.id, !!req.body?.value)
    return res.json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export const confirmTagging = async (req: AuthRequest, res: Response) => {
  try {
    const data = await pipeline.confirmTagging(await callerFrom(req), req.params.id)
    return res.json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export const getMediaForTagging = async (req: AuthRequest, res: Response) => {
  try {
    const data = await pipeline.getMediaForTagging(await callerFrom(req), req.params.id)
    return res.json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export const listPendingTagging = async (req: AuthRequest, res: Response) => {
  try {
    const data = await pipeline.listPendingTagging(await callerFrom(req))
    return res.json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export const listMyReadyMedia = async (req: AuthRequest, res: Response) => {
  try {
    const data = await pipeline.listMyReadyMedia(await callerFrom(req))
    return res.json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}

/**
 * Staff-only, pre-gate raw preview — used by the tagging screen to actually
 * display the photo/video so a human can identify who's in it. Deliberately
 * NOT routed through resolveMediaDecision(): during 'pending_tagging' the
 * asset hasn't been consent-scoped yet at all (that's the whole point of
 * this screen), so gating it against a consent scope that doesn't exist yet
 * would be meaningless. Authorization here is staff-role + same-school only,
 * enforced inside media-pipeline.service.ts's own tagging-authorization
 * check — the same pre-gate carve-out documented in consent-gate.service.ts's
 * header comment.
 */
export const getRawMediaPreview = async (req: AuthRequest, res: Response) => {
  try {
    const caller = await callerFrom(req)
    // Reuses getMediaForTagging's authorization path to load+authorize the
    // row without duplicating that logic; only the storage bytes are new here.
    const { media } = await pipeline.getMediaForTagging(caller, req.params.id)
    const { data: fullRow } = await supabase.from('fina_media').select('storage_key, kind').eq('id', media.id).maybeSingle()
    if (!fullRow) return res.status(404).json({ success: false, error: 'Not found' })

    const { data: file, error } = await supabase.storage.from(FINA_MEDIA_BUCKET).download(fullRow.storage_key)
    if (error || !file) return res.status(500).json({ success: false, error: 'Failed to load media' })

    const buffer = Buffer.from(await file.arrayBuffer())
    const contentType = fullRow.kind === 'video' ? 'video/mp4' : 'image/jpeg'
    res.set('Content-Type', contentType)
    return res.send(buffer)
  } catch (error: any) {
    return handleError(res, error)
  }
}

/**
 * THE gate-protected serving endpoint — the only route in this module
 * permitted to turn a fina_media row into actual bytes for a general
 * viewer. Only serves variants that exist on a 'ready' asset; a not-yet-
 * ready asset is never exposed here regardless of caller role (staff use
 * getRawMediaPreview above for pre-confirmation review instead).
 */
export const getMediaVariant = async (req: AuthRequest, res: Response) => {
  try {
    const mediaId = req.params.id
    const variant = req.params.variant

    if (!VALID_VARIANTS.includes(variant)) {
      return res.status(400).json({ success: false, error: 'Invalid variant' })
    }

    const caller = await callerFrom(req)
    const decision = await gate.resolveMediaDecision(caller, mediaId)
    if (decision.kind === 'denied') {
      return res.status(403).json({ success: false, error: 'Forbidden' })
    }

    const { data: media, error } = await supabase
      .from('fina_media')
      .select('kind, processing_state, variants')
      .eq('id', mediaId)
      .maybeSingle()

    // Denials must not distinguish "not found" from "not authorized" — but a
    // decision other than 'denied' already implies the row exists, so a
    // missing row here means a race (e.g. deleted between the two queries),
    // safe to surface as a generic 403 rather than 404.
    if (error || !media || media.processing_state !== 'ready') {
      return res.status(403).json({ success: false, error: 'Forbidden' })
    }

    const effectiveVariant = decision.kind === 'blurred' ? 'blurred' : variant
    const key = media.variants?.[effectiveVariant]
    if (!key) {
      return res.status(404).json({ success: false, error: 'Variant not available' })
    }

    const { data: file, error: downloadError } = await supabase.storage.from(FINA_MEDIA_BUCKET).download(key)
    if (downloadError || !file) {
      return res.status(500).json({ success: false, error: 'Failed to load media' })
    }
    const buffer = Buffer.from(await file.arrayBuffer())

    if (media.kind === 'video') {
      // No per-request watermarking for video in this build (see
      // media-variants.service.ts's header) — streamed as-is.
      res.set('Content-Type', 'video/mp4')
      return res.send(buffer)
    }

    const viewerName = [req.profile?.first_name, req.profile?.last_name].filter(Boolean).join(' ') || caller.role
    const watermarkText = buildWatermarkText(viewerName, caller.profileId)
    const cacheKey = `${key}:${caller.profileId}`
    const watermarked = await getWatermarkedImage(cacheKey, buffer, watermarkText)

    res.set('Content-Type', watermarked.contentType)
    return res.send(watermarked.buffer)
  } catch (error: any) {
    console.error('[FinaMedia] getMediaVariant error:', error)
    return res.status(500).json({ success: false, error: 'Failed to load media' })
  }
}
