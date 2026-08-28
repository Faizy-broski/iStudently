import { Response } from 'express'
import { AuthRequest } from '../../middlewares/auth.middleware'
import * as service from '../../services/fina/monthly-report.service'
import { callerFromFinaRequest as callerFrom } from '../../utils/fina-caller'

function handleError(res: Response, error: any) {
  const msg = error?.message || 'Unexpected error'
  const status = msg.includes('Access denied') ? 403 : msg.includes('not found') ? 404 : 500
  return res.status(status).json({ success: false, error: msg })
}

export const listReports = async (req: AuthRequest, res: Response) => {
  try {
    const data = await service.listReports(await callerFrom(req), req.query.school_id as string | undefined)
    return res.json({ success: true, data })
  } catch (error: any) { return handleError(res, error) }
}

export const downloadReport = async (req: AuthRequest, res: Response) => {
  try {
    const url = await service.getReportDownloadUrl(await callerFrom(req), req.params.id)
    return res.json({ success: true, data: { url } })
  } catch (error: any) { return handleError(res, error) }
}

function currentPeriod(): string {
  const now = new Date()
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
}

export const generateReport = async (req: AuthRequest, res: Response) => {
  try {
    const caller = await callerFrom(req)
    if (caller.role !== 'admin') return res.status(403).json({ success: false, error: 'Access denied' })
    const period = req.body?.period || currentPeriod()
    const data = await service.generateMonthlyReport(caller.schoolId, period)
    return res.status(201).json({ success: true, data })
  } catch (error: any) { return handleError(res, error) }
}
