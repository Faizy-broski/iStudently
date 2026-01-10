'use client'

import { SWRConfig } from 'swr'
import { ReactNode } from 'react'

/**
 * Global SWR Configuration Provider
 * Prevents aggressive refetching and loading states on tab switches
 */
export function SWRProvider({ children }: { children: ReactNode }) {
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
        // Retry on error handler
        shouldRetryOnError: (error) => {
          // Don't retry on authentication errors
          if (error?.message?.includes('Authentication')) return false
          if (error?.message?.includes('Unauthorized')) return false
          if (error?.message?.includes('403')) return false
          if (error?.message?.includes('401')) return false
          return true
        },
      }}
    >
      {children}
    </SWRConfig>
  )
}
