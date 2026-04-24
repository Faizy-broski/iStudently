'use client'

import { useRef, useEffect, ReactNode } from 'react'
import { revalidateAllSWRData } from '@/lib/swr-config'

/**
 * Wrapper that triggers a soft SWR data refresh (NOT a React remount) when:
 * 1. Tab was hidden for >15 minutes and becomes visible
 *
 * Network reconnects are handled by SWRProvider (revalidateOnReconnect: true).
 * Full remounts (key changes) are intentionally removed — they caused the
 * "page reload" effect visible on every tab switch longer than 30 seconds.
 * SWR revalidation achieves fresh data without destroying component state.
 */

// Only trigger a background refresh after 15 minutes of absence.
// Anything shorter is a normal workflow tab-switch — no refresh needed.
const HIDDEN_THRESHOLD_MS = 15 * 60 * 1000 // 15 minutes

export function RefreshOnReturn({ children }: { children: ReactNode }) {
  // Use refs — no state, no re-renders, no handler churn
  const hiddenAt = useRef<number | null>(null)

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        hiddenAt.current = Date.now()
      } else if (hiddenAt.current !== null) {
        const duration = Date.now() - hiddenAt.current
        hiddenAt.current = null

        if (duration > HIDDEN_THRESHOLD_MS) {
          // Soft refresh: revalidate SWR data in the background.
          // Components keep their current state/UI — no flash, no remount.
          revalidateAllSWRData().catch(() => {/* silent */})
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, []) // stable — no dependency on state

  // No key prop — children are never forcibly remounted
  return <>{children}</>
}
