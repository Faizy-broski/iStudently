import { Response } from 'express'
import { AuthRequest } from '../../middlewares/auth.middleware'
import * as service from '../../services/fina/audit-search.service'
import { callerFromFinaRequest as callerFrom } from '../../utils/fina-caller'

export const search = async (req: AuthRequest, res: Response) => {
  try {
    const data = await service.searchAuditLog(await callerFrom(req), {
      schoolId: req.query.school_id as string | undefined,
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
      action: req.query.action as string | undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    })
    return res.json({ success: true, data })
  } catch (error: any) {
    const status = (error?.message || '').includes('Access denied') ? 403 : 500
    return res.status(status).json({ success: false, error: error?.message || 'Unexpected error' })
  }
}
