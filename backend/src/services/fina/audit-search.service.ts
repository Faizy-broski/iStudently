import { supabase } from '../../config/supabase'
import { CallerContext } from './types'
import { listMunicipalitySchoolIds } from './supervisor-access.service'

/**
 * Searchable/filterable fina_audit_log reads (spec §16.7, §22) — principal
 * (their own school) and fina_supervisor (every school in their
 * municipality). Read-only by construction: fina_audit_log itself is
 * trigger-enforced append-only (239_create_fina_audit_log.sql) regardless
 * of what reads it.
 */

export interface AuditSearchFilters {
  schoolId?: string
  from?: string
  to?: string
  action?: string
  limit?: number
}

// super_admin deliberately excluded — spec §12 gives SYSADMIN only
// "technical" audit access (e.g. hash-chain integrity), not this human
// moderation/content audit-log search screen. A prior unscoped 'any'
// override here let the vendor's own account search every school's audit
// trail — removed entirely.
async function resolveAllowedSchoolIds(caller: CallerContext): Promise<string[] | 'any'> {
  if (caller.role === 'fina_supervisor') return listMunicipalitySchoolIds(caller.profileId)
  if (caller.role === 'admin') return [caller.schoolId]
  throw new Error('Access denied')
}

export async function searchAuditLog(caller: CallerContext, filters: AuditSearchFilters) {
  const allowed = await resolveAllowedSchoolIds(caller)
  if (allowed !== 'any' && allowed.length === 0) return []

  let query = supabase.from('fina_audit_log').select('*').order('occurred_at', { ascending: false }).limit(Math.min(filters.limit ?? 100, 200))

  if (allowed !== 'any') {
    if (filters.schoolId) {
      if (!allowed.includes(filters.schoolId)) throw new Error('Access denied: school outside your scope')
      query = query.eq('school_id', filters.schoolId)
    } else {
      query = query.in('school_id', allowed)
    }
  } else if (filters.schoolId) {
    query = query.eq('school_id', filters.schoolId)
  }

  if (filters.from) query = query.gte('occurred_at', filters.from)
  if (filters.to) query = query.lte('occurred_at', filters.to)
  if (filters.action) query = query.eq('action', filters.action)

  const { data, error } = await query
  if (error) throw new Error(`Failed to search audit log: ${error.message}`)
  return data || []
}
