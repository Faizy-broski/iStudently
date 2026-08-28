import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import * as service from '../services/inspection-analytics.service'

function callerFrom(req: AuthRequest) {
  return { profileId: req.profile?.id, role: req.profile?.role, schoolId: req.profile?.school_id }
}

function handleError(res: Response, error: any) {
  const msg = error?.message || 'Unexpected error'
  const status = msg.includes('Access denied') ? 403 : 500
  return res.status(status).json({ success: false, error: msg })
}

export const getInspectorDashboardStats = async (req: AuthRequest, res: Response) => {
  try {
    const data = await service.getInspectorDashboardStats(callerFrom(req) as any)
    return res.json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export const getSchoolDashboardStats = async (req: AuthRequest, res: Response) => {
  try {
    const data = await service.getSchoolDashboardStats(callerFrom(req) as any, req.params.schoolId)
    return res.json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}
