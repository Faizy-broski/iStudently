import { createClient } from '@/lib/supabase/client'

// Refresh lock to prevent race conditions across the app
let isRefreshing = false
let refreshPromise: Promise<boolean> | null = null

/**
 * Validates and refreshes the current session if needed
 * RACE CONDITION SAFE: Multiple simultaneous calls will share the same refresh attempt
 * @returns true if session is valid, false otherwise
 */
export async function validateAndRefreshSession(): Promise<boolean> {
  // If already refreshing, wait for that operation to complete
  if (isRefreshing && refreshPromise) {
    console.log('⏳ Refresh already in progress, waiting...')
    return refreshPromise
  }

  const supabase = createClient()
  
  try {
    const { data: { session }, error } = await supabase.auth.getSession()
    
    if (error) {
      console.error('❌ Session validation error:', error)
      return false
    }
    
    if (!session) {
      return false
    }
    
    // CRITICAL: Use server-provided expires_at to avoid clock drift
    // expires_at is in seconds since epoch, convert to milliseconds
    const expiresAt = session.expires_at ? session.expires_at * 1000 : 0
    const now = Date.now()
    const fiveMinutes = 5 * 60 * 1000
    
    // Only refresh if expiring within 5 minutes AND not already expired
    if (expiresAt - now < fiveMinutes && expiresAt > now) {
      // Double-check lock pattern to prevent race conditions
      if (isRefreshing) {
        return refreshPromise || Promise.resolve(true)
      }
      
      console.log('🔄 Session expiring soon, refreshing...')
      isRefreshing = true
      
      // Store the refresh promise so concurrent calls can await it
      refreshPromise = (async () => {
        try {
          const { error: refreshError } = await supabase.auth.refreshSession()
          
          if (refreshError) {
            console.error('❌ Failed to refresh session:', refreshError)
            return false
          }
          
          console.log('✅ Session refreshed successfully')
          return true
        } finally {
          isRefreshing = false
          refreshPromise = null
        }
      })()
      
      return refreshPromise
    }
    
    return true
  } catch (error) {
    console.error('❌ Unexpected error during session validation:', error)
    isRefreshing = false
    refreshPromise = null
    return false
  }
}

/**
 * Higher-order function to wrap API calls with session validation
 * @param apiCall - The API call function to wrap
 * @returns Wrapped function with session validation
 */
export function withSessionValidation<
  Args extends unknown[],
  Return extends Promise<unknown>
>(
  apiCall: (...args: Args) => Return
): (...args: Args) => Return {
  return (async (...args: Args): Promise<Awaited<Return>> => {
    const isValid = await validateAndRefreshSession()
    
    if (!isValid) {
      throw new Error('Session expired. Please log in again.')
    }
    
    return await apiCall(...args)
  }) as (...args: Args) => Return
}

/**
 * Check if a session exists without triggering a refresh
 */
export async function hasValidSession(): Promise<boolean> {
  const supabase = createClient()
  
  try {
    const { data: { session } } = await supabase.auth.getSession()
    return !!session
  } catch {
    return false
  }
}
