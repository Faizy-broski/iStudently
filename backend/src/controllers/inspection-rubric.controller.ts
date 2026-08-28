import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import * as service from '../services/inspection-rubric.service'

function callerFrom(req: AuthRequest) {
  return { profileId: req.profile?.id, role: req.profile?.role, schoolId: req.profile?.school_id }
}

function handleError(res: Response, error: any) {
  const msg = error?.message || 'Unexpected error'
  const status =
    msg.includes('Access denied') ? 403 :
    msg.includes('not found') || msg.includes('no longer exists') ? 404 :
    msg.includes('required') || msg.includes('Cannot delete') ? 400 :
    500
  return res.status(status).json({ success: false, error: msg })
}

export const getActiveRubric = async (req: AuthRequest, res: Response) => {
  try {
    const data = await service.getActiveRubric(callerFrom(req) as any)
    return res.json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export const ensureDefaultTemplate = async (req: AuthRequest, res: Response) => {
  try {
    const data = await service.ensureDefaultTemplate(callerFrom(req) as any)
    return res.json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export const createCategory = async (req: AuthRequest, res: Response) => {
  try {
    const data = await service.createCategory(callerFrom(req) as any, req.params.templateId, req.body)
    return res.status(201).json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export const updateCategory = async (req: AuthRequest, res: Response) => {
  try {
    const data = await service.updateCategory(callerFrom(req) as any, req.params.id, req.body)
    return res.json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export const deleteCategory = async (req: AuthRequest, res: Response) => {
  try {
    await service.deleteCategory(callerFrom(req) as any, req.params.id)
    return res.json({ success: true })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export const createCriterion = async (req: AuthRequest, res: Response) => {
  try {
    const data = await service.createCriterion(callerFrom(req) as any, req.params.categoryId, req.body)
    return res.status(201).json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export const updateCriterion = async (req: AuthRequest, res: Response) => {
  try {
    const data = await service.updateCriterion(callerFrom(req) as any, req.params.id, req.body)
    return res.json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export const deleteCriterion = async (req: AuthRequest, res: Response) => {
  try {
    await service.deleteCriterion(callerFrom(req) as any, req.params.id)
    return res.json({ success: true })
  } catch (error: any) {
    return handleError(res, error)
  }
}
