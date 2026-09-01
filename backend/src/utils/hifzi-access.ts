import { supabase } from '../config/supabase'
import { AuthRequest } from '../middlewares/auth.middleware'

/**
 * Self-scoping guard for Hifzi's student-facing read endpoints (sessions,
 * heatmap, report card, plans, student profile). Mirrors the
 * `req.profile.student_id || req.profile.id` pattern already used by
 * student-dashboard.controller.ts for the student role; extends it to
 * parents by checking parent_student_links (see parent.service.ts's
 * getParentWithChildren for the same table/shape).
 *
 * admin / teacher / librarian-equivalent / super_admin roles are NOT
 * further restricted here — a fuller "is this teacher actually assigned to
 * this student's circle" check would mirror
 * student-profiles.service.ts's canSeeLearningNeeds, but is not enforced
 * uniformly across every Hifzi read endpoint yet. Flagged as a known gap
 * to close before this module handles real student data, not silently
 * assumed solved.
 */
export async function assertCanAccessStudent(req: AuthRequest, studentId: string): Promise<boolean> {
  const role = req.profile?.role
  if (!studentId) return false

  if (role === 'admin' || role === 'super_admin' || role === 'teacher') return true

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
