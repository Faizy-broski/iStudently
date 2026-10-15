import type { UserRole } from '@studently/shared-types'

/**
 * Roles whose app is released. Everyone else signs in and sees "Coming soon" for their role;
 * their screens stay in the code and come back by adding the role here.
 * Dev builds can open every role with EXPO_PUBLIC_ALL_ROLES=1 (ignored in release builds).
 */
const RELEASED_ROLES: readonly UserRole[] = ['super_admin']

const allRolesInDev = __DEV__ && process.env.EXPO_PUBLIC_ALL_ROLES === '1'

export function isRoleReleased(role: UserRole | null | undefined) {
  return !!role && (allRolesInDev || RELEASED_ROLES.includes(role))
}

/** True when any non-super-admin role can open its screens (guards the role route groups). */
export const otherRolesOpen = allRolesInDev || RELEASED_ROLES.some((r) => r !== 'super_admin')
