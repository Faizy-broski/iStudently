import { AuthRequest } from '../middlewares/auth.middleware'
import { CallerContext } from '../services/vault/types'
import { resolveSchoolId } from './campus-validation'

/**
 * Resolves the CallerContext every AdminVault controller uses to scope
 * vault_records/vault_field_definitions rows. Simpler than
 * fina-caller.ts's callerFromFinaRequest(): every AdminVault-allowed role
 * (super_admin, admin, financial_admin — see vault-access.middleware.ts) is
 * an admin-like, non-campus-fixed role, so there's no FIXED_CAMPUS_ROLES
 * branch to handle. A super_admin actively impersonating a school (see
 * fina-caller.ts's header comment for the full rationale) is resolved as
 * 'admin' for the same reason Fina does — impersonation acts AS that
 * school's admin everywhere else in this platform.
 */
export async function callerFromVaultRequest(req: AuthRequest): Promise<CallerContext> {
  const role = req.profile?.role as string
  const profileId = req.profile?.id as string
  const isImpersonating = role === 'super_admin' && !!req.profile?.impersonating_school_id

  const requestedCampusId = (req.query?.campus_id as string | undefined) || (req.body?.campus_id as string | undefined) || null
  const resolved = await resolveSchoolId(req, requestedCampusId)
  const schoolId = (resolved.schoolId || req.profile?.school_id) as string

  return {
    profileId,
    role: isImpersonating ? 'admin' : role,
    schoolId,
    campusId: requestedCampusId,
  }
}
