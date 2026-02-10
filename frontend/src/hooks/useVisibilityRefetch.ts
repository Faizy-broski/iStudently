'use client'

import { useEffect, useRef } from 'react'
import { waitForSessionValidation } from '@/context/AuthContext'

/**
 * Hook to detect when tab becomes visible after being hidden
 * Waits for auth session validation before calling refetch callback
 * This prevents race conditions where data is fetched with stale tokens
 * 
 * @param refetchCallback - Function to call when tab becomes visible (after auth is ready)
 * @param dependencies - Additional dependencies that should trigger a refetch
 */
export function useVisibilityRefetch(
    refetchCallback: () => void,
    dependencies: React.DependencyList = []
) {
    const lastVisibleTime = useRef(Date.now())
    const hasBeenHidden = useRef(false)

    useEffect(() => {
        const handleVisibilityChange = async () => {
            if (document.hidden) {
                // Tab is now hidden, mark the time
                lastVisibleTime.current = Date.now()
                hasBeenHidden.current = true
            } else if (hasBeenHidden.current) {
                // Tab is now visible again
                hasBeenHidden.current = false
                
                // Wait for any ongoing session validation to complete
                // This ensures we have a valid token before fetching data
                try {
                    const isValid = await waitForSessionValidation()
                    if (isValid) {
                        refetchCallback()
                    }
                } catch {
                    // If validation check fails, still try the refetch
                    // The API call will handle auth errors appropriately
                    refetchCallback()
                }
            }
        }

        document.addEventListener('visibilitychange', handleVisibilityChange)
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [refetchCallback, ...dependencies])
}
