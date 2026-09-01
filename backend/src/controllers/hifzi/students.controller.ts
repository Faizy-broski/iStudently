import { Response } from 'express'
import { AuthRequest } from '../../middlewares/auth.middleware'
import { hifziEnrollmentsService, hifziStudentProfilesService } from '../../services/hifzi/student-profiles.service'
import { assertCanAccessStudent } from '../../utils/hifzi-access'

function handleError(res: Response, error: any) {
  const msg = error?.message || 'Unexpected error'
  const status = msg.includes('not found') ? 404 : msg.includes('already') ? 400 : 500
  return res.status(status).json({ success: false, error: msg })
}

export const listEnrollments = async (req: AuthRequest, res: Response) => {
  try {
    const data = await hifziEnrollmentsService.getEnrollments(req.query.circle_id as string)
    return res.json({ success: true, data })
  } catch (error: any) { return handleError(res, error) }
}

export const enrollStudent = async (req: AuthRequest, res: Response) => {
  try {
    const data = await hifziEnrollmentsService.enroll({ circleId: req.body.circle_id, studentId: req.body.student_id })
    return res.status(201).json({ success: true, data })
  } catch (error: any) { return handleError(res, error) }
}

export const withdrawEnrollment = async (req: AuthRequest, res: Response) => {
  try {
    const data = await hifziEnrollmentsService.withdraw(req.params.id)
    return res.json({ success: true, data })
  } catch (error: any) { return handleError(res, error) }
}

export const getStudentProfile = async (req: AuthRequest, res: Response) => {
  try {
    if (!(await assertCanAccessStudent(req, req.params.id))) {
      return res.status(403).json({ success: false, error: 'Forbidden' })
    }
    const data = await hifziStudentProfilesService.getProfile(req.params.id, req.profile.role, req.profile.id)
    return res.json({ success: true, data })
  } catch (error: any) { return handleError(res, error) }
}

export const updateStudentProfile = async (req: AuthRequest, res: Response) => {
  try {
    const data = await hifziStudentProfilesService.updateProfile(req.params.id, {
      riwayahId: req.body.riwayah_id,
      currentJuzTarget: req.body.current_juz_target,
      memorizationStartDate: req.body.memorization_start_date,
      learningNeedsJson: req.body.learning_needs_json,
      notesSummary: req.body.notes_summary,
    })
    return res.json({ success: true, data })
  } catch (error: any) { return handleError(res, error) }
}

export const addStudentNote = async (req: AuthRequest, res: Response) => {
  try {
    const data = await hifziStudentProfilesService.addNote(req.params.id, req.profile.id, req.body.note, req.body.visibility)
    return res.status(201).json({ success: true, data })
  } catch (error: any) { return handleError(res, error) }
}
