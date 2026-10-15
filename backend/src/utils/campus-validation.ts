import { supabase } from '../config/supabase'
import { AuthRequest } from '../middlewares/auth.middleware'

/**
 * Validates that an admin has access to a specific campus
 * An admin has access to a campus if:
 * 1. The campus belongs to their parent school (school_id), OR
 * 2. The campus IS their school (for the main school)
 * 
 * @param adminSchoolId - The admin's school_id from their profile
 * @param targetCampusId - The campus/school ID they're trying to access
 * @returns true if admin has access, false otherwise
 */
export async function validateCampusAccess(
  adminSchoolId: string,
  targetCampusId: string
): Promise<boolean> {
  try {
    // If targeting their own school, always allow
    if (adminSchoolId === targetCampusId) {
      return true
    }

    // Check if the target campus is a child of the admin's school
    const { data: campus, error } = await supabase
      .from('schools')
      .select('id, parent_school_id')
      .eq('id', targetCampusId)
      .single()

    if (error || !campus) {
      console.error('Error validating campus access:', error)
      return false
    }

    // Allow if the campus's parent is the admin's school
    return campus.parent_school_id === adminSchoolId
  } catch (error) {
    console.error('Error in validateCampusAccess:', error)
    return false
  }
}

/**
 * Gets the effective school ID to use for creating records
 * If campus_id is provided in the request body and admin has access, use it
 * Otherwise, fall back to the admin's school_id
 * 
 * @param adminSchoolId - The admin's school_id from their profile
 * @param requestedCampusId - Optional campus_id from request body
 * @returns The school_id to use for the record
 */
export async function getEffectiveSchoolId(
  adminSchoolId: string,
  requestedCampusId?: string
): Promise<string> {
  // If no campus specified, use admin's school
  if (!requestedCampusId) {
    return adminSchoolId
  }

  // Validate access to the requested campus
  const hasAccess = await validateCampusAccess(adminSchoolId, requestedCampusId)
  
  if (!hasAccess) {
    console.warn(`Admin with school_id ${adminSchoolId} attempted to access campus ${requestedCampusId} without permission`)
    // Fall back to admin's school for security
    return adminSchoolId
  }

  return requestedCampusId
}

/**
 * Resolves the school_id to use for a request: trusts req.profile.school_id
 * by default, but lets a non-super-admin target a different campus/school
 * as long as validateCampusAccess() confirms it's a child of their own
 * school (or is their own school). super_admin may target any explicit
 * school_id (falls back to their own profile if omitted).
 *
 * Shared across controllers — was previously duplicated per-controller as a
 * strict equality check that rejected ANY school_id other than the caller's
 * own profile.school_id. That meant an admin who could freely switch campus
 * for students/grades/generation would still have every fee-categories,
 * fee-structures, payments, school-services (etc.) endpoint silently keep
 * operating on their home campus only — making a campus they'd switched to
 * look like it had no data, when the real data was simply unreachable
 * through the guard. Use this (not a local copy) for any new endpoint that
 * needs campus-aware school scoping.
 */
export async function resolveSchoolId(
  req: AuthRequest,
  requestedSchoolId?: string | null
): Promise<{ schoolId: string | null; error?: string; status?: number }> {
  const profileSchoolId = req.profile?.school_id ?? null
  const role = req.profile?.role

  if (role === 'super_admin') {
    return { schoolId: requestedSchoolId || profileSchoolId }
  }

  if (!profileSchoolId) {
    return { schoolId: null, error: 'Not authenticated', status: 403 }
  }

  if (!requestedSchoolId || requestedSchoolId === profileSchoolId) {
    return { schoolId: profileSchoolId }
  }

  const hasAccess = await validateCampusAccess(profileSchoolId, requestedSchoolId)
  if (!hasAccess) {
    return { schoolId: null, error: 'Forbidden: school_id does not match your account', status: 403 }
  }

  return { schoolId: requestedSchoolId }
}

// ── School family check (used by authenticate for every campus_id) ───────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ROOT_TTL_MS = 10 * 60 * 1000
const rootCache = new Map<string, { root: string | null; at: number }>()

/** Main school id of a school/campus (follows parent_school_id), or null if it doesn't exist. Cached. */
export async function schoolRootId(id: string): Promise<string | null> {
  const hit = rootCache.get(id)
  if (hit && Date.now() - hit.at < ROOT_TTL_MS) return hit.root
  let current: string | null = id
  let root: string | null = null
  for (let depth = 0; current && depth < 5; depth++) {
    const { data, error } = await supabase.from('schools').select('id, parent_school_id').eq('id', current).maybeSingle()
    if (error) throw error
    if (!data) break
    root = data.id
    current = data.parent_school_id
  }
  rootCache.set(id, { root, at: Date.now() })
  return root
}

/** Request fields that many handlers use directly as the school to read or write. */
const SCOPE_KEYS = ['campus_id', 'school_id', 'campusId', 'schoolId'] as const

/** Every UUID-shaped campus/school id (snake or camel case) in the query string and JSON body (top level). */
export function requestedCampusIds(query: unknown, body: unknown): string[] {
  const out: string[] = []
  const add = (v: unknown) => {
    for (const x of Array.isArray(v) ? v : [v]) if (typeof x === 'string' && UUID_RE.test(x.trim())) out.push(x.trim())
  }
  for (const key of SCOPE_KEYS) {
    if (query && typeof query === 'object') add((query as Record<string, unknown>)[key])
    if (body && typeof body === 'object' && !Array.isArray(body)) add((body as Record<string, unknown>)[key])
  }
  return [...new Set(out)]
}

/**
 * True when every requested campus belongs to the same school family (same main school) as the
 * caller's school. Many endpoints use campus_id directly as the school id, so without this any
 * signed-in user could read another school's data by passing its id.
 */
export async function campusIdsAllowed(profileSchoolId: string | null | undefined, campusIds: string[]): Promise<boolean> {
  if (campusIds.length === 0) return true
  if (!profileSchoolId) return false
  const own = await schoolRootId(profileSchoolId)
  if (!own) return false
  for (const id of campusIds) {
    if (id === profileSchoolId) continue
    if ((await schoolRootId(id)) !== own) return false
  }
  return true
}
