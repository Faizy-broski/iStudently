import { Response } from 'express'
import { AuthRequest } from '../../middlewares/auth.middleware'
import { hifziHeatmapService } from '../../services/hifzi/heatmap.service'
import { generateReportCard } from '../../services/hifzi/report-card.service'
import { assertCanAccessStudent } from '../../utils/hifzi-access'

function handleError(res: Response, error: any) {
  return res.status(500).json({ success: false, error: error?.message || 'Unexpected error' })
}

export const getHeatmap = async (req: AuthRequest, res: Response) => {
  try {
    if (!(await assertCanAccessStudent(req, req.params.id))) {
      return res.status(403).json({ success: false, error: 'Forbidden' })
    }
    const data = await hifziHeatmapService.getStudentHeatmap(req.params.id, req.profile.school_id, req.profile.campus_id)
    return res.json({ success: true, data })
  } catch (error: any) { return handleError(res, error) }
}

// Returns the signed URL as JSON rather than a 302 redirect: this endpoint
// sits behind Bearer-token `authenticate` (no cookie session), so a plain
// browser navigation/<a href> to it would carry no Authorization header.
// The frontend calls this via apiRequest() and then opens the returned URL
// itself — same pattern as fina's signed-url minting.
export const getReportCard = async (req: AuthRequest, res: Response) => {
  try {
    if (!(await assertCanAccessStudent(req, req.params.id))) {
      return res.status(403).json({ success: false, error: 'Forbidden' })
    }
    const { signedUrl } = await generateReportCard(req.params.id, req.profile.school_id)
    if (!signedUrl) return res.status(500).json({ success: false, error: 'Failed to generate report card URL' })
    return res.json({ success: true, data: { url: signedUrl } })
  } catch (error: any) { return handleError(res, error) }
}
