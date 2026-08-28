import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import * as service from '../services/inspector-broadcast.service'

function callerFrom(req: AuthRequest) {
  return { profileId: req.profile?.id, role: req.profile?.role, schoolId: req.profile?.school_id }
}

function handleError(res: Response, error: any) {
  const msg = error?.message || 'Unexpected error'
  const status =
    msg.includes('Access denied') || msg.includes('Can only') ? 403 :
    msg.includes('not found') ? 404 :
    msg.includes('required') ? 400 :
    500
  return res.status(status).json({ success: false, error: msg })
}

export const createBroadcast = async (req: AuthRequest, res: Response) => {
  try {
    const data = await service.createBroadcast(callerFrom(req) as any, req.body)
    return res.status(201).json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export const listBroadcastsForSchool = async (req: AuthRequest, res: Response) => {
  try {
    const data = await service.listBroadcastsForSchool(callerFrom(req) as any, req.params.schoolId)
    return res.json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export const listMyBroadcasts = async (req: AuthRequest, res: Response) => {
  try {
    const inspectorProfileId = req.profile?.id
    if (!inspectorProfileId) return res.status(401).json({ success: false, error: 'Unauthorized' })
    const data = await service.listMyBroadcasts(inspectorProfileId)
    return res.json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export const deleteBroadcast = async (req: AuthRequest, res: Response) => {
  try {
    await service.deleteBroadcast(callerFrom(req) as any, req.params.id)
    return res.json({ success: true })
  } catch (error: any) {
    return handleError(res, error)
  }
}
