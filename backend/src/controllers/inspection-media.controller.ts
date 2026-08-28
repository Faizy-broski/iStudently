import { Response } from 'express'
import { randomUUID } from 'crypto'
import { AuthRequest } from '../middlewares/auth.middleware'
import { supabase } from '../config/supabase'
import { matchesFileSignature } from '../utils/file-signature'
import * as evaluationService from '../services/inspection-evaluation.service'
import * as reportService from '../services/inspection-report.service'

// Kept deliberately separate from media-upload.controller.ts: that
// controller's buckets (media-recordings, school-assets) are public=true —
// unsuitable for photos of students/classrooms. inspection-media is
// private; every read goes through a signed URL, not a public one.

const BUCKET = 'inspection-media'
const MAX_SIZE_BYTES = 25 * 1024 * 1024 // 25MB, matches the bucket's own file_size_limit

const ALLOWED_TYPES: Record<string, { ext: string; kind: 'photo' | 'audio' }> = {
  'image/jpeg': { ext: 'jpg', kind: 'photo' },
  'image/png': { ext: 'png', kind: 'photo' },
  'audio/webm': { ext: 'webm', kind: 'audio' },
  'audio/ogg': { ext: 'ogg', kind: 'audio' },
}

/**
 * POST /api/inspection-media/:evaluationId/upload
 * Multipart form-data, field name "file". Optional body field criterion_id.
 * Validates real file bytes against the declared MIME type, authorizes the
 * caller against the target evaluation, THEN uploads to the private
 * inspection-media bucket and records the DB row via
 * inspection-evaluation.service.ts::addEvidence (which re-checks ownership
 * once more — defense in depth, not the primary gate).
 */
export const uploadEvidence = async (req: AuthRequest, res: Response) => {
  try {
    const evaluationId = req.params.evaluationId
    const file = (req as any).file as Express.Multer.File | undefined
    if (!file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' })
    }
    if (file.size > MAX_SIZE_BYTES) {
      return res.status(413).json({ success: false, error: 'File too large (max 25MB)' })
    }

    const mimeBase = file.mimetype.split(';')[0].trim().toLowerCase()
    const typeInfo = ALLOWED_TYPES[mimeBase]
    if (!typeInfo) {
      return res.status(415).json({ success: false, error: `Unsupported file type: ${file.mimetype}` })
    }
    if (!matchesFileSignature(file.buffer, mimeBase)) {
      return res.status(415).json({ success: false, error: 'File content does not match its declared type' })
    }

    // Authorize BEFORE writing any bytes to storage — not after, which would
    // let an unauthorized caller's file briefly land in storage pending
    // cleanup. Mirrors grievance.service.ts::uploadAttachmentFile's ordering.
    const caller = { profileId: req.profile?.id, role: req.profile?.role, schoolId: req.profile?.school_id }
    try {
      await evaluationService.assertCanUploadEvidence(caller as any, evaluationId)
    } catch (authError: any) {
      const status = authError.message?.includes('Access denied') ? 403 : authError.message?.includes('Cannot ') ? 400 : 404
      return res.status(status).json({ success: false, error: authError.message })
    }

    const schoolId = req.profile?.school_id || 'unknown'
    const storagePath = `${schoolId}/${evaluationId}/${randomUUID()}.${typeInfo.ext}`

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, file.buffer, { contentType: file.mimetype, upsert: false })

    if (uploadError) {
      console.error('[InspectionMedia] Storage upload error:', uploadError)
      return res.status(500).json({ success: false, error: 'Storage upload failed: ' + uploadError.message })
    }

    try {
      const evidence = await evaluationService.addEvidence(caller as any, evaluationId, {
        criterion_id: req.body?.criterion_id || null,
        file_url: storagePath,
        file_name: file.originalname,
        file_type: typeInfo.kind,
        file_size: file.size,
      })
      return res.status(201).json({ success: true, data: evidence })
    } catch (dbError: any) {
      // The DB row failed (e.g. evaluation no longer in draft) — clean up the
      // orphaned storage object rather than leaving an untracked file behind.
      await supabase.storage.from(BUCKET).remove([storagePath]).catch(() => {})
      const status = dbError.message?.includes('Access denied') ? 403 : dbError.message?.includes('Cannot ') ? 400 : 500
      return res.status(status).json({ success: false, error: dbError.message })
    }
  } catch (error: any) {
    console.error('[InspectionMedia] Unexpected error:', error)
    return res.status(500).json({ success: false, error: error.message || 'Upload failed' })
  }
}

const MAX_PDF_SIZE_BYTES = 25 * 1024 * 1024

/**
 * POST /api/inspection-media/reports/:reportId/upload
 * Multipart form-data, field name "file" — the client-generated report PDF
 * (see InspectionReportDocument.tsx's html2canvas+jsPDF pipeline, which runs
 * in-page rather than in a popup so the resulting Blob is directly
 * available, unlike lib/utils/printLayout.ts::openPdfDownload()).
 */
export const uploadReportPdf = async (req: AuthRequest, res: Response) => {
  try {
    const reportId = req.params.reportId
    const file = (req as any).file as Express.Multer.File | undefined
    if (!file) return res.status(400).json({ success: false, error: 'No file uploaded' })
    if (file.size > MAX_PDF_SIZE_BYTES) return res.status(413).json({ success: false, error: 'File too large (max 25MB)' })

    const mimeBase = file.mimetype.split(';')[0].trim().toLowerCase()
    if (mimeBase !== 'application/pdf') {
      return res.status(415).json({ success: false, error: `Unsupported file type: ${file.mimetype}` })
    }
    if (!matchesFileSignature(file.buffer, mimeBase)) {
      return res.status(415).json({ success: false, error: 'File content does not match its declared type' })
    }

    const caller = { profileId: req.profile?.id, role: req.profile?.role, schoolId: req.profile?.school_id }
    let report
    try {
      report = await reportService.assertCanUploadReportPdf(caller as any, reportId)
    } catch (authError: any) {
      const status = authError.message?.includes('Access denied') ? 403 : 404
      return res.status(status).json({ success: false, error: authError.message })
    }

    const storagePath = `${report.school_id}/reports/${reportId}/${randomUUID()}.pdf`

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, file.buffer, { contentType: 'application/pdf', upsert: false })

    if (uploadError) {
      console.error('[InspectionMedia] Report PDF storage upload error:', uploadError)
      return res.status(500).json({ success: false, error: 'Storage upload failed: ' + uploadError.message })
    }

    try {
      const updatedReport = await reportService.recordReportPdf(caller as any, reportId, {
        file_url: storagePath,
        file_size: file.size,
      })
      return res.status(201).json({ success: true, data: updatedReport })
    } catch (dbError: any) {
      await supabase.storage.from(BUCKET).remove([storagePath]).catch(() => {})
      return res.status(500).json({ success: false, error: dbError.message })
    }
  } catch (error: any) {
    console.error('[InspectionMedia] Unexpected error (report PDF):', error)
    return res.status(500).json({ success: false, error: error.message || 'Upload failed' })
  }
}
