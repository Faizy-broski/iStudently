import { supabase } from '../../config/supabase'
import { CallerContext } from './types'
import { listMunicipalitySchoolIds } from './supervisor-access.service'

/**
 * Supervisor dashboard (spec §16.7, §12): uses ONLY aggregate/statistics
 * queries — counts, percentages, alert thresholds. Never a query that can
 * return a storage_key, a message body, or a student name, which is what
 * keeps "the supervisor sees numbers, never content" a structural fact
 * (this file simply has no code path capable of returning that data) rather
 * than a per-field redaction someone could forget elsewhere.
 *
 * Per-school metrics are computed with one query set per school — fine at
 * the spec's own stated scale ("responsible for 60 schools"), not worth
 * the complexity of a batched rewrite for a dashboard that isn't a hot path.
 */

const ALERT_LOW_COVERAGE_THRESHOLD = 70
const ALERT_BLOCKED_THRESHOLD = 5
const INACTIVE_DAYS_THRESHOLD = 30

// super_admin deliberately excluded — spec §12: SYSADMIN's view scope is
// "operational only", not this aggregate-but-still-content-adjacent
// dashboard. A prior override here let super_admin see every school's
// stats unscoped (bypassing even the municipality boundary that constrains
// a real fina_supervisor) — removed entirely, not narrowed.
function assertSupervisorOrAbove(caller: CallerContext) {
  if (caller.role !== 'fina_supervisor') throw new Error('Access denied: supervisor access required')
}

async function resolveScopedSchools(caller: CallerContext): Promise<{ id: string; name: string }[]> {
  const schoolIds = await listMunicipalitySchoolIds(caller.profileId)
  if (schoolIds.length === 0) return []
  const { data } = await supabase.from('schools').select('id, name').in('id', schoolIds)
  return data || []
}

export async function getSupervisorOverview(caller: CallerContext) {
  assertSupervisorOrAbove(caller)
  const schools = await resolveScopedSchools(caller)
  if (schools.length === 0) {
    return { schoolsActive: 0, schoolsTotal: 0, postsThisMonth: 0, consentCoverage: 0, openAlerts: 0, schools: [] }
  }

  const schoolIds = schools.map((s) => s.id)
  const monthStart = new Date()
  monthStart.setUTCDate(1)
  monthStart.setUTCHours(0, 0, 0, 0)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { count: postsThisMonth } = await supabase
    .from('fina_posts')
    .select('id', { count: 'exact', head: true })
    .in('school_id', schoolIds)
    .eq('state', 'published')
    .gte('published_at', monthStart.toISOString())

  const { data: recentPosts } = await supabase.from('fina_posts').select('school_id, published_at').in('school_id', schoolIds).eq('state', 'published').gte('published_at', thirtyDaysAgo)
  const activeSchoolIds = new Set((recentPosts || []).map((p) => p.school_id))

  const schoolRows = await Promise.all(
    schools.map(async (s) => {
      const { data: students } = await supabase.from('students').select('id').eq('school_id', s.id)
      const studentIds = (students || []).map((x) => x.id)

      const { data: consents } = studentIds.length
        ? await supabase.from('fina_consents').select('student_id').in('student_id', studentIds).eq('status', 'active')
        : { data: [] as any[] }
      const consentCoverage = studentIds.length ? Math.round((new Set((consents || []).map((c) => c.student_id)).size / studentIds.length) * 100) : 0

      const { count: blockedThisWeek } = await supabase
        .from('fina_audit_log')
        .select('id', { count: 'exact', head: true })
        .eq('school_id', s.id)
        .eq('action', 'media.blocked')
        .gte('occurred_at', weekAgo)

      const isActive = activeSchoolIds.has(s.id)

      return {
        id: s.id,
        name: s.name,
        consentCoverage,
        blockedThisWeek: blockedThisWeek || 0,
        isActive,
        alert:
          consentCoverage < ALERT_LOW_COVERAGE_THRESHOLD ? 'low_coverage' :
          (blockedThisWeek || 0) > ALERT_BLOCKED_THRESHOLD ? 'blocked_attempts' :
          !isActive ? 'inactive' : null,
      }
    })
  )

  const openAlerts = schoolRows.filter((s) => s.alert).length
  const avgCoverage = schoolRows.length ? Math.round(schoolRows.reduce((sum, s) => sum + s.consentCoverage, 0) / schoolRows.length) : 0

  return {
    schoolsActive: activeSchoolIds.size,
    schoolsTotal: schools.length,
    postsThisMonth: postsThisMonth || 0,
    consentCoverage: avgCoverage,
    openAlerts,
    schools: schoolRows,
  }
}

export async function getSchoolMetrics(caller: CallerContext, schoolId: string) {
  assertSupervisorOrAbove(caller)
  const allowed = await listMunicipalitySchoolIds(caller.profileId)
  if (!allowed.includes(schoolId)) throw new Error('Access denied: school outside your municipality')

  const { data: school } = await supabase.from('schools').select('id, name').eq('id', schoolId).maybeSingle()
  if (!school) throw new Error('School not found')

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: students } = await supabase.from('students').select('id').eq('school_id', schoolId)
  const studentIds = (students || []).map((x) => x.id)

  const { data: consents } = studentIds.length
    ? await supabase.from('fina_consents').select('student_id').in('student_id', studentIds).eq('status', 'active')
    : { data: [] as any[] }
  const consentCoverage = studentIds.length ? Math.round((new Set((consents || []).map((c) => c.student_id)).size / studentIds.length) * 100) : 0

  const { count: blockedThisWeek } = await supabase
    .from('fina_audit_log')
    .select('id', { count: 'exact', head: true })
    .eq('school_id', schoolId)
    .eq('action', 'media.blocked')
    .gte('occurred_at', weekAgo)

  const { count: recentPublishedCount } = await supabase
    .from('fina_posts')
    .select('id', { count: 'exact', head: true })
    .eq('school_id', schoolId)
    .eq('state', 'published')
    .gte('published_at', thirtyDaysAgo)

  return {
    id: school.id,
    name: school.name,
    consentCoverage,
    blockedThisWeek: blockedThisWeek || 0,
    isActive: (recentPublishedCount || 0) > 0,
  }
}
