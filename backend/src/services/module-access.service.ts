import { supabase } from '../config/supabase'
import { TtlCache } from '../utils/ttl-cache'
import {
  ANY_GRANT,
  API_AREA_MODULES,
  API_AREA_READ_MODULES,
  STAFF_BLOCKED_AREAS,
  STAFF_READ_ONLY_AREAS,
} from '../config/module-access.config'

export interface ModulePermission {
  module_key: string
  can_use: boolean
  can_edit: boolean
}

export interface ModuleAccessDecision { allowed: boolean; reason?: string }

/**
 * `/api/fees/payments?x=1` or `/fees/payments` -> `fees`. Empty string when there is no
 * prefix. Pass the full request URL (originalUrl): some routers are mounted at the root and
 * define their own first path segment (`/discipline/...`, `/comment-codes/...`).
 */
export function resolveApiArea(url: string): string {
  const path = url.split('?')[0].replace(/^\/api(?=\/|$)/, '')
  return path.split('/').filter(Boolean)[0] ?? ''
}

const isReadMethod = (method: string) => ['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase())

function grantsFolder(perms: ModulePermission[], folder: string, needEdit: boolean): boolean {
  const root = `/admin/${folder}`
  return perms.some(
    (p) =>
      (needEdit ? p.can_edit : p.can_use || p.can_edit) &&
      (p.module_key === root || p.module_key.startsWith(root + '/'))
  )
}

/**
 * Pure decision: may a staff account with `perms` call `method` on the API mounted at `baseUrl`?
 * Reads need "can use" and writes need "can edit" on a granted module under the area.
 */
export function decideStaffModuleAccess(
  perms: ModulePermission[],
  baseUrl: string,
  method: string
): ModuleAccessDecision {
  const area = resolveApiArea(baseUrl)
  if (!area) return { allowed: false, reason: 'unknown API area' }
  if (STAFF_BLOCKED_AREAS.has(area)) return { allowed: false, reason: `"${area}" is administrator-only` }

  const owners = API_AREA_MODULES[area]
  if (!owners) return { allowed: false, reason: `"${area}" is not available to staff roles` }

  const write = !isReadMethod(method)
  // Reads are also open to modules whose pages depend on this area (lookups like grade levels)
  const folders = write ? owners : [...owners, ...(API_AREA_READ_MODULES[area] ?? [])]
  if (write && STAFF_READ_ONLY_AREAS.has(area)) {
    return { allowed: false, reason: `"${area}" is read-only for staff roles` }
  }

  if (folders.includes(ANY_GRANT)) {
    const any = perms.some((p) => (write ? p.can_edit : p.can_use || p.can_edit))
    return any ? { allowed: true } : { allowed: false, reason: 'no module granted' }
  }

  const ok = folders.some((f) => grantsFolder(perms, f, write))
  return ok
    ? { allowed: true }
    : { allowed: false, reason: `your role does not grant ${write ? 'edit' : 'use'} access to this module` }
}

// Permission rows change only when an admin edits a role; a short TTL keeps this per-request
// check off the database, and the profile service clears it on every change.
const permissionCache = new TtlCache<ModulePermission[]>(30_000)

export function clearModulePermissionCache(): void {
  permissionCache.clear()
}

/**
 * A staff member gets a per-user COPY of the role they are assigned (staff.user_profile_id ->
 * a user_profiles row with role_id + staff_id). The copy is made once, so it goes stale the
 * moment the role is edited afterwards — a role edited to grant more (or "edit") access kept
 * refusing the user. The role is the source of truth: for such a copy, read the role's
 * permissions instead. Copies with no live role (role deleted) and standalone profiles keep
 * their own rows.
 */
export async function resolvePermissionSourceId(profileId: string): Promise<string> {
  const { data } = await supabase
    .from('user_profiles')
    .select('profile_type, role_id, staff_id')
    .eq('id', profileId)
    .maybeSingle()
  if (data?.profile_type === 'user_profile' && data.role_id && data.staff_id) return data.role_id
  return profileId
}

export async function loadProfilePermissions(profileId: string): Promise<ModulePermission[]> {
  const cached = permissionCache.get(profileId)
  if (cached) return cached

  const sourceId = await resolvePermissionSourceId(profileId)
  const { data, error } = await supabase
    .from('user_profile_permissions')
    .select('module_key, can_use, can_edit')
    .eq('profile_id', sourceId)
  if (error) throw error

  const perms = (data || []) as ModulePermission[]
  permissionCache.set(profileId, perms)
  return perms
}
