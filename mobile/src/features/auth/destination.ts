import type { Me } from '@studently/api-client'
import { MOBILE_GROUP_BY_ROLE } from '@studently/shared-types'

import { isRoleReleased } from './release'

export type GateKind = 'force_password_change' | 'two_fa_setup' | 'two_fa_verify' | 'agreement' | 'agreement_blocked'

export type Destination =
  | { kind: 'gate'; gate: GateKind }
  | { kind: 'web_only' }
  | { kind: 'coming_soon' }
  | { kind: 'home'; href: '/student' | '/parent' | '/teacher' | '/librarian' | '/inspector' | '/scanner' | '/admin' | '/superadmin' }

/**
 * Where a signed-in user goes, in the same order the web enforces:
 * forced password change, 2FA, agreement, then the role's home.
 */
export function resolveDestination(me: Me): Destination {
  const { gates, profile } = me
  // Roles not released yet: "Coming soon" before any sign-in step (they can't use the app anyway).
  if (!isRoleReleased(profile.role)) return { kind: 'coming_soon' }
  if (gates.force_password_change) return { kind: 'gate', gate: 'force_password_change' }
  if (gates.two_fa.state === 'setup_required') return { kind: 'gate', gate: 'two_fa_setup' }
  if (gates.two_fa.state === 'verify_required') return { kind: 'gate', gate: 'two_fa_verify' }
  if (gates.agreement?.blocked) return { kind: 'gate', gate: 'agreement_blocked' }
  if (gates.agreement?.must_accept) return { kind: 'gate', gate: 'agreement' }

  const group = MOBILE_GROUP_BY_ROLE[profile.role]
  if (!group) return { kind: 'web_only' }
  return { kind: 'home', href: `/${group}` }
}
