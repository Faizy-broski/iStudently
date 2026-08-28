import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import * as service from '../services/inspector-teacher-profile.service'

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
    msg.includes('Access denied') ? 403 :
    msg.includes('not found') || msg.includes('not a teacher') ? 404 :
    500
  return res.status(status).json({ success: false, error: msg })
}

export const listTeachersForSchool = async (req: AuthRequest, res: Response) => {
  try {
    const data = await service.listTeachersForSchool(callerFrom(req) as any, req.params.schoolId)
    return res.json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export const listSubjectsForSchool = async (req: AuthRequest, res: Response) => {
  try {
    const data = await service.listSubjectsForSchool(callerFrom(req) as any, req.params.schoolId)
    return res.json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export const getTeacherPortfolio = async (req: AuthRequest, res: Response) => {
  try {
    const data = await service.getTeacherPortfolio(callerFrom(req) as any, req.params.teacherId)
    return res.json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}
