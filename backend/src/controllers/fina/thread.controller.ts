import { Response } from 'express'
import { AuthRequest } from '../../middlewares/auth.middleware'
import * as service from '../../services/fina/threads.service'
import { callerFromFinaRequest as callerFrom } from '../../utils/fina-caller'

function handleError(res: Response, error: any) {
  const msg = error?.message || 'Unexpected error'
  const status = msg.includes('Access denied') ? 403 : msg.includes('not found') ? 404 : msg.includes('required') ? 400 : 500
  return res.status(status).json({ success: false, error: msg })
}

export const listMyWardsForThreads = async (req: AuthRequest, res: Response) => {
  try {
    const data = await service.listMyWardsForThreads(await callerFrom(req))
    return res.json({ success: true, data })
  } catch (error: any) { return handleError(res, error) }
}

export const listMyStudentsForThreads = async (req: AuthRequest, res: Response) => {
  try {
    const data = await service.listMyStudentsForThreads(await callerFrom(req))
    return res.json({ success: true, data })
  } catch (error: any) { return handleError(res, error) }
}

export const listContactsForStudent = async (req: AuthRequest, res: Response) => {
  try {
    const data = await service.listContactsForStudent(await callerFrom(req), req.params.studentId)
    return res.json({ success: true, data })
  } catch (error: any) { return handleError(res, error) }
}

export const getOrCreateThread = async (req: AuthRequest, res: Response) => {
  try {
    const data = await service.getOrCreateThread(await callerFrom(req), {
      teacherProfileId: req.body?.teacher_profile_id,
      guardianProfileId: req.body?.guardian_profile_id,
      studentId: req.body?.student_id,
    })
    return res.status(201).json({ success: true, data })
  } catch (error: any) { return handleError(res, error) }
}

export const listMyThreads = async (req: AuthRequest, res: Response) => {
  try {
    const data = await service.listMyThreads(await callerFrom(req))
    return res.json({ success: true, data })
  } catch (error: any) { return handleError(res, error) }
}

export const listMessages = async (req: AuthRequest, res: Response) => {
  try {
    const data = await service.listMessages(await callerFrom(req), req.params.id)
    return res.json({ success: true, data })
  } catch (error: any) { return handleError(res, error) }
}

export const sendMessage = async (req: AuthRequest, res: Response) => {
  try {
    const data = await service.sendMessage(await callerFrom(req), req.params.id, req.body?.body)
    return res.status(201).json({ success: true, data })
  } catch (error: any) { return handleError(res, error) }
}
