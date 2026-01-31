'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { Profile, AuthContextType } from '@/types'

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Create supabase client once
const supabase = createClient()

// Refresh lock to prevent race conditions
let isRefreshing = false
let refreshPromise: Promise<boolean> | null = null

// Session expiry lock to prevent multiple simultaneous redirects
let isHandlingExpiry = false
let expiryHandledAt = 0
const EXPIRY_LOCK_DURATION = 5000 // Prevent multiple expiry handlers within 5s

// Profile cache to avoid redundant fetches across pages
let profileCache: { profile: Profile | null, userId: string, timestamp: number } | null = null
const PROFILE_CACHE_TTL = 10 * 1000 // 10 seconds - short TTL to prevent stale role data causing loops
const SESSION_CHECK_INTERVAL = 1 * 60 * 1000 // Check every 1 minute (more responsive)
const REFRESH_THRESHOLD = 10 * 60 * 1000 // Refresh 10 min before expiry (was 5 min)

/**
 * Centralized session expiry handler
 * Prevents multiple API calls from triggering simultaneous redirects
 */
export async function handleSessionExpiry() {
  const now = Date.now()
  
  // If we already handled expiry in the last 5 seconds, skip
  if (isHandlingExpiry || (now - expiryHandledAt < EXPIRY_LOCK_DURATION)) {
    return
  }

  isHandlingExpiry = true
  expiryHandledAt = now

  try {
    // Clear all caches
    profileCache = null
    isRefreshing = false
    refreshPromise = null

    // Sign out from Supabase
    await supabase.auth.signOut()

    // Redirect to login with session expired message
    if (typeof window !== 'undefined') {
      window.location.href = '/auth/login?error=session_expired'
    }
  } finally {
    // Reset lock after 5 seconds
    setTimeout(() => {
      isHandlingExpiry = false
    }, EXPIRY_LOCK_DURATION)
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  // Store raw access token to use for API calls
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [sessionCheckInterval, setSessionCheckInterval] = useState<NodeJS.Timeout | null>(null)

  // Loading timeout configuration
  const AUTH_INIT_TIMEOUT = 30000 // 30 seconds - increased for slow connections
  const PROFILE_FETCH_TIMEOUT = 15000 // 15 seconds to fetch profile
  const MAX_RETRIES = 3

  /**
   * Silent retry for auth initialization
   * Instead of showing error UI, retry silently or redirect if truly failed
   */
  const handleAuthTimeout = async (retryCount: number) => {
    if (retryCount < MAX_RETRIES) {
      // Silent retry - don't show any error to user
      return false // Signal to retry
    }
    
    // After max retries, silently redirect to login without showing error
    profileCache = null
    
    // Only redirect if not already on login page
    if (typeof window !== 'undefined' && !window.location.pathname.includes('/auth/')) {
      window.location.href = '/auth/login?error=connection_timeout'
    }
    return true // Signal to stop
  }

  /**
   * Recovery function to clear stuck loading states
   * Called when user manually wants to retry
   */
  const recoverFromError = async () => {
    setLoading(false)
    setUser(null)
    setProfile(null)
    setAccessToken(null)
    profileCache = null
    
    // Clear SWR cache
    try {
      const { clearAllSWRCache } = await import('@/lib/swr-config')
      await clearAllSWRCache()
    } catch {
      // Ignore if not available
    }
    
    // Sign out and redirect to login
    await supabase.auth.signOut()
    if (typeof window !== 'undefined') {
      window.location.href = '/auth/login?error=session_recovery'
    }
  }

  // Validate and refresh session periodically with race condition prevention
  const validateSession = async (): Promise<boolean> => {
    // If already refreshing, wait for that operation to complete
    if (isRefreshing && refreshPromise) {
      return refreshPromise
    }

    try {
      const { data: { session }, error } = await supabase.auth.getSession()

      if (error || !session) {
        // Session is invalid, use centralized handler
        setUser(null)
        setProfile(null)
        setAccessToken(null)
        await handleSessionExpiry()
        return false
      }

      // CRITICAL: Use server-provided expires_at (already in seconds since epoch)
      // This prevents clock drift issues between client and server
      const expiresAt = session.expires_at ? session.expires_at * 1000 : 0
      const now = Date.now()

      // OPTIMIZED: Refresh 10 minutes before expiry instead of 5
      if (expiresAt - now < REFRESH_THRESHOLD && expiresAt > now) {
        // Prevent multiple simultaneous refresh attempts
        if (isRefreshing) {
          return refreshPromise || Promise.resolve(true)
        }

        isRefreshing = true

        // Store the refresh promise so other calls can wait for it
        refreshPromise = (async () => {
          try {
            const { data, error: refreshError } = await supabase.auth.refreshSession()

            if (refreshError) {
              console.error('❌ Failed to refresh session:', refreshError)
              setUser(null)
              setProfile(null)
              setAccessToken(null)
              await handleSessionExpiry()
              return false
            }

            if (data.session) {
              setUser(data.session.user)
              setAccessToken(data.session.access_token)
              if (data.session.user) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (data.session.user as any).access_token = data.session.access_token
              }
              return true
            }
            return false
          } finally {
            isRefreshing = false
            refreshPromise = null
          }
        })()

        return refreshPromise
      }

      // Check if token has already expired
      if (expiresAt <= now) {
        isRefreshing = true
        
        refreshPromise = (async () => {
          try {
            const { data, error: refreshError } = await supabase.auth.refreshSession()
            
            if (refreshError || !data.session) {
              console.error('❌ Cannot refresh expired session, logging out')
              await supabase.auth.signOut()
              setUser(null)
              setProfile(null)
              setAccessToken(null)
              profileCache = null
              
              if (typeof window !== 'undefined') {
                window.location.href = '/auth/login?error=session_expired'
              }
              return false
            }
            
            setUser(data.session.user)
            setAccessToken(data.session.access_token)
            if (data.session.user) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (data.session.user as any).access_token = data.session.access_token
            }
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
      console.error('❌ Session validation error:', error)
      isRefreshing = false
      refreshPromise = null
      return false
    }
  }

  useEffect(() => {
    // Track retry count for timeout handling
    let retryCount = 0
    let loadingTimeoutId: NodeJS.Timeout | null = null
    let isInitialized = false
    let isMounted = true

    const setLoadingWithTimeout = () => {
      loadingTimeoutId = setTimeout(async () => {
        if (!isInitialized && loading && isMounted) {
          const shouldStop = await handleAuthTimeout(retryCount)
          if (!shouldStop && isMounted) {
            retryCount++
            // Retry with exponential backoff
            const backoffDelay = Math.min(1000 * Math.pow(2, retryCount), 5000)
            setTimeout(() => {
              if (isMounted && !isInitialized) {
                getUser()
                setLoadingWithTimeout()
              }
            }, backoffDelay)
          }
        }
      }, AUTH_INIT_TIMEOUT)
    }

    const clearLoadingTimeout = () => {
      if (loadingTimeoutId) {
        clearTimeout(loadingTimeoutId)
        loadingTimeoutId = null
      }
      isInitialized = true
    }

    const getUser = async () => {
      try {
        // First try to get the session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()

        // Store access token if present
        setAccessToken(session?.access_token ?? null)
        // Attach to user object if available for backward compatibility
        if (session?.access_token && session?.user) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (session.user as any).access_token = session.access_token
        }

        // If there's a session error related to refresh token, handle gracefully
        if (sessionError) {
          const isRefreshTokenError =
            sessionError.message.includes('refresh_token_not_found') ||
            sessionError.message.includes('Invalid Refresh Token')

          if (isRefreshTokenError) {
            await supabase.auth.signOut()
            if (isMounted) {
              setUser(null)
              setProfile(null)
              setLoading(false)
              clearLoadingTimeout()
            }
            return
          }
        }

        // Get user from session
        const { data: { user }, error } = await supabase.auth.getUser()

        // If there's an auth error (like invalid refresh token), clear the session
        if (error) {
          console.warn('⚠️ Auth error during initialization:', error.message)
          await supabase.auth.signOut()
          if (isMounted) {
            setUser(null)
            setProfile(null)
            setLoading(false)
            clearLoadingTimeout()
          }
          return
        }

        // If no user, set loading to false immediately
        if (!user) {
          if (isMounted) {
            setUser(null)
            setProfile(null)
            setLoading(false)
            clearLoadingTimeout()
          }
          return
        }

        // Attach access token to the user object for components using user.access_token
        if (session?.access_token) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (user as any).access_token = session.access_token
        }
        
        // CRITICAL: Set user but keep loading=true until profile is ready
        // This prevents RoleGuard from seeing null profile and redirecting
        if (isMounted) {
          setUser(user)
        }
        
        // User is authenticated, fetch profile

        // Check profile cache first to avoid redundant fetches
        const now = Date.now()
        if (profileCache &&
          profileCache.userId === user.id &&
          now - profileCache.timestamp < PROFILE_CACHE_TTL) {

          if (isMounted) {
            setProfile(profileCache.profile)
            setLoading(false) // Profile from cache, loading complete
            clearLoadingTimeout()
          }
        } else {
          // Fetch profile from database
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single()

          // Check for error OR missing profile (406 error may not set profileError correctly)
          if (profileError || !profile) {
            console.error('❌ Error fetching profile:', profileError?.message || 'No profile data returned')

            // If profile doesn't exist, the user account is in an invalid state
            // Sign them out and redirect to login with error message
            console.warn('⚠️ User exists in auth but has no profile - redirecting to login')
            await supabase.auth.signOut()
            if (isMounted) {
              setUser(null)
              setProfile(null)
              profileCache = null
              setLoading(false)
              clearLoadingTimeout()
            }

            // Redirect immediately
            if (typeof window !== 'undefined') {
              window.location.replace('/auth/login?error=profile_not_found')
            }
            return
          } else {
            // For teachers and staff, fetch their staff_id
            if (profile.role === 'teacher' || profile.role === 'staff') {
              const { data: staffData } = await supabase
                .from('staff')
                .select('id')
                .eq('profile_id', profile.id)
                .single()
              
              if (staffData) {
                profile.staff_id = staffData.id
              }
            }
            
            // For students, fetch their student_id and campus_id from section
            if (profile.role === 'student') {
              const { data: studentData } = await supabase
                .from('students')
                .select('id, section_id, section:sections(campus_id)')
                .eq('profile_id', profile.id)
                .single()
              
              if (studentData) {
                profile.student_id = studentData.id
                profile.section_id = studentData.section_id
                // @ts-expect-error - section data structure from Supabase query
                profile.campus_id = studentData.section?.campus_id || null
              }
            }
            
            // For parents, fetch their parent_id
            if (profile.role === 'parent') {
              const { data: parentData } = await supabase
                .from('parents')
                .select('id')
                .eq('profile_id', profile.id)
                .single()
              
              if (parentData) {
                profile.parent_id = parentData.id
              }
            }
            
            if (isMounted) {
              setProfile(profile)
              // Cache the profile with timestamp
              profileCache = { profile, userId: user.id, timestamp: now }
              
              // CRITICAL: Only set loading false after profile is loaded
              setLoading(false)
              clearLoadingTimeout()
            }
          }
        }
      } catch (error) {
        console.error('❌ Error fetching user:', error)
        // Clear any invalid session
        await supabase.auth.signOut()
        if (isMounted) {
          setUser(null)
          setProfile(null)
          profileCache = null
          setLoading(false)
          clearLoadingTimeout()
        }
      }
    }

    // Start loading with timeout and fetch user
    setLoadingWithTimeout()
    getUser().finally(() => {
      clearLoadingTimeout()
    })

    // Set up session validation interval (check every 2 minutes for more responsive token refresh)
    const interval = setInterval(() => {
      validateSession()
    }, SESSION_CHECK_INTERVAL) // Use constant - check every 1 minute
    setSessionCheckInterval(interval)

    // Multi-tab synchronization: Listen for storage events
    // When another tab signs out or updates the session, sync this tab
    const handleStorageChange = (event: StorageEvent) => {
      // Supabase stores auth data in localStorage with a specific key pattern
      if (event.key?.includes('auth-token') || event.key?.includes('supabase.auth.token')) {
        // Trigger a session check to sync with the new state
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (!session) {
            setUser(null)
            setProfile(null)
          }
        })
      }
    }

    window.addEventListener('storage', handleStorageChange)

    // Check session when user returns to the tab after being away
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        validateSession()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        // Handle different auth events
        if (_event === 'TOKEN_REFRESHED') {
          // Reset the refresh lock since Supabase handled it
          isRefreshing = false
          refreshPromise = null
        } else if (_event === 'SIGNED_OUT') {
          setUser(null)
          setProfile(null)
          profileCache = null // Clear cache on sign out
          if (sessionCheckInterval) {
            clearInterval(sessionCheckInterval)
          }
          return
        }

        // Set access token and user when session changes
        setAccessToken(session?.access_token ?? null)
        if (session?.user && session?.access_token) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (session.user as any).access_token = session.access_token
        }
        setUser(session?.user ?? null)

        if (session?.user) {
          // Check cache first
          const now = Date.now()
          if (profileCache &&
            profileCache.userId === session.user.id &&
            now - profileCache.timestamp < PROFILE_CACHE_TTL) {
            console.log('✅ Using cached profile (auth state change)')
            setProfile(profileCache.profile)
          } else {
            const { data: profile, error: profileError } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .single()

            console.log('🔍 Profile fetch result (auth state change):', {
              hasProfile: !!profile,
              hasError: !!profileError,
              errorMsg: profileError?.message
            })

            // Check for error OR missing profile
            if (profileError || !profile) {
              console.error('❌ Profile not found - redirecting to login')
              await supabase.auth.signOut()
              setUser(null)
              setProfile(null)
              profileCache = null

              if (typeof window !== 'undefined') {
                window.location.replace('/auth/login?error=profile_not_found')
              }
              return
            }

            setProfile(profile)
            // Update cache
            profileCache = { profile, userId: session.user.id, timestamp: now }
          }
        } else {
          setProfile(null)
          profileCache = null
        }
        setLoading(false)
      }
    )

    return () => {
      isMounted = false
      clearLoadingTimeout()
      subscription.unsubscribe()
      if (interval) {
        clearInterval(interval)
      }
      window.removeEventListener('storage', handleStorageChange)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) throw error
  }

  const signOut = async () => {
    // Immediately clear local state to prevent UI issues
    setUser(null)
    setProfile(null)
    setAccessToken(null)
    profileCache = null
    
    // Abort any pending API requests
    try {
      const { abortAllRequests } = await import('@/lib/api/abortable-fetch')
      abortAllRequests('User logged out')
    } catch {
      // Ignore if module not found
    }
    
    // Clear SWR cache to prevent stale data on re-login
    try {
      const { clearAllSWRCache } = await import('@/lib/swr-config')
      await clearAllSWRCache()
    } catch {
      // Ignore if module not found
    }
    
    // Clear context caches from sessionStorage
    try {
      sessionStorage.removeItem('studently_campus_cache')
      sessionStorage.removeItem('studently_academic_cache')
    } catch {
      // Ignore if sessionStorage not available
    }
    
    // Clear Remember Me credentials on logout
    localStorage.removeItem('studentlyRememberEmail')
    localStorage.removeItem('studentlyRememberPassword')
    
    // Sign out from Supabase
    await supabase.auth.signOut()
    
    // Force redirect to login page
    if (typeof window !== 'undefined') {
      window.location.href = '/auth/login'
    }
  }

  return (
    <AuthContext.Provider value={{ 
      user, 
      profile, 
      loading, 
      access_token: accessToken, 
      signIn, 
      signOut,
      recoverFromError 
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
