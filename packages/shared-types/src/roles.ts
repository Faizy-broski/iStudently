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
 * counselor and financial_admin have no web destination today (see 04-AUDIT-FINDINGS.md).
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
}

/** Route group in the mobile app (mobile/app/(group)) a role lands in after sign-in. */
export type MobileRoleGroup = 'student' | 'parent' | 'teacher' | 'scanner' | 'extra'

export const MOBILE_GROUP_BY_ROLE: Record<UserRole, MobileRoleGroup | null> = {
  student: 'student',
  parent: 'parent',
  teacher: 'teacher',
  staff: 'scanner',
  librarian: 'extra',
  inspector: 'extra',
  admin: 'extra',
  // Web-only roles: the app shows an "use the website" message.
  super_admin: null,
  counselor: null,
  media_officer: null,
  fina_supervisor: null,
  financial_admin: null,
}
