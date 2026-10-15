import { enabledFeatures, isFeatureEnabled, type MobileFeatureKey } from '@studently/shared-types'
import { useMemo } from 'react'

import { useSession } from './session'

/**
 * Feature switches for the signed-in user: role + the school's active plugins from GET /auth/me.
 * Same gates as the web sidebar (packages/shared-types/src/features.ts).
 */
export function useFeatures() {
  const { me } = useSession()
  const role = me.status === 'ready' ? me.me.profile.role : null
  const plugins = me.status === 'ready' ? me.me.plugins : []
  return useMemo(
    () => ({
      enabled: role ? enabledFeatures(role, plugins) : [],
      has: (key: MobileFeatureKey) => (role ? isFeatureEnabled(key, role, plugins) : false),
    }),
    [role, plugins],
  )
}
