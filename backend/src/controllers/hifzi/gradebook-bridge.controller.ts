import { Response } from 'express'
import { AuthRequest } from '../../middlewares/auth.middleware'
import { hifziGradebookBridgeService } from '../../services/hifzi/gradebook-bridge.service'

function handleError(res: Response, error: any) {
  const msg = error?.message || 'Unexpected error'
  const status = msg.includes('not found') ? 404 : msg.includes('must sum') ? 400 : 500
  return res.status(status).json({ success: false, error: msg })
}

// Same campus_id resolution as curriculum.controller.ts's resolveSchoolId —
// Hifzi tenant tables (hifzi_gradebook_links included) key off the campus id.
function resolveSchoolId(req: AuthRequest): string {
  return (req.body.campus_id as string | undefined) || (req.query.campus_id as string | undefined) || req.profile?.campus_id || req.profile.school_id
}

export const linkGradeLevelSubject = async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = resolveSchoolId(req)
    const data = await hifziGradebookBridgeService.linkGradeLevelSubject(schoolId, {
      gradeLevelId: req.body.grade_level_id,
      academicYearId: req.body.academic_year_id,
      subjectId: req.body.subject_id,
      courseId: req.body.course_id,
      caWeightPercent: req.body.ca_weight_percent !== undefined ? Number(req.body.ca_weight_percent) : undefined,
      examWeightPercent: req.body.exam_weight_percent !== undefined ? Number(req.body.exam_weight_percent) : undefined,
      createdBy: req.profile.id,
    })
    return res.status(201).json({ success: true, data })
  } catch (error: any) { return handleError(res, error) }
}

export const getLink = async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = resolveSchoolId(req)
    const data = await hifziGradebookBridgeService.getLink(schoolId, req.query.grade_level_id as string, req.query.academic_year_id as string)
    return res.json({ success: true, data })
  } catch (error: any) { return handleError(res, error) }
}

export const previewTermBridge = async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = resolveSchoolId(req)
    const data = await hifziGradebookBridgeService.previewTermBridge(
      schoolId,
      req.query.grade_level_id as string,
      req.query.academic_year_id as string,
      req.query.marking_period_id as string
    )
    return res.json({ success: true, data })
  } catch (error: any) { return handleError(res, error) }
}

export const runTermBridge = async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = resolveSchoolId(req)
    const data = await hifziGradebookBridgeService.runTermBridge(
      schoolId,
      req.body.grade_level_id,
      req.body.academic_year_id,
      req.body.marking_period_id,
      req.profile.id
    )
    return res.json({ success: true, data })
  } catch (error: any) { return handleError(res, error) }
}
