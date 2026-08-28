import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import * as service from '../services/inspection-coaching.service'

function callerFrom(req: AuthRequest) {
  return { profileId: req.profile?.id, role: req.profile?.role, schoolId: req.profile?.school_id }
}

function handleError(res: Response, error: any) {
  const msg = error?.message || 'Unexpected error'
  const status =
    msg.includes('Access denied') ? 403 :
    msg.includes('not found') ? 404 :
    msg.includes('required') || msg.includes('Invalid') ? 400 :
    500
  return res.status(status).json({ success: false, error: msg })
}

export const listNotes = async (req: AuthRequest, res: Response) => {
  try {
    const data = await service.listNotes(callerFrom(req) as any, req.params.evaluationId)
    return res.json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export const addNote = async (req: AuthRequest, res: Response) => {
  try {
    const data = await service.addNote(callerFrom(req) as any, req.params.evaluationId, req.body)
    return res.status(201).json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export const updateNote = async (req: AuthRequest, res: Response) => {
  try {
    const data = await service.updateNote(callerFrom(req) as any, req.params.id, req.body)
    return res.json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export const deleteNote = async (req: AuthRequest, res: Response) => {
  try {
    await service.deleteNote(callerFrom(req) as any, req.params.id)
    return res.json({ success: true })
  } catch (error: any) {
    return handleError(res, error)
  }
}
