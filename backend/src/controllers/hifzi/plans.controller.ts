import { Response } from 'express'
import { AuthRequest } from '../../middlewares/auth.middleware'
import { hifziPlansService } from '../../services/hifzi/plans.service'
import { assertCanAccessStudent } from '../../utils/hifzi-access'

function handleError(res: Response, error: any) {
  const msg = error?.message || 'Unexpected error'
  return res.status(msg.includes('not found') ? 404 : 500).json({ success: false, error: msg })
}

export const createPlan = async (req: AuthRequest, res: Response) => {
  try {
    // Same campus_id resolution as circles.controller.ts's resolveCampusId —
    // req.profile.school_id alone is the PARENT org for an admin, but
    // students (and hifzi_circles) live under the campus id, so an explicit
    // campus_id must win when the caller sends one.
    const schoolId = (req.body.campus_id as string | undefined) || req.profile?.campus_id || req.profile.school_id
    const data = await hifziPlansService.createPlan(
      {
        studentId: req.body.student_id,
        circleId: req.body.circle_id,
        planType: req.body.plan_type,
        riwayahId: req.body.riwayah_id,
        targetStartAyahId: req.body.target_start_ayah_id,
        targetEndAyahId: req.body.target_end_ayah_id,
        dailyNewAyatTarget: req.body.daily_new_ayat_target,
      },
      schoolId,
      req.profile.id
    )
    return res.status(201).json({ success: true, data })
  } catch (error: any) { return handleError(res, error) }
}

export const updatePlan = async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = (req.body.campus_id as string | undefined) || req.profile?.campus_id || req.profile.school_id
    const data = await hifziPlansService.updatePlan(req.params.id, schoolId, {
      circleId: req.body.circle_id,
      planType: req.body.plan_type,
      riwayahId: req.body.riwayah_id,
      targetStartAyahId: req.body.target_start_ayah_id,
      targetEndAyahId: req.body.target_end_ayah_id,
      dailyNewAyatTarget: req.body.daily_new_ayat_target,
    })
    return res.json({ success: true, data })
  } catch (error: any) { return handleError(res, error) }
}

export const deactivatePlan = async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = (req.query.campus_id as string | undefined) || req.profile?.campus_id || req.profile.school_id
    const data = await hifziPlansService.deactivatePlan(req.params.id, schoolId)
    return res.json({ success: true, data })
  } catch (error: any) { return handleError(res, error) }
}

export const listPlans = async (req: AuthRequest, res: Response) => {
  try {
    const studentId = req.query.student_id as string
    if (!(await assertCanAccessStudent(req, studentId))) {
      return res.status(403).json({ success: false, error: 'Forbidden' })
    }
    const data = await hifziPlansService.getPlansForStudent(studentId)
    return res.json({ success: true, data })
  } catch (error: any) { return handleError(res, error) }
}

export const getAssignment = async (req: AuthRequest, res: Response) => {
  try {
    const studentId = req.query.student_id as string
    if (!(await assertCanAccessStudent(req, studentId))) {
      return res.status(403).json({ success: false, error: 'Forbidden' })
    }
    const date = (req.query.date as string) || new Date().toISOString().slice(0, 10)
    const data = await hifziPlansService.getAssignmentForStudent(studentId, date)
    return res.json({ success: true, data })
  } catch (error: any) { return handleError(res, error) }
}

export const generateAssignment = async (req: AuthRequest, res: Response) => {
  try {
    const date = req.body.date || new Date().toISOString().slice(0, 10)
    const data = await hifziPlansService.generateDailyAssignmentForStudent(req.body.student_id, date, req.profile.school_id, req.profile.campus_id)
    return res.json({ success: true, data })
  } catch (error: any) { return handleError(res, error) }
}
