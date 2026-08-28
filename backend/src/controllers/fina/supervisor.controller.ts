import { Response } from 'express'
import { AuthRequest } from '../../middlewares/auth.middleware'
import * as service from '../../services/fina/supervisor-dashboard.service'
import { callerFromFinaRequest as callerFrom } from '../../utils/fina-caller'

function handleError(res: Response, error: any) {
  const msg = error?.message || 'Unexpected error'
  const status = msg.includes('Access denied') ? 403 : msg.includes('not found') ? 404 : 500
  return res.status(status).json({ success: false, error: msg })
}

export const getOverview = async (req: AuthRequest, res: Response) => {
  try {
    const data = await service.getSupervisorOverview(await callerFrom(req))
    return res.json({ success: true, data })
  } catch (error: any) { return handleError(res, error) }
}

export const getSchoolMetrics = async (req: AuthRequest, res: Response) => {
  try {
    const data = await service.getSchoolMetrics(await callerFrom(req), req.params.schoolId)
    return res.json({ success: true, data })
  } catch (error: any) { return handleError(res, error) }
}
