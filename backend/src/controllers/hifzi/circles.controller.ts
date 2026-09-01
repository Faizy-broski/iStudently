import { Response } from 'express'
import { AuthRequest } from '../../middlewares/auth.middleware'
import { circlesService } from '../../services/hifzi/circles.service'

function handleErrorStatus(error: any): number {
  const msg = error?.message || 'Unexpected error'
  return msg.includes('not found') ? 404 : msg.includes('must') || msg.includes('already') ? 400 : 500
}

function handleError(res: Response, error: any) {
  return res.status(handleErrorStatus(error)).json({ success: false, error: error?.message || 'Unexpected error' })
}

/** campus_id resolution: req.profile.campus_id is only auto-populated for
 * campus-FIXED roles (teacher/student/parent/staff/librarian). Admin (and
 * super_admin) pass campus_id explicitly per-request instead, tied to
 * whichever campus is selected in the frontend's CampusContext — same
 * convention as hifzi-enabled.middleware.ts and every other campus-aware
 * controller in this codebase. */
function resolveCampusId(req: AuthRequest): string | undefined {
  return (req.query.campus_id as string | undefined) || req.body?.campus_id || req.profile?.campus_id
}

export const listCircles = async (req: AuthRequest, res: Response) => {
  try {
    const data = await circlesService.getCircles(req.profile.school_id, req.profile.role, resolveCampusId(req))
    return res.json({ success: true, data })
  } catch (error: any) { return handleError(res, error) }
}

export const getCircle = async (req: AuthRequest, res: Response) => {
  try {
    const data = await circlesService.getCircleById(req.params.id, req.profile.school_id, resolveCampusId(req))
    return res.json({ success: true, data })
  } catch (error: any) { return handleError(res, error) }
}

export const createCircle = async (req: AuthRequest, res: Response) => {
  try {
    const data = await circlesService.createCircle(
      { nameAr: req.body.name_ar, nameEn: req.body.name_en, riwayahId: req.body.riwayah_id, sectionGender: req.body.section_gender, circleType: req.body.circle_type, capacity: req.body.capacity },
      req.profile.school_id,
      req.profile.id,
      resolveCampusId(req)
    )
    return res.status(201).json({ success: true, data })
  } catch (error: any) { return handleError(res, error) }
}

export const updateCircle = async (req: AuthRequest, res: Response) => {
  try {
    const data = await circlesService.updateCircle(req.params.id, req.profile.school_id, {
      nameAr: req.body.name_ar,
      nameEn: req.body.name_en,
      riwayahId: req.body.riwayah_id,
      sectionGender: req.body.section_gender,
      circleType: req.body.circle_type,
      capacity: req.body.capacity,
      isActive: req.body.is_active,
    }, resolveCampusId(req))
    return res.json({ success: true, data })
  } catch (error: any) { return handleError(res, error) }
}

export const addTeacher = async (req: AuthRequest, res: Response) => {
  try {
    const data = await circlesService.addTeacher(req.params.id, req.body.teacher_profile_id, req.body.role)
    return res.status(201).json({ success: true, data })
  } catch (error: any) { return handleError(res, error) }
}

export const removeTeacher = async (req: AuthRequest, res: Response) => {
  try {
    const data = await circlesService.removeTeacher(req.params.id, req.params.teacherProfileId)
    return res.json({ success: true, data })
  } catch (error: any) { return handleError(res, error) }
}

export const addSchedule = async (req: AuthRequest, res: Response) => {
  try {
    const data = await circlesService.addSchedule(req.params.id, {
      dayOfWeek: req.body.day_of_week,
      startTime: req.body.start_time,
      endTime: req.body.end_time,
      location: req.body.location,
    })
    return res.status(201).json({ success: true, data })
  } catch (error: any) { return handleError(res, error) }
}

export const getScheduleConflicts = async (req: AuthRequest, res: Response) => {
  try {
    const data = await circlesService.getScheduleConflicts(req.params.id, req.profile.school_id, {
      dayOfWeek: Number(req.query.day_of_week),
      startTime: req.query.start_time as string,
      endTime: req.query.end_time as string,
    })
    return res.json({ success: true, data })
  } catch (error: any) { return handleError(res, error) }
}
