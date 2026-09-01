import { Response } from 'express'
import { AuthRequest } from '../../middlewares/auth.middleware'
import { hifziAttendanceService } from '../../services/hifzi/attendance.service'

function handleError(res: Response, error: any) {
  const msg = error?.message || 'Unexpected error'
  return res.status(500).json({ success: false, error: msg })
}

export const markAttendance = async (req: AuthRequest, res: Response) => {
  try {
    if (Array.isArray(req.body.entries)) {
      const data = await hifziAttendanceService.markBulk(req.body.circle_id, req.body.session_date, req.body.entries.map((e: any) => ({ studentId: e.student_id, status: e.status })), req.profile.school_id, req.profile.id)
      return res.status(201).json({ success: true, data })
    }
    const data = await hifziAttendanceService.mark({ circleId: req.body.circle_id, studentId: req.body.student_id, sessionDate: req.body.session_date, status: req.body.status, markedBy: req.profile.id }, req.profile.school_id)
    return res.status(201).json({ success: true, data })
  } catch (error: any) { return handleError(res, error) }
}

export const getAttendance = async (req: AuthRequest, res: Response) => {
  try {
    const data = await hifziAttendanceService.getForCircleAndDate(req.query.circle_id as string, req.query.date as string)
    return res.json({ success: true, data })
  } catch (error: any) { return handleError(res, error) }
}

export const createLeaveRequest = async (req: AuthRequest, res: Response) => {
  try {
    const data = await hifziAttendanceService.createLeaveRequest(req.body.student_id, req.body.circle_id, req.body.start_date, req.body.end_date, req.body.reason, req.profile.id)
    return res.status(201).json({ success: true, data })
  } catch (error: any) { return handleError(res, error) }
}
