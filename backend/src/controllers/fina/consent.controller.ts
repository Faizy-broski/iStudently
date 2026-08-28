import { Response } from 'express'
import { AuthRequest } from '../../middlewares/auth.middleware'
import * as service from '../../services/fina/consent.service'
import { callerFromFinaRequest as callerFrom } from '../../utils/fina-caller'

function handleError(res: Response, error: any) {
  const msg = error?.message || 'Unexpected error'
  const status =
    msg.includes('Access denied') || msg.includes('Forbidden') ? 403 :
    msg.includes('not found') ? 404 :
    msg.includes('Invalid') || msg.includes('required') || msg.includes('already') || msg.includes('no longer') ? 400 :
    500
  return res.status(status).json({ success: false, error: msg })
}

export const getCurrentConsentText = async (_req: AuthRequest, res: Response) => {
  return res.json({ success: true, data: service.getCurrentConsentText() })
}

export const listMyWards = async (req: AuthRequest, res: Response) => {
  try {
    const data = await service.listMyWards(await callerFrom(req))
    return res.json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export const createConsent = async (req: AuthRequest, res: Response) => {
  try {
    const data = await service.createConsent(await callerFrom(req), {
      studentId: req.body?.student_id,
      level: req.body?.level,
      purpose: req.body?.purpose,
      validUntil: req.body?.valid_until,
      consentTextVersion: req.body?.consent_text_version,
      ip: req.ip ?? null,
      userAgent: req.get('user-agent') ?? null,
    })
    return res.status(201).json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export const withdrawConsent = async (req: AuthRequest, res: Response) => {
  try {
    const data = await service.withdrawConsent(await callerFrom(req), req.params.id)
    return res.json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export const getConsentCertificate = async (req: AuthRequest, res: Response) => {
  try {
    const data = await service.getConsentCertificateData(await callerFrom(req), req.params.id)
    return res.json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}
