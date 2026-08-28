import { supabase } from '../config/supabase'
import { AuthRequest } from '../middlewares/auth.middleware'
import { validateCampusAccess } from './campus-validation'

/**
 * Authorization helper for the Educational Inspection module.
 *
 * Deliberately NOT built on top of campus-validation.ts's
 * validateCampusAccess/resolveSchoolId — those assume a strict single-parent
 * campus hierarchy (an admin's own school plus its direct children). An
 * inspector's set of visitable campuses is an arbitrary grant list from
 * inspector_school_assignments, potentially spanning campuses under
 * different parent schools entirely, so it needs its own resolution logic.
 */

export interface InspectorAssignment {
  id: string
  inspector_profile_id: string
  school_id: string
  subject_id: string | null
  grade_level_id: string | null
  is_active: boolean
}

/**
 * Returns every active campus (school_id) this inspector is currently
 * assigned to, regardless of subject/grade-level narrowing.
 */
export async function listAssignedSchoolIds(inspectorProfileId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('inspector_school_assignments')
    .select('school_id')
    .eq('inspector_profile_id', inspectorProfileId)
    .eq('is_active', true)

  if (error) {
    console.error('Error listing inspector school assignments:', error)
    return []
  }

  return [...new Set((data || []).map((row) => row.school_id as string))]
}

/**
 * Returns every active assignment row for this inspector (including any
 * subject/grade-level narrowing), for screens that need to display or act on
 * the grant itself, not just the resulting school_id set.
 */
export async function listAssignments(inspectorProfileId: string): Promise<InspectorAssignment[]> {
  const { data, error } = await supabase
    .from('inspector_school_assignments')
    .select('*')
    .eq('inspector_profile_id', inspectorProfileId)
    .eq('is_active', true)

  if (error) {
    console.error('Error listing inspector assignments:', error)
    return []
  }

  return (data || []) as InspectorAssignment[]
}

/**
 * True if this inspector currently has an active, unscoped-or-matching grant
 * for the given campus. super_admin always passes (support/troubleshooting).
 */
export async function assertInspectorCanAccessSchool(
  inspectorProfileId: string,
  schoolId: string,
  role?: string
): Promise<boolean> {
  if (role === 'super_admin') return true

  const { data, error } = await supabase
    .from('inspector_school_assignments')
    .select('id')
    .eq('inspector_profile_id', inspectorProfileId)
    .eq('school_id', schoolId)
    .eq('is_active', true)
    .limit(1)

  if (error) {
    console.error('Error checking inspector school access:', error)
    return false
  }

  return (data?.length ?? 0) > 0
}

/**
 * Express-route guard: 403s unless req.profile (the inspector) has an active
 * assignment to the school_id found at req.params.schoolId, req.body.school_id,
 * or req.query.school_id (checked in that order). Use after requireInspector.
 */
export async function requireInspectorSchoolAccess(
  req: AuthRequest,
  res: import('express').Response,
  next: import('express').NextFunction
) {
  const schoolId =
    req.params.schoolId || req.body?.school_id || (req.query.school_id as string | undefined)

  if (!schoolId) {
    return res.status(400).json({ success: false, error: 'school_id is required' })
  }

  const inspectorProfileId = req.profile?.id
  const role = req.profile?.role
  if (!inspectorProfileId) {
    return res.status(401).json({ success: false, error: 'Unauthorized' })
  }

  const hasAccess = await assertInspectorCanAccessSchool(inspectorProfileId, schoolId, role)
  if (!hasAccess) {
    return res.status(403).json({ success: false, error: 'Forbidden: not assigned to this campus' })
  }

  return next()
}

/**
 * Cross-role check for "can this caller see content targeted at schoolId" —
 * used by the Subject Community Hub (broadcasts/forum threads), where a
 * teacher, admin, or inspector might all be reading the same campus-scoped
 * feed. Deliberately separate from the assignment-specific helpers above:
 * this one DOES lean on campus-validation.ts for the admin/teacher branches
 * (their campus-hierarchy assumptions are correct for THIS check), only
 * using the inspector-assignment list for the inspector branch.
 */
export async function assertCanAccessSchoolFeed(
  caller: { profileId: string; role: string; schoolId: string },
  schoolId: string
): Promise<boolean> {
  if (caller.role === 'super_admin') return true
  if (caller.role === 'admin') {
    return validateCampusAccess(caller.schoolId, schoolId)
  }
  if (caller.role === 'inspector') {
    return assertInspectorCanAccessSchool(caller.profileId, schoolId, caller.role)
  }
  // Teachers (and any other campus-scoped role) can only see their own campus's feed.
  return caller.schoolId === schoolId
}
