import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import * as service from '../services/inspection-appeal.service'

function callerFrom(req: AuthRequest) {
  return { profileId: req.profile?.id, role: req.profile?.role, schoolId: req.profile?.school_id }
}

function handleError(res: Response, error: any) {
  const msg = error?.message || 'Unexpected error'
  const status =
    msg.includes('Access denied') ? 403 :
    msg.includes('not found') ? 404 :
    msg.includes('required') || msg.includes('Cannot ') || msg.includes('already open') ? 400 :
    500
  return res.status(status).json({ success: false, error: msg })
}

export const createAppeal = async (req: AuthRequest, res: Response) => {
  try {
    const { evaluation_id, reason } = req.body
    if (!evaluation_id) return res.status(400).json({ success: false, error: 'evaluation_id is required' })
    const data = await service.createAppeal(callerFrom(req) as any, evaluation_id, reason)
    return res.status(201).json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export const getAppeal = async (req: AuthRequest, res: Response) => {
  try {
    const data = await service.getAppeal(callerFrom(req) as any, req.params.id)
    return res.json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export const listAppealsForTeacher = async (req: AuthRequest, res: Response) => {
  try {
    const teacherProfileId = req.profile?.id
    if (!teacherProfileId) return res.status(401).json({ success: false, error: 'Unauthorized' })
    const data = await service.listAppealsForTeacher(teacherProfileId)
    return res.json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export const listAppealsAssignedToMe = async (req: AuthRequest, res: Response) => {
  try {
    const data = await service.listAppealsAssignedToMe(callerFrom(req) as any)
    return res.json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export const listAppealsForSchool = async (req: AuthRequest, res: Response) => {
  try {
    const data = await service.listAppealsForSchool(callerFrom(req) as any, req.params.schoolId)
    return res.json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export const addComment = async (req: AuthRequest, res: Response) => {
  try {
    const { body, is_internal_note } = req.body
    const data = await service.addComment(callerFrom(req) as any, req.params.id, body, is_internal_note)
    return res.status(201).json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export const updateStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { status, resolution_note } = req.body
    const data = await service.updateStatus(callerFrom(req) as any, req.params.id, status, resolution_note)
    return res.json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export const withdrawAppeal = async (req: AuthRequest, res: Response) => {
  try {
    const data = await service.withdrawAppeal(callerFrom(req) as any, req.params.id)
    return res.json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export const escalateAppeal = async (req: AuthRequest, res: Response) => {
  try {
    const { target_profile_id, note } = req.body
    const data = await service.escalateAppeal(callerFrom(req) as any, req.params.id, target_profile_id, note)
    return res.json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export const listEscalationTargets = async (req: AuthRequest, res: Response) => {
  try {
    const data = await service.listEscalationTargets(callerFrom(req) as any, req.params.schoolId)
    return res.json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}
