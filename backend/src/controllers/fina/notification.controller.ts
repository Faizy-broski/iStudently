import { Response } from 'express'
import { AuthRequest } from '../../middlewares/auth.middleware'
import * as service from '../../services/fina/notifications.service'
import { callerFromFinaRequest as callerFrom } from '../../utils/fina-caller'

function handleError(res: Response, error: any) {
  const msg = error?.message || 'Unexpected error'
  const status = msg.includes('not found') ? 404 : 500
  return res.status(status).json({ success: false, error: msg })
}

export const listMyNotifications = async (req: AuthRequest, res: Response) => {
  try {
    const data = await service.listMyNotifications(await callerFrom(req))
    return res.json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export const countUnread = async (req: AuthRequest, res: Response) => {
  try {
    const count = await service.countUnreadNotifications(await callerFrom(req))
    return res.json({ success: true, data: { count } })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export const markRead = async (req: AuthRequest, res: Response) => {
  try {
    const data = await service.markNotificationRead(await callerFrom(req), req.params.id)
    return res.json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export const markAllRead = async (req: AuthRequest, res: Response) => {
  try {
    await service.markAllNotificationsRead(await callerFrom(req))
    return res.json({ success: true })
  } catch (error: any) {
    return handleError(res, error)
  }
}
