import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import * as service from '../services/inspector-directory.service'

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
    msg.includes('required') || msg.includes('is not an inspector') ? 400 :
    500
  return res.status(status).json({ success: false, error: msg })
}

// Admin: inspector accounts
export const listInspectors = async (req: AuthRequest, res: Response) => {
  try {
    const data = await service.listInspectors(callerFrom(req) as any)
    return res.json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export const createInspector = async (req: AuthRequest, res: Response) => {
  try {
    const data = await service.createInspector(callerFrom(req) as any, req.body)
    return res.status(201).json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export const updateInspector = async (req: AuthRequest, res: Response) => {
  try {
    const data = await service.updateInspector(callerFrom(req) as any, req.params.id, req.body)
    return res.json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export const deactivateInspector = async (req: AuthRequest, res: Response) => {
  try {
    const data = await service.setInspectorActive(callerFrom(req) as any, req.params.id, false)
    return res.json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export const reactivateInspector = async (req: AuthRequest, res: Response) => {
  try {
    const data = await service.setInspectorActive(callerFrom(req) as any, req.params.id, true)
    return res.json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export const deleteInspectorPermanently = async (req: AuthRequest, res: Response) => {
  try {
    const data = await service.deleteInspectorPermanently(callerFrom(req) as any, req.params.id)
    return res.json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}

// Admin: campus assignments
export const assignCampus = async (req: AuthRequest, res: Response) => {
  try {
    const data = await service.assignCampus(callerFrom(req) as any, req.body)
    return res.status(201).json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export const unassignCampus = async (req: AuthRequest, res: Response) => {
  try {
    const data = await service.unassignCampus(callerFrom(req) as any, req.params.id)
    return res.json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export const listAssignmentsForInspector = async (req: AuthRequest, res: Response) => {
  try {
    const data = await service.listAssignmentsForInspector(callerFrom(req) as any, req.params.inspectorId)
    return res.json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}

// Inspector: own portal
export const getMyAssignedSchools = async (req: AuthRequest, res: Response) => {
  try {
    const inspectorProfileId = req.profile?.id
    if (!inspectorProfileId) return res.status(401).json({ success: false, error: 'Unauthorized' })
    const data = await service.getMyAssignedSchools(inspectorProfileId)
    return res.json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}
