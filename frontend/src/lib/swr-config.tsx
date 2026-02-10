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

// Track when user was last active to detect idle periods
let lastActiveTime = Date.now()
const IDLE_THRESHOLD = 2 * 60 * 1000 // 2 minutes idle threshold

/**
 * Check if user is on an authentication page
 * Used to skip SWR revalidation on auth pages
 */
function isOnAuthPage(): boolean {
  if (typeof window === 'undefined') return false
  return window.location.pathname.startsWith('/auth/')
}

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
  const isOnline = useRef(typeof navigator !== 'undefined' ? navigator.onLine : true)

  // Handle visibility change - wait for auth validation then revalidate stale data
  useEffect(() => {
    let debounceTimeout: NodeJS.Timeout | null = null

    const handleVisibilityChange = async () => {
      if (!document.hidden) {
        // Skip on auth pages - no SWR data to revalidate there
        if (isOnAuthPage()) return
        
        // Debounce rapid tab switches (600ms - slightly longer than auth's 300ms)
        // This ensures auth validation starts first
        if (debounceTimeout) clearTimeout(debounceTimeout)
        
        debounceTimeout = setTimeout(async () => {
          const now = Date.now()
          const wasHiddenDuration = now - lastVisibleTime.current
          const wasIdle = now - lastActiveTime > IDLE_THRESHOLD
          
          // If tab was hidden for more than 2 minutes OR user was idle
          if (wasHiddenDuration > IDLE_THRESHOLD || wasIdle) {
            try {
              // CRITICAL: Wait for auth context's session validation to complete first
              // This prevents race conditions where SWR fires requests with stale tokens
              const isSessionValid = await waitForSessionValidation()
              
              if (!isSessionValid) {
                // Session invalid - clear cache and let auth redirect handle it
                await clearAllSWRCache()
                return
              }
              
              // Session valid - revalidate all data
              await revalidateAllSWRData()
            } catch {
              // If validation fails, still try to revalidate
              // The API calls will wait for session validation anyway
              await revalidateAllSWRData()
            }
          }
        }, 600)
      } else {
        lastVisibleTime.current = Date.now()
      }
    }

    // Handle online/offline - revalidate when coming back online
    const handleOnline = async () => {
      if (!isOnline.current) {
        isOnline.current = true
        // Wait for session validation before revalidating
        try {
          const isSessionValid = await waitForSessionValidation()
          
          if (isSessionValid) {
            await revalidateAllSWRData()
          }
        } catch {
          // Silent fail - SWR's revalidateOnReconnect will handle it
        }
      }
    }

    const handleOffline = () => {
      isOnline.current = false
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    return () => {
      if (debounceTimeout) clearTimeout(debounceTimeout)
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
