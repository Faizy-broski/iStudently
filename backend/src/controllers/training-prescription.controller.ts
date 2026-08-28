import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import * as service from '../services/training-prescription.service'

function callerFrom(req: AuthRequest) {
  return { profileId: req.profile?.id, role: req.profile?.role, schoolId: req.profile?.school_id }
}

function handleError(res: Response, error: any) {
  const msg = error?.message || 'Unexpected error'
  const status =
    msg.includes('Access denied') ? 403 :
    msg.includes('not found') ? 404 :
    msg.includes('required') ? 400 :
    500
  return res.status(status).json({ success: false, error: msg })
}

export const createManualPrescription = async (req: AuthRequest, res: Response) => {
  try {
    const data = await service.createManualPrescription(callerFrom(req) as any, req.params.evaluationId, req.body)
    return res.status(201).json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export const listPrescriptionsForEvaluation = async (req: AuthRequest, res: Response) => {
  try {
    const data = await service.listPrescriptionsForEvaluation(callerFrom(req) as any, req.params.evaluationId)
    return res.json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export const listPrescriptionsForSchool = async (req: AuthRequest, res: Response) => {
  try {
    const data = await service.listPrescriptionsForSchool(callerFrom(req) as any, req.params.schoolId)
    return res.json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export const listMyPrescriptions = async (req: AuthRequest, res: Response) => {
  try {
    const teacherProfileId = req.profile?.id
    if (!teacherProfileId) return res.status(401).json({ success: false, error: 'Unauthorized' })
    const data = await service.listMyPrescriptions(teacherProfileId)
    return res.json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export const assignPrescription = async (req: AuthRequest, res: Response) => {
  try {
    const data = await service.assignPrescription(callerFrom(req) as any, req.params.id, req.body?.training_session_id)
    return res.json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export const dismissPrescription = async (req: AuthRequest, res: Response) => {
  try {
    const data = await service.dismissPrescription(callerFrom(req) as any, req.params.id)
    return res.json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export const completePrescription = async (req: AuthRequest, res: Response) => {
  try {
    const data = await service.completePrescription(callerFrom(req) as any, req.params.id)
    return res.json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export const listAvailableTrainingSessions = async (req: AuthRequest, res: Response) => {
  try {
    const data = await service.listAvailableTrainingSessions(callerFrom(req) as any, req.params.schoolId)
    return res.json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}
