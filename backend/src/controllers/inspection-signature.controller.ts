import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import * as service from '../services/inspection-signature.service'

function callerFrom(req: AuthRequest) {
  return { profileId: req.profile?.id, role: req.profile?.role, schoolId: req.profile?.school_id }
}

function handleError(res: Response, error: any) {
  const msg = error?.message || 'Unexpected error'
  const status =
    msg.includes('Access denied') ? 403 :
    msg.includes('not found') ? 404 :
    msg.includes('Incorrect password') ? 401 :
    msg.includes('required') || msg.includes('already signed') || msg.includes('Waiting on') ? 400 :
    500
  return res.status(status).json({ success: false, error: msg })
}

// NOTE: there is deliberately no standalone GET /signatures endpoint here —
// inspection-report.controller.ts::getReport already returns the report's
// signatures embedded (and enforces the correct view-access check first).
// A bare-reportId signature lookup with no caller-based authorization would
// leak signer IP/user-agent/typed name for any report to any authenticated
// user; use GET /inspection-reports/:id instead.

export const signReport = async (req: AuthRequest, res: Response) => {
  try {
    const { password, typed_full_name } = req.body
    const meta = {
      ipAddress: req.ip || req.socket?.remoteAddress,
      userAgent: req.headers['user-agent'],
    }
    const data = await service.signReport(callerFrom(req) as any, req.params.reportId, { password, typed_full_name }, meta)
    return res.status(201).json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}
