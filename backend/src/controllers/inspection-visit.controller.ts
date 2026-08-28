import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import * as service from '../services/inspection-visit.service'

function callerFrom(req: AuthRequest) {
  return {
    profileId: req.profile?.id,
    role: req.profile?.role,
    schoolId: req.profile?.school_id,
  }
}

function handleError(res: Response, error: any) {
  const msg = error?.message || 'Unexpected error'
  const status =
    msg.includes('Access denied') || msg.includes('Forbidden') ? 403 :
    msg.includes('not found') ? 404 :
    msg.includes('required') || msg.includes('Cannot ') || msg.includes('already has an inspection') ? 400 :
    500
  return res.status(status).json({ success: false, error: msg })
}

export const createVisit = async (req: AuthRequest, res: Response) => {
  try {
    const data = await service.createVisit(callerFrom(req) as any, req.body)
    return res.status(201).json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export const confirmVisit = async (req: AuthRequest, res: Response) => {
  try {
    const data = await service.confirmVisit(callerFrom(req) as any, req.params.id)
    return res.json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export const checkInVisit = async (req: AuthRequest, res: Response) => {
  try {
    const data = await service.checkInVisit(callerFrom(req) as any, req.params.id)
    return res.json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export const completeVisit = async (req: AuthRequest, res: Response) => {
  try {
    const data = await service.completeVisit(callerFrom(req) as any, req.params.id)
    return res.json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export const cancelVisit = async (req: AuthRequest, res: Response) => {
  try {
    const data = await service.cancelVisit(callerFrom(req) as any, req.params.id, req.body?.reason)
    return res.json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export const rescheduleVisit = async (req: AuthRequest, res: Response) => {
  try {
    const data = await service.rescheduleVisit(callerFrom(req) as any, req.params.id, req.body)
    return res.status(201).json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export const getVisit = async (req: AuthRequest, res: Response) => {
  try {
    const data = await service.getVisit(callerFrom(req) as any, req.params.id)
    return res.json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export const listMyVisits = async (req: AuthRequest, res: Response) => {
  try {
    const data = await service.listMyVisits(callerFrom(req) as any, req.query as any)
    return res.json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export const listVisitsForSchool = async (req: AuthRequest, res: Response) => {
  try {
    const data = await service.listVisitsForSchool(callerFrom(req) as any, req.params.schoolId, req.query as any)
    return res.json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export const listVisitsForTeacher = async (req: AuthRequest, res: Response) => {
  try {
    const teacherProfileId = req.profile?.id
    if (!teacherProfileId) return res.status(401).json({ success: false, error: 'Unauthorized' })
    const data = await service.listVisitsForTeacher(teacherProfileId)
    return res.json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export const setVisitTeachers = async (req: AuthRequest, res: Response) => {
  try {
    const data = await service.setVisitTeachers(callerFrom(req) as any, req.params.id, req.body?.teachers || [])
    return res.json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}
