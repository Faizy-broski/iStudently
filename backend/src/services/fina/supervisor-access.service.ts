import { supabase } from '../../config/supabase'
import { AuthRequest } from '../../middlewares/auth.middleware'

/**
 * Authorization helper for the Al-Fina' module's SUPERVISOR role. Deliberately
 * NOT built on top of campus-validation.ts's validateCampusAccess/
 * resolveSchoolId — those assume a strict single-parent campus hierarchy (an
 * admin's own school plus its direct children). A municipal supervisor spans
 * every school in a municipality, potentially many unrelated organizations'
 * campus trees entirely — the same shape of problem inspector-access.ts
 * already solved for inspectors in the Educational Inspection module, so
 * this mirrors that file's structure rather than widening campus-validation.ts.
 */

export async function listMunicipalitySchoolIds(supervisorProfileId: string): Promise<string[]> {
  const { data: account, error: accountError } = await supabase
    .from('fina_supervisor_accounts')
    .select('municipality_id')
    .eq('user_id', supervisorProfileId)
    .maybeSingle()

  if (accountError || !account) {
    if (accountError) console.error('Error loading fina_supervisor_accounts:', accountError)
    return []
  }

  const { data, error } = await supabase.from('schools').select('id').eq('municipality_id', account.municipality_id)
  if (error) {
    console.error('Error listing municipality school ids:', error)
    return []
  }
  return (data || []).map((s) => s.id as string)
}

// super_admin deliberately excluded from the bypass this used to grant —
// spec §12: SYSADMIN's view scope is "operational only", not this
// supervisor-scoped school access (the `role` param is now unused, kept for
// call-site compatibility rather than reworking every caller's signature).
export async function assertSupervisorCanAccessSchool(
  supervisorProfileId: string,
  schoolId: string,
  role?: string
): Promise<boolean> {
  const schoolIds = await listMunicipalitySchoolIds(supervisorProfileId)
  return schoolIds.includes(schoolId)
}

/**
 * Express-route guard: 403s unless req.profile (the supervisor) has that
 * school within their municipality's set. Use after requireFinaSupervisor.
 */
export async function requireFinaSupervisorSchoolAccess(
  req: AuthRequest,
  res: import('express').Response,
  next: import('express').NextFunction
) {
  const schoolId = req.params.schoolId || req.body?.school_id || (req.query.school_id as string | undefined)
  if (!schoolId) {
    return res.status(400).json({ success: false, error: 'school_id is required' })
  }

  const supervisorProfileId = req.profile?.id
  const role = req.profile?.role
  if (!supervisorProfileId) {
    return res.status(401).json({ success: false, error: 'Unauthorized' })
  }

  const hasAccess = await assertSupervisorCanAccessSchool(supervisorProfileId, schoolId, role)
  if (!hasAccess) {
    return res.status(403).json({ success: false, error: 'Forbidden: school outside your municipality' })
  }

  return next()
}
