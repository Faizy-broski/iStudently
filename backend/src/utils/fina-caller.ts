import { AuthRequest } from '../middlewares/auth.middleware'
import { CallerContext } from '../services/fina/types'
import { resolveSchoolId } from './campus-validation'

const FIXED_CAMPUS_ROLES = ['teacher', 'staff', 'librarian', 'student', 'parent']

/**
 * Resolves the CallerContext.schoolId every Al-Fina' controller uses to
 * scope fina_media/fina_posts/fina_consents/fina_albums rows and
 * authorization checks. Two distinct problems, both real and both hit
 * during pilot testing:
 *
 * 1. `req.profile.school_id` is not the caller's campus for every role —
 *    per auth.middleware.ts, TEACHER/STAFF/LIBRARIAN/STUDENT profiles have
 *    `school_id` overwritten to the PARENT organization, with the actual
 *    campus stashed in `profile.campus_id`. Fixed below by preferring
 *    `campus_id` for those roles.
 *
 * 2. For ADMIN/MEDIA_OFFICER/SUPER_ADMIN, `profile.school_id` itself can be
 *    a ROOT organization overseeing several child campuses (a "root admin"
 *    account) — their own `school_id` then matches NO real student row,
 *    since students always belong to a specific child campus. These roles
 *    can operate on a specific campus by sending `campus_id` on the
 *    request (query or body) — the exact convention the rest of this
 *    platform already uses (see frontend/src/lib/api/students.ts's
 *    `campus_id` query param), validated here via the same
 *    resolveSchoolId()/validateCampusAccess() every other admin-facing
 *    endpoint in this codebase relies on. Falls back to the admin's own
 *    `school_id` when no campus_id is given — which is only correct if
 *    that admin's account IS itself a single campus, matching this
 *    function's behavior before this fix for that common case.
 *
 * 3. A super_admin actively IMPERSONATING a school (auth.middleware.ts sets
 *    `profile.impersonating_school_id` from the `X-School-Id` header, while
 *    `profile.role` stays 'super_admin' — this platform never swaps the
 *    role itself, and requireRole()'s own built-in "super_admin bypasses
 *    every role check" rule is what makes impersonation work everywhere
 *    else) is, for every Al-Fina' purpose, acting AS that school's admin —
 *    exactly like the rest of the platform already treats it. Resolved as
 *    role: 'admin' below so the module's spec-§12-driven "super_admin has
 *    zero content access" checks correctly apply only to a BARE super_admin
 *    session (no X-School-Id set), never to one actively impersonating a
 *    specific school.
 */
export async function callerFromFinaRequest(req: AuthRequest): Promise<CallerContext> {
  const role = req.profile?.role as string
  const profileId = req.profile?.id as string
  const isImpersonating = role === 'super_admin' && !!req.profile?.impersonating_school_id

  if (FIXED_CAMPUS_ROLES.includes(role)) {
    return { profileId, role, schoolId: (req.profile?.campus_id || req.profile?.school_id) as string }
  }

  const requestedCampusId = (req.query?.campus_id as string | undefined) || (req.body?.campus_id as string | undefined) || null
  const resolved = await resolveSchoolId(req, requestedCampusId)
  const schoolId = (resolved.schoolId || req.profile?.school_id) as string
  return { profileId, role: isImpersonating ? 'admin' : role, schoolId }
}
