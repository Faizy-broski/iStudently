import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import * as service from '../services/inspection-forum.service'

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

export const createThread = async (req: AuthRequest, res: Response) => {
  try {
    const data = await service.createThread(callerFrom(req) as any, req.body)
    return res.status(201).json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export const listThreadsForSchool = async (req: AuthRequest, res: Response) => {
  try {
    const data = await service.listThreadsForSchool(callerFrom(req) as any, req.params.schoolId)
    return res.json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export const getThread = async (req: AuthRequest, res: Response) => {
  try {
    const data = await service.getThread(callerFrom(req) as any, req.params.id)
    return res.json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export const addPost = async (req: AuthRequest, res: Response) => {
  try {
    const data = await service.addPost(callerFrom(req) as any, req.params.id, req.body?.body)
    return res.status(201).json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}
