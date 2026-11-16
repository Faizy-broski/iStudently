import { supabase } from '../../config/supabase'
import { Response } from 'express'
import { AuthRequest } from '../../middlewares/auth.middleware'
import { hifziAttendanceService } from '../../services/hifzi/attendance.service'
import { assertCanAccessStudent, assertCanAccessCircle } from '../../utils/hifzi-access'

function handleError(res: Response, error: any) {
  const msg = error?.message || 'Unexpected error'
  return res.status(500).json({ success: false, error: msg })
}

export const markAttendance = async (req: AuthRequest, res: Response) => {
  try {
    if (!(await assertCanAccessCircle(req, req.body.circle_id))) {
      return res.status(403).json({ success: false, error: 'Forbidden' })
    }
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
    if (!(await assertCanAccessCircle(req, req.query.circle_id as string))) {
      return res.status(403).json({ success: false, error: 'Forbidden' })
    }
    const data = await hifziAttendanceService.getForCircleAndDate(req.query.circle_id as string, req.query.date as string)
    return res.json({ success: true, data })
  } catch (error: any) { return handleError(res, error) }
}

export const createLeaveRequest = async (req: AuthRequest, res: Response) => {
  try {
    if (!(await assertCanAccessStudent(req, req.body.student_id))) {
      return res.status(403).json({ success: false, error: 'Forbidden' })
    }
    const { circle_id, start_date, end_date } = req.body
    const isDate = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v))
    if (typeof circle_id !== 'string' || !isDate(start_date) || !isDate(end_date) || start_date > end_date) {
      return res.status(400).json({ success: false, error: 'circle_id and a valid date range are required' })
    }
    // Students and parents may only file leave into a circle the student is actively enrolled in.
    if (req.profile.role === 'parent' || req.profile.role === 'student') {
      const { data: enrolment } = await supabase
        .from('hifzi_enrollments')
        .select('id')
        .eq('student_id', req.body.student_id)
        .eq('circle_id', circle_id)
        .eq('status', 'active')
        .limit(1)
      if (!enrolment?.length) return res.status(403).json({ success: false, error: 'Forbidden' })
    }
    const data = await hifziAttendanceService.createLeaveRequest(req.body.student_id, req.body.circle_id, req.body.start_date, req.body.end_date, req.body.reason, req.profile.id)
    return res.status(201).json({ success: true, data })
  } catch (error: any) { return handleError(res, error) }
}
