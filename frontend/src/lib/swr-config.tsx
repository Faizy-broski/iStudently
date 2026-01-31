'use client'

import { SWRConfig, mutate } from 'swr'
import { ReactNode, useEffect, useRef } from 'react'

/**
 * Global SWR Configuration Provider
 * Prevents aggressive refetching and loading states on tab switches
 * Includes session expiry handling and stale data recovery
 */

// Track when user was last active to detect idle periods
let lastActiveTime = Date.now()
const IDLE_THRESHOLD = 5 * 60 * 1000 // 5 minutes idle threshold

// Update last active time on user interactions
if (typeof window !== 'undefined') {
  const updateLastActive = () => { lastActiveTime = Date.now() }
  window.addEventListener('mousemove', updateLastActive, { passive: true })
  window.addEventListener('keydown', updateLastActive, { passive: true })
  window.addEventListener('click', updateLastActive, { passive: true })
  window.addEventListener('touchstart', updateLastActive, { passive: true })
}

/**
 * Clear all SWR cache - useful when session becomes stale
 */
export async function clearAllSWRCache() {
  // Mutate all keys to undefined to clear cache
  await mutate(() => true, undefined, { revalidate: false })
}

/**
 * Revalidate all SWR data - useful after returning from idle
 */
export async function revalidateAllSWRData() {
  await mutate(() => true)
}

export function SWRProvider({ children }: { children: ReactNode }) {
  const lastVisibleTime = useRef(Date.now())

  // Handle visibility change - clear stale data when returning after idle
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (!document.hidden) {
        const now = Date.now()
        const wasHiddenDuration = now - lastVisibleTime.current
        const wasIdle = now - lastActiveTime > IDLE_THRESHOLD
        
        // If tab was hidden for more than 5 minutes OR user was idle
        if (wasHiddenDuration > IDLE_THRESHOLD || wasIdle) {
          // Trigger revalidation of all cached data
          await revalidateAllSWRData()
        }
      } else {
        lastVisibleTime.current = Date.now()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  return (
    <SWRConfig
      value={{
        // Disable automatic revalidation on focus globally
        revalidateOnFocus: false,
        // Revalidate when network reconnects
        revalidateOnReconnect: true,
        // Keep previous data while revalidating (prevents loading flicker)
        keepPreviousData: true,
        // Deduplicate requests within 5 seconds
        dedupingInterval: 5000,
        // Don't show loading state during revalidation if we have data
        revalidateIfStale: true,
        // Error retry configuration
        errorRetryInterval: 10000,
        errorRetryCount: 3,
        // Global error handler
        onError: (error, key) => {
          // Handle session expiry errors from any API call
          if (error?.message?.includes('Session expired') ||
              error?.message?.includes('session_expired') ||
              error?.message?.includes('401')) {
            clearAllSWRCache()
          }
        },
        // Retry on error handler
        shouldRetryOnError: (error) => {
          // Don't retry on authentication errors
          if (error?.message?.includes('Authentication')) return false
          if (error?.message?.includes('Unauthorized')) return false
          if (error?.message?.includes('Session expired')) return false
          if (error?.message?.includes('Permission denied')) return false
          if (error?.message?.includes('403')) return false
          if (error?.message?.includes('401')) return false
          if (error?.message?.includes('Request cancelled')) return false
          return true
        },
      }}
    >
      {children}
    </SWRConfig>
  )
}
