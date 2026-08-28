import { Response } from 'express'
import { AuthRequest } from '../../middlewares/auth.middleware'
import * as service from '../../services/fina/stories.service'
import { callerFromFinaRequest as callerFrom } from '../../utils/fina-caller'

function handleError(res: Response, error: any) {
  const msg = error?.message || 'Unexpected error'
  const status =
    msg.includes('Access denied') ? 403 :
    msg.includes('not found') ? 404 :
    msg.includes('required') || msg.includes('still processing') || msg.includes('cannot be published') ? 400 :
    500
  return res.status(status).json({ success: false, error: msg })
}

export const createStory = async (req: AuthRequest, res: Response) => {
  try {
    const data = await service.createStory(await callerFrom(req), req.body?.media_id)
    return res.status(201).json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export const listActiveStories = async (req: AuthRequest, res: Response) => {
  try {
    const data = await service.listActiveStories(await callerFrom(req))
    return res.json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}
