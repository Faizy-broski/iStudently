'use client'

import { SWRConfig, mutate } from 'swr'
import { ReactNode, useEffect, useRef } from 'react'
import { waitForSessionValidation, handleSessionExpiry } from '@/context/AuthContext'

/**
 * Global SWR Configuration Provider
 * Prevents aggressive refetching and loading states on tab switches
 * Coordinates with AuthContext to ensure session is valid before refetching
 * Includes session expiry handling, stale data recovery, and online/offline handling
 */

// How long the tab must be hidden before we revalidate on return.
// 15 minutes: short tab-switches are never worth a full refetch.
const HIDDEN_THRESHOLD_MS = 15 * 60 * 1000

/**
 * Check if user is on an authentication page
 * Used to skip SWR revalidation on auth pages
 */
function isOnAuthPage(): boolean {
  if (typeof window === 'undefined') return false
  return window.location.pathname.startsWith('/auth/')
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
  const hiddenAt = useRef<number | null>(null)
  const isOnline = useRef(typeof navigator !== 'undefined' ? navigator.onLine : true)

  useEffect(() => {
    // Single visibility handler: revalidate only after 15+ minutes away.
    // Shorter tab switches are normal workflow — no refetch, no flash.
    const handleVisibilityChange = async () => {
      if (document.hidden) {
        hiddenAt.current = Date.now()
        return
      }

      if (hiddenAt.current === null) return
      const duration = Date.now() - hiddenAt.current
      hiddenAt.current = null

      if (duration < HIDDEN_THRESHOLD_MS) return
      if (isOnAuthPage()) return

      try {
        const isSessionValid = await waitForSessionValidation()
        if (!isSessionValid) {
          await clearAllSWRCache()
          return
        }
        await revalidateAllSWRData()
      } catch {
        // Session check failed — individual API calls will handle 401s
      }
    }

    // Reconnect handler: revalidate after coming back online
    const handleOnline = async () => {
      if (!isOnline.current) {
        isOnline.current = true
        try {
          const isSessionValid = await waitForSessionValidation()
          if (isSessionValid) await revalidateAllSWRData()
        } catch {
          // Silent — SWR's revalidateOnReconnect handles the fallback
        }
      }
    }

    const handleOffline = () => { isOnline.current = false }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
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
        // Error retry configuration - quick retry for transient failures
        errorRetryInterval: 1500,
        errorRetryCount: 2,
        // Global error handler
        onError: async (error, key) => {
          // Handle session expiry errors from any API call
          // This catches 401 errors even from API files that don't explicitly handle them
          const errorMsg = error?.message || ''
          if (errorMsg.includes('Session expired') ||
              errorMsg.includes('session_expired') ||
              errorMsg.includes('Unauthorized') ||
              errorMsg.includes('401')) {
            console.warn('🔐 SWR detected auth error, triggering session expiry handler')
            await clearAllSWRCache()
            await handleSessionExpiry()
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
