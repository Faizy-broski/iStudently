import { Response } from 'express'
import { AuthRequest } from '../../middlewares/auth.middleware'
import { hifziComplianceDashboardService } from '../../services/hifzi/compliance-dashboard.service'
import { hifziMilestonesService } from '../../services/hifzi/milestones.service'
import { assertCanAccessStudent } from '../../utils/hifzi-access'

function handleError(res: Response, error: any) {
  const msg = error?.message || 'Unexpected error'
  const status = msg.includes('Access denied') ? 403 : 500
  return res.status(status).json({ success: false, error: msg })
}

// Mirrors inspection-analytics.controller.ts's pattern: role authorization
// lives inside the service (getInspectorComplianceDashboard/
// getSchoolComplianceDashboard), this controller just builds the
// CallerContext and delegates.
export const getInspectorDashboard = async (req: AuthRequest, res: Response) => {
  try {
    const academicYearId = req.query.academic_year_id as string
    const data = await hifziComplianceDashboardService.getInspectorComplianceDashboard(
      { profileId: req.profile.id, role: req.profile.role, schoolId: req.profile.school_id },
      academicYearId
    )
    return res.json({ success: true, data })
  } catch (error: any) { return handleError(res, error) }
}

export const getSchoolDashboard = async (req: AuthRequest, res: Response) => {
  try {
    const academicYearId = req.query.academic_year_id as string
    const data = await hifziComplianceDashboardService.getSchoolComplianceDashboard(
      { profileId: req.profile.id, role: req.profile.role, schoolId: req.profile.school_id },
      req.params.schoolId,
      academicYearId
    )
    return res.json({ success: true, data })
  } catch (error: any) { return handleError(res, error) }
}

export const getMilestonesForStudent = async (req: AuthRequest, res: Response) => {
  try {
    const studentId = req.query.student_id as string
    if (!(await assertCanAccessStudent(req, studentId))) {
      return res.status(403).json({ success: false, error: 'Forbidden' })
    }
    const data = await hifziMilestonesService.listMilestonesForStudent(studentId)
    return res.json({ success: true, data })
  } catch (error: any) { return handleError(res, error) }
}
