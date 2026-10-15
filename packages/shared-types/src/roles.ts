import defaultRoleHrefs from './default-role-hrefs.json'
import moduleCatalog from './module-catalog.json'
import profileModules from './profile-modules.json'
import type { UserRole } from './index'

export const USER_ROLES: readonly UserRole[] = [
  'super_admin',
  'admin',
  'teacher',
  'student',
  'parent',
  'staff',
  'librarian',
  'counselor',
  'inspector',
  'media_officer',
  'fina_supervisor',
  'financial_admin',
] as const

/**
 * Web landing page per role. Single source for the map duplicated in
 * RoleGuard, auth/2fa/* and auth/change-password on the web.
 * counselor has no web destination (see 04-AUDIT-FINDINGS.md); staff use the admin shell.
 */
export const WEB_DASHBOARD_BY_ROLE: Partial<Record<UserRole, string>> = {
  super_admin: '/superadmin/dashboard',
  admin: '/admin/dashboard',
  teacher: '/teacher/dashboard',
  student: '/student/dashboard',
  parent: '/parent/dashboard',
  staff: '/staff/dashboard',
  librarian: '/librarian/dashboard',
  inspector: '/inspector/dashboard',
  media_officer: '/media-officer/fina/review',
  fina_supervisor: '/fina-supervisor/dashboard',
  financial_admin: '/admin/vault',
}

/** Route group in the mobile app (mobile/app/(group)) a role lands in after sign-in. */
export type MobileRoleGroup = 'student' | 'parent' | 'teacher' | 'librarian' | 'inspector' | 'scanner' | 'admin' | 'superadmin'

export const MOBILE_GROUP_BY_ROLE: Record<UserRole, MobileRoleGroup | null> = {
  student: 'student',
  parent: 'parent',
  teacher: 'teacher',
  // School admin: every admin module natively, built in waves, with the campus switcher (2026-10-07).
  // Staff use the same admin shell as on the web, limited by their User Profile permissions and campus.
  // The QR scanner is a device mode (enrolment code), reached from a role home, not a login role.
  admin: 'admin',
  staff: 'admin',
  // Librarian and inspector: their web pages natively (2026-10-12).
  librarian: 'librarian',
  inspector: 'inspector',
  // All 11 super-admin pages natively; no school impersonation in the app (2026-10-06).
  super_admin: 'superadmin',
  // Web-only roles: the app shows a "use the website" message.
  counselor: null,
  media_officer: null,
  fina_supervisor: null,
  financial_admin: null,
}


/** User types a permission profile (user_profiles.base_role) can apply to. */
export type ProfileBaseRole = 'admin' | 'staff' | 'teacher' | 'librarian' | 'student' | 'parent'

/**
 * Default pages per user type (snapshot of the web's getRoleHrefs, synced by
 * scripts/sync-role-hrefs.sh). Sent to POST /user-profiles/seed-defaults: onboarding sends
 * teacher/staff/librarian ('reset'); the User Profiles page sends all six ('reconcile').
 */
export const DEFAULT_ROLE_HREFS: Record<ProfileBaseRole, string[]> = defaultRoleHrefs

export interface ProfileModuleGroup {
  /** Sidebar section title key, or '__root__' for top-level items. */
  title: string
  href: string
  items: { title: string; href: string }[]
}

/** Per user type, the module groups the web's User Profiles page lists (before denied modules). */
export const PROFILE_MODULES: Record<ProfileBaseRole, ProfileModuleGroup[]> = profileModules

export interface ModuleCatalogItem {
  /** Sidebar title key (`sidebar` translation namespace). */
  title: string
  hrefs: string[]
}

export interface ModuleCatalogGroup {
  /** Sidebar section title key, or '__root__' for top-level items. */
  title: string
  items: ModuleCatalogItem[]
}

/** Web module catalog snapshot (scripts/sync-role-hrefs.sh); drives per-school module access. */
export const MODULE_CATALOG: ModuleCatalogGroup[] = moduleCatalog

export const ALL_MODULE_HREFS: string[] = [...new Set(moduleCatalog.flatMap((g) => g.items.flatMap((i) => i.hrefs)))]
