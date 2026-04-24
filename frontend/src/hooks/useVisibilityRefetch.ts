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
    const hiddenAtTime = useRef<number | null>(null)
    const hasBeenHidden = useRef(false)

    // Only refetch if the tab was hidden for at least 5 minutes
    const HIDDEN_THRESHOLD_MS = 5 * 60 * 1000

    useEffect(() => {
        const handleVisibilityChange = async () => {
            if (document.hidden) {
                // Tab is now hidden, mark the time
                hiddenAtTime.current = Date.now()
                hasBeenHidden.current = true
            } else if (hasBeenHidden.current) {
                // Tab is now visible again
                hasBeenHidden.current = false
                const hiddenDuration = hiddenAtTime.current ? Date.now() - hiddenAtTime.current : 0
                hiddenAtTime.current = null
                
                // Only trigger refetch if tab was hidden for longer than the threshold
                if (hiddenDuration >= HIDDEN_THRESHOLD_MS) {
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
        }

        document.addEventListener('visibilitychange', handleVisibilityChange)
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [refetchCallback, ...dependencies])
}
