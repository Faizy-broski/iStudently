import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import * as svc from '../services/online-class.service'
import { resolveSchoolId, validateCampusAccess } from '../utils/campus-validation'

const ok = (res: Response, data: unknown) => res.json({ data, error: null })
const err = (res: Response, e: unknown, status = 500) =>
  res.status(status).json({ data: null, error: (e as Error).message || 'Server error' })

const callerFromProfile = (profile: any) => ({
  profileId: profile?.id,
  role: profile?.role,
  schoolId: profile?.school_id,
})

// ============================================================================
// TEACHER
// ============================================================================

export const submitRequest = async (req: AuthRequest, res: Response) => {
  try {
    const profile = req.profile
    ok(res, await svc.submitRequest({
      school_id: profile.school_id,
      // Not auto-set for the 'admin' role (only resolved for teacher/staff
      // from their staff record) — same caveat as jitsi-room.controller.ts.
      // Falls back to school_id itself when no campus_id is resolvable at
      // all (a single-campus account's "campus" is reasonably its school) —
      // the service layer still rejects the request cleanly if even that's
      // missing, rather than hitting a raw DB error.
      campus_id: req.body.campus_id || profile.campus_id || profile.school_id,
      teacher_profile_id: profile.id,
      class_type: req.body.class_type,
      course_period_id: req.body.course_period_id,
      title: req.body.title,
      description: req.body.description,
      student_capacity: req.body.student_capacity,
      scheduled_days: req.body.scheduled_days,
      session_start_time: req.body.session_start_time,
      session_end_time: req.body.session_end_time,
      start_date: req.body.start_date,
      end_date: req.body.end_date,
    }))
  } catch (e) { err(res, e, 400) }
}

export const listMyRequests = async (req: AuthRequest, res: Response) => {
  try { ok(res, await svc.listMyRequests(req.profile!.id)) }
  catch (e) { err(res, e) }
}

export const cancelMyRequest = async (req: AuthRequest, res: Response) => {
  try {
    await svc.cancelMyRequest(req.params.id, callerFromProfile(req.profile))
    ok(res, null)
  } catch (e) { err(res, e, 400) }
}

export const startSession = async (req: AuthRequest, res: Response) => {
  try { ok(res, await svc.startSession(req.params.id, callerFromProfile(req.profile))) }
  catch (e) { err(res, e, 400) }
}

// ============================================================================
// ADMIN
// ============================================================================

export const listPendingForReview = async (req: AuthRequest, res: Response) => {
  try {
    const { schoolId, error, status } = await resolveSchoolId(req, req.query.school_id as string | undefined)
    if (error || !schoolId) return err(res, new Error(error || 'Unable to resolve school'), status || 403)

    const campusId = req.query.campus_id as string | undefined
    if (campusId && req.profile?.role !== 'super_admin') {
      const hasAccess = await validateCampusAccess(req.profile!.school_id!, campusId)
      if (!hasAccess) return err(res, new Error('Forbidden: campus_id does not match your account'), 403)
    }

    ok(res, await svc.listPendingForReview(schoolId, campusId))
  } catch (e) { err(res, e) }
}

export const approveRequest = async (req: AuthRequest, res: Response) => {
  try {
    ok(res, await svc.approveRequest(req.params.id, callerFromProfile(req.profile), req.body.note))
  } catch (e) { err(res, e, 400) }
}

export const rejectRequest = async (req: AuthRequest, res: Response) => {
  try {
    ok(res, await svc.rejectRequest(req.params.id, callerFromProfile(req.profile), req.body.note))
  } catch (e) { err(res, e, 400) }
}

// ============================================================================
// STUDENT
// ============================================================================

export const listOpenCourses = async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = req.profile!.school_id
    if (!schoolId) return err(res, new Error('No school associated with your account'), 403)
    ok(res, await svc.listOpenCourses(schoolId))
  } catch (e) { err(res, e) }
}

export const enroll = async (req: AuthRequest, res: Response) => {
  try { ok(res, await svc.enroll(req.params.id, callerFromProfile(req.profile))) }
  catch (e) { err(res, e, 400) }
}

export const withdraw = async (req: AuthRequest, res: Response) => {
  try {
    await svc.withdraw(req.params.id, callerFromProfile(req.profile))
    ok(res, null)
  } catch (e) { err(res, e, 400) }
}

export const listMyEnrollments = async (req: AuthRequest, res: Response) => {
  try { ok(res, await svc.listMyEnrollments(req.profile!.id)) }
  catch (e) { err(res, e) }
}
