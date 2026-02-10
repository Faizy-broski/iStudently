'use client'

import { useState, useEffect, ReactNode } from 'react'

/**
 * Wrapper component that forces children to remount when:
 * 1. Tab was hidden for >30 seconds and becomes visible
 * 2. Network reconnects after being offline
 * 
 * This ensures fresh data fetch when user returns after idle/disconnect.
 */

const HIDDEN_THRESHOLD_MS = 30 * 1000 // 30 seconds

export function RefreshOnReturn({ children }: { children: ReactNode }) {
  const [refreshKey, setRefreshKey] = useState(0)
  const [hiddenAt, setHiddenAt] = useState<number | null>(null)

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab is now hidden - record the time
        setHiddenAt(Date.now())
      } else {
        // Tab is now visible
        if (hiddenAt) {
          const hiddenDuration = Date.now() - hiddenAt
          
          // If hidden for more than threshold, force refresh by changing key
          if (hiddenDuration > HIDDEN_THRESHOLD_MS) {
            console.log('🔄 Refreshing components after', Math.round(hiddenDuration / 1000), 's idle')
            setRefreshKey(prev => prev + 1)
          }
          setHiddenAt(null)
        }
      }
    }

    // Also refresh on network reconnect
    const handleOnline = () => {
      console.log('🌐 Network reconnected - refreshing components')
      setRefreshKey(prev => prev + 1)
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('online', handleOnline)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('online', handleOnline)
    }
  }, [hiddenAt])

  // The key prop forces React to unmount and remount children when it changes
  // This creates fresh component instances with fresh SWR hooks and fresh fetches
  return <div key={refreshKey}>{children}</div>
}
