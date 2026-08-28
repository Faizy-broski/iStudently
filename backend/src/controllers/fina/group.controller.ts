import { Response } from 'express'
import { AuthRequest } from '../../middlewares/auth.middleware'
import * as service from '../../services/fina/groups.service'
import { callerFromFinaRequest as callerFrom } from '../../utils/fina-caller'

function handleError(res: Response, error: any) {
  const msg = error?.message || 'Unexpected error'
  const status = msg.includes('Access denied') ? 403 : msg.includes('not found') ? 404 : msg.includes('required') || msg.includes('cannot leave') ? 400 : 500
  return res.status(status).json({ success: false, error: msg })
}

export const createGroup = async (req: AuthRequest, res: Response) => {
  try {
    const data = await service.createGroup(await callerFrom(req), { name: req.body?.name, type: req.body?.type, sectionId: req.body?.section_id })
    return res.status(201).json({ success: true, data })
  } catch (error: any) { return handleError(res, error) }
}

export const listGroups = async (req: AuthRequest, res: Response) => {
  try {
    const data = await service.listGroups(await callerFrom(req))
    return res.json({ success: true, data })
  } catch (error: any) { return handleError(res, error) }
}

export const joinGroup = async (req: AuthRequest, res: Response) => {
  try {
    await service.joinGroup(await callerFrom(req), req.params.id)
    return res.json({ success: true })
  } catch (error: any) { return handleError(res, error) }
}

export const leaveGroup = async (req: AuthRequest, res: Response) => {
  try {
    await service.leaveGroup(await callerFrom(req), req.params.id)
    return res.json({ success: true })
  } catch (error: any) { return handleError(res, error) }
}

export const listGroupMembers = async (req: AuthRequest, res: Response) => {
  try {
    const data = await service.listGroupMembers(await callerFrom(req), req.params.id)
    return res.json({ success: true, data })
  } catch (error: any) { return handleError(res, error) }
}
