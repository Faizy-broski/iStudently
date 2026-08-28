import { Response } from 'express'
import { AuthRequest } from '../../middlewares/auth.middleware'
import * as albumService from '../../services/fina/album.service'
import { callerFromFinaRequest as callerFrom } from '../../utils/fina-caller'

function handleError(res: Response, error: any) {
  const msg = error?.message || 'Unexpected error'
  const status =
    msg.includes('Access denied') ? 403 :
    msg.includes('not found') ? 404 :
    msg.includes('required') ? 400 :
    500
  return res.status(status).json({ success: false, error: msg })
}

export const createAlbum = async (req: AuthRequest, res: Response) => {
  try {
    const data = await albumService.createAlbum(await callerFrom(req), {
      title: req.body?.title,
      activityDate: req.body?.activity_date,
      sectionId: req.body?.section_id,
    })
    return res.status(201).json({ success: true, data })
  } catch (error: any) { return handleError(res, error) }
}

export const listAlbums = async (req: AuthRequest, res: Response) => {
  try {
    const data = await albumService.listAlbums(await callerFrom(req))
    return res.json({ success: true, data })
  } catch (error: any) { return handleError(res, error) }
}

export const getAlbumDetail = async (req: AuthRequest, res: Response) => {
  try {
    const data = await albumService.getAlbumDetail(await callerFrom(req), req.params.id)
    return res.json({ success: true, data })
  } catch (error: any) { return handleError(res, error) }
}
