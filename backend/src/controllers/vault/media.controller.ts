import { Response } from 'express'
import path from 'path'
import crypto from 'crypto'
import { AuthRequest } from '../../middlewares/auth.middleware'
import { supabase } from '../../config/supabase'
import { VAULT_MEDIA_BUCKET } from '../../services/vault/signed-url.service'
import { getVaultWatermarkedImage, buildVaultWatermarkText } from '../../services/vault/watermark.service'
import { getRecord } from '../../services/vault/records.service'
import { logVaultAuditFromCaller } from '../../services/vault/audit-logger.service'
import { callerFromVaultRequest as callerFrom } from '../../utils/vault-caller'

function handleError(res: Response, error: any) {
  const msg = error?.message || 'Unexpected error'
  const status = msg.includes('not found') ? 404 : msg.includes('required') ? 400 : 500
  return res.status(status).json({ success: false, error: msg })
}

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp'])

export const uploadAttachment = async (req: AuthRequest, res: Response) => {
  try {
    const file = (req as any).file as Express.Multer.File | undefined
    if (!file) return res.status(400).json({ success: false, error: 'No file uploaded' })

    const caller = await callerFrom(req)
    const ext = path.extname(file.originalname) || ''
    const storageKey = `${caller.schoolId}/vault/${crypto.randomUUID()}${ext}`

    const { error } = await supabase.storage.from(VAULT_MEDIA_BUCKET).upload(storageKey, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    })
    if (error) throw new Error(`Failed to upload attachment: ${error.message}`)

    return res.status(201).json({ success: true, data: { storageKey } })
  } catch (error: any) {
    return handleError(res, error)
  }
}

/**
 * THE gate-protected serving endpoint (mirrors fina/media.controller.ts's
 * getMediaVariant) — the only route that turns a vault_records attachment
 * into actual bytes. Images get the per-view watermark baked into their
 * pixels here (spec §4A); PDFs are proxied as-is (see records.service.ts /
 * the approved Phase 1 plan for why PDF-per-view watermarking is deferred).
 * Every fetch is itself an auditable event.
 */
export const getAttachment = async (req: AuthRequest, res: Response) => {
  try {
    const caller = await callerFrom(req)
    const record = await getRecord(caller, req.params.recordId)
    const index = Number(req.params.index)
    const storageKey = record.attachments[index]
    if (!storageKey) return res.status(404).json({ success: false, error: 'Attachment not found' })

    const { data: file, error } = await supabase.storage.from(VAULT_MEDIA_BUCKET).download(storageKey)
    if (error || !file) return res.status(500).json({ success: false, error: 'Failed to load attachment' })

    const buffer = Buffer.from(await file.arrayBuffer())
    const ext = path.extname(storageKey).toLowerCase()

    await logVaultAuditFromCaller(caller, 'attachment.downloaded', {
      subjectType: 'vault_record',
      subjectId: record.id,
      meta: { index },
      ip: req.ip ?? null,
    })

    if (IMAGE_EXTENSIONS.has(ext)) {
      const viewerName = [req.profile?.first_name, req.profile?.last_name].filter(Boolean).join(' ') || caller.role
      const watermarkText = buildVaultWatermarkText(viewerName, req.ip || 'unknown')
      const cacheKey = `${storageKey}:${caller.profileId}`
      const watermarked = await getVaultWatermarkedImage(cacheKey, buffer, watermarkText)
      res.set('Content-Type', watermarked.contentType)
      return res.send(watermarked.buffer)
    }

    res.set('Content-Type', ext === '.pdf' ? 'application/pdf' : 'application/octet-stream')
    return res.send(buffer)
  } catch (error: any) {
    return handleError(res, error)
  }
}
