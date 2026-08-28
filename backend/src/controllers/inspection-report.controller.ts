import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import * as service from '../services/inspection-report.service'

function callerFrom(req: AuthRequest) {
  return { profileId: req.profile?.id, role: req.profile?.role, schoolId: req.profile?.school_id }
}

function handleError(res: Response, error: any) {
  const msg = error?.message || 'Unexpected error'
  const status =
    msg.includes('Access denied') ? 403 :
    msg.includes('not found') ? 404 :
    msg.includes('required') || msg.includes('Cannot ') ? 400 :
    500
  return res.status(status).json({ success: false, error: msg })
}

export const getOrCreateReport = async (req: AuthRequest, res: Response) => {
  try {
    const { evaluation_id } = req.body
    if (!evaluation_id) return res.status(400).json({ success: false, error: 'evaluation_id is required' })
    const data = await service.getOrCreateReport(callerFrom(req) as any, evaluation_id)
    return res.status(201).json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export const getReport = async (req: AuthRequest, res: Response) => {
  try {
    const data = await service.getReport(callerFrom(req) as any, req.params.id)
    return res.json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export const getReportForEvaluation = async (req: AuthRequest, res: Response) => {
  try {
    const data = await service.getReportForEvaluation(callerFrom(req) as any, req.params.evaluationId)
    return res.json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export const listReportsForTeacher = async (req: AuthRequest, res: Response) => {
  try {
    const teacherProfileId = req.profile?.id
    if (!teacherProfileId) return res.status(401).json({ success: false, error: 'Unauthorized' })
    const data = await service.listReportsForTeacher(teacherProfileId)
    return res.json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export const listReportsForSchool = async (req: AuthRequest, res: Response) => {
  try {
    const data = await service.listReportsForSchool(callerFrom(req) as any, req.params.schoolId)
    return res.json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export const listReportsForInspector = async (req: AuthRequest, res: Response) => {
  try {
    const inspectorProfileId = req.profile?.id
    if (!inspectorProfileId) return res.status(401).json({ success: false, error: 'Unauthorized' })
    const data = await service.listReportsForInspector(inspectorProfileId)
    return res.json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export const recordReportPdf = async (req: AuthRequest, res: Response) => {
  try {
    const data = await service.recordReportPdf(callerFrom(req) as any, req.params.id, req.body)
    return res.json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export const getReportPdfSignedUrl = async (req: AuthRequest, res: Response) => {
  try {
    const data = await service.getReportPdfSignedUrl(callerFrom(req) as any, req.params.id)
    return res.json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}
