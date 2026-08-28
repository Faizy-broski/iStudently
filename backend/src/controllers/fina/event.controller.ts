import { Response } from 'express'
import { AuthRequest } from '../../middlewares/auth.middleware'
import * as service from '../../services/fina/events.service'
import { callerFromFinaRequest as callerFrom } from '../../utils/fina-caller'

function handleError(res: Response, error: any) {
  const msg = error?.message || 'Unexpected error'
  const status = msg.includes('Access denied') ? 403 : msg.includes('not found') ? 404 : msg.includes('required') ? 400 : 500
  return res.status(status).json({ success: false, error: msg })
}

export const createEvent = async (req: AuthRequest, res: Response) => {
  try {
    const data = await service.createEvent(await callerFrom(req), {
      title: req.body?.title,
      body: req.body?.body,
      startsAt: req.body?.starts_at,
      location: req.body?.location,
      audienceType: req.body?.audience_type,
      audienceRef: req.body?.audience_ref,
    })
    return res.status(201).json({ success: true, data })
  } catch (error: any) { return handleError(res, error) }
}

export const listEvents = async (req: AuthRequest, res: Response) => {
  try {
    const data = await service.listEvents(await callerFrom(req))
    return res.json({ success: true, data })
  } catch (error: any) { return handleError(res, error) }
}

export const rsvpEvent = async (req: AuthRequest, res: Response) => {
  try {
    const answer = ['yes', 'no', 'maybe'].includes(req.body?.answer) ? req.body.answer : 'maybe'
    const data = await service.rsvpEvent(await callerFrom(req), req.params.id, answer)
    return res.json({ success: true, data })
  } catch (error: any) { return handleError(res, error) }
}
