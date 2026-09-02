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

export const enrollStudentsBulk = async (req: AuthRequest, res: Response) => {
  try {
    const circleId = req.body.circle_id
    const studentIds: string[] = Array.isArray(req.body.student_ids) ? req.body.student_ids : []
    if (!circleId) return res.status(400).json({ success: false, error: 'circle_id is required' })
    if (studentIds.length === 0) return res.status(400).json({ success: false, error: 'student_ids array is required and must not be empty' })
    // A halaqah roster, not a whole-school import — smaller than the
    // general students bulk-import's 500-row cap.
    if (studentIds.length > 200) return res.status(400).json({ success: false, error: 'Maximum 200 students per bulk enrollment' })

    const data = await hifziEnrollmentsService.enrollBulk(circleId, studentIds)
    return res.status(200).json({ success: true, data, message: `Enrolled ${data.success_count} student(s) with ${data.error_count} error(s)` })
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
    if (!(await assertCanAccessStudent(req, req.params.id))) {
      return res.status(403).json({ success: false, error: 'Forbidden' })
    }
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
    if (!(await assertCanAccessStudent(req, req.params.id))) {
      return res.status(403).json({ success: false, error: 'Forbidden' })
    }
    const data = await hifziStudentProfilesService.addNote(req.params.id, req.profile.id, req.body.note, req.body.visibility)
    return res.status(201).json({ success: true, data })
  } catch (error: any) { return handleError(res, error) }
}
