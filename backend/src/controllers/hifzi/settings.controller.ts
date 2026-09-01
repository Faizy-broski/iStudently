import { Response } from 'express'
import { AuthRequest } from '../../middlewares/auth.middleware'
import { hifziSettingsService } from '../../services/hifzi/settings.service'

function handleError(res: Response, error: any) {
  const msg = error?.message || 'Unexpected error'
  return res.status(500).json({ success: false, error: msg })
}

export const getSettings = async (req: AuthRequest, res: Response) => {
  try {
    const data = await hifziSettingsService.getEffectiveSettings(req.profile.school_id, req.profile.campus_id)
    return res.json({ success: true, data })
  } catch (error: any) { return handleError(res, error) }
}

export const updateSettings = async (req: AuthRequest, res: Response) => {
  try {
    const data = await hifziSettingsService.upsertSettings(req.profile.school_id, req.profile.campus_id ?? null, req.body)
    return res.json({ success: true, data })
  } catch (error: any) { return handleError(res, error) }
}
