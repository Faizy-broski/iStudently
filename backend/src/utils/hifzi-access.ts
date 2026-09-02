import { supabase } from '../config/supabase'
import { AuthRequest } from '../middlewares/auth.middleware'

/**
 * Self-scoping guard for Hifzi's student-facing read AND write endpoints
 * (sessions, heatmap, report card, plans, student profile, attendance).
 * Mirrors the `req.profile.student_id || req.profile.id` pattern already
 * used by student-dashboard.controller.ts for the student role; extends it
 * to parents by checking parent_student_links (see parent.service.ts's
 * getParentWithChildren for the same table/shape).
 *
 * admin / super_admin are unrestricted. teacher is scoped to students
 * actually enrolled in a circle the teacher is an active
 * (lead/assistant/substitute) teacher of — see isTeacherAssignedToStudent
 * below, previously a private, unreused check duplicated in
 * student-profiles.service.ts's canSeeLearningNeeds (now itself calling
 * this shared export instead of running its own copy of the query).
 */
export async function assertCanAccessStudent(req: AuthRequest, studentId: string): Promise<boolean> {
  const role = req.profile?.role
  if (!studentId) return false

  if (role === 'admin' || role === 'super_admin') return true

  if (role === 'teacher') {
    return isTeacherAssignedToStudent(studentId, req.profile.id)
  }

  if (role === 'student') {
    return (req.profile.student_id || req.profile.id) === studentId
  }

  if (role === 'parent') {
    const { data } = await supabase
      .from('parent_student_links')
      .select('id, parent:parents!inner(profile_id)')
      .eq('student_id', studentId)
      .eq('is_active', true)
      .eq('parent.profile_id', req.profile.id)
      .maybeSingle()
    return !!data
  }

  return false
}

/**
 * Is `teacherProfileId` an active teacher (any role — lead/assistant/
 * substitute) of any circle `studentId` is currently actively enrolled in?
 * Shared by assertCanAccessStudent's teacher branch and
 * student-profiles.service.ts's canSeeLearningNeeds — the single source of
 * truth for this query, do not duplicate it elsewhere.
 *
 * Known limitation, accepted as-is: a teacher who taught a student who has
 * since withdrawn (hifzi_enrollments.status != 'active') loses access to
 * that student's history. Matches this check's pre-existing production
 * behavior for learning_needs_json — not a new restriction.
 */
export async function isTeacherAssignedToStudent(studentId: string, teacherProfileId: string): Promise<boolean> {
  const { data } = await supabase
    .from('hifzi_enrollments')
    .select('circle_id, hifzi_circles!inner(hifzi_circle_teachers!inner(teacher_profile_id, active_to))')
    .eq('student_id', studentId)
    .eq('status', 'active')
    .eq('hifzi_circles.hifzi_circle_teachers.teacher_profile_id', teacherProfileId)
    .is('hifzi_circles.hifzi_circle_teachers.active_to', null)
    .limit(1)

  return !!data && data.length > 0
}

/** Circle-scoped counterpart to isTeacherAssignedToStudent, for endpoints keyed by circle_id rather than a single student_id (attendance). */
export async function isTeacherAssignedToCircle(circleId: string, teacherProfileId: string): Promise<boolean> {
  const { data } = await supabase
    .from('hifzi_circle_teachers')
    .select('id')
    .eq('circle_id', circleId)
    .eq('teacher_profile_id', teacherProfileId)
    .is('active_to', null)
    .limit(1)

  return !!data && data.length > 0
}

/** Circle-scoped counterpart to assertCanAccessStudent. admin/super_admin unrestricted; teacher must be an active hifzi_circle_teachers row for this circle; every other role denied. */
export async function assertCanAccessCircle(req: AuthRequest, circleId: string): Promise<boolean> {
  const role = req.profile?.role
  if (!circleId) return false
  if (role === 'admin' || role === 'super_admin') return true
  if (role !== 'teacher') return false
  return isTeacherAssignedToCircle(circleId, req.profile.id)
}
