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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [sessionCheckInterval, setSessionCheckInterval] = useState<NodeJS.Timeout | null>(null)

  // Validate and refresh session periodically with race condition prevention
  const validateSession = async (): Promise<boolean> => {
    // If already refreshing, wait for that operation to complete
    if (isRefreshing && refreshPromise) {
      return refreshPromise
    }

    try {
      const { data: { session }, error } = await supabase.auth.getSession()
      
      if (error || !session) {
        // Session is invalid, clear state
        setUser(null)
        setProfile(null)
        return false
      }
      
      // CRITICAL: Use server-provided expires_at (already in seconds since epoch)
      // This prevents clock drift issues between client and server
      const expiresAt = session.expires_at ? session.expires_at * 1000 : 0
      const now = Date.now()
      const fiveMinutes = 5 * 60 * 1000
      
      // Only refresh if expiring within 5 minutes AND not already refreshing
      if (expiresAt - now < fiveMinutes && expiresAt > now) {
        // Prevent multiple simultaneous refresh attempts
        if (isRefreshing) {
          return refreshPromise || Promise.resolve(true)
        }
        
        console.log('🔄 Session expiring soon, refreshing...')
        isRefreshing = true
        
        // Store the refresh promise so other calls can wait for it
        refreshPromise = (async () => {
          try {
            const { data, error: refreshError } = await supabase.auth.refreshSession()
            
            if (refreshError) {
              console.error('❌ Failed to refresh session:', refreshError)
              await supabase.auth.signOut()
              setUser(null)
              setProfile(null)
              return false
            }
            
            if (data.user) {
              setUser(data.user)
              console.log('✅ Session refreshed successfully')
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
      
      return true
    } catch (error) {
      console.error('❌ Session validation error:', error)
      isRefreshing = false
      refreshPromise = null
      return false
    }
  }

  useEffect(() => {
    const getUser = async () => {
      try {
        // First try to get the session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        // If there's a session error related to refresh token, handle gracefully
        if (sessionError) {
          const isRefreshTokenError = 
            sessionError.message.includes('refresh_token_not_found') ||
            sessionError.message.includes('Invalid Refresh Token')
          
          if (isRefreshTokenError) {
            console.log('🔄 Refresh token expired or invalid, clearing session')
            await supabase.auth.signOut()
            setUser(null)
            setProfile(null)
            setLoading(false)
            return
          }
        }
        
        // Get user from session
        const { data: { user }, error } = await supabase.auth.getUser()
        
        // If there's an auth error (like invalid refresh token), clear the session
        if (error) {
          console.warn('⚠️ Auth error during initialization:', error.message)
          await supabase.auth.signOut()
          setUser(null)
          setProfile(null)
          setLoading(false)
          return
        }
        
        setUser(user)

        if (user) {
          // Wait a bit to ensure session is fully ready before fetching profile
          // This prevents race conditions with RLS policies
          await new Promise(resolve => setTimeout(resolve, 100))
          
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single()
          
          if (profileError) {
            console.error('❌ Error fetching profile:', profileError)
          }
          
          setProfile(profile)
        }
      } catch (error) {
        console.error('Error fetching user:', error)
        // Clear any invalid session
        await supabase.auth.signOut()
        setUser(null)
        setProfile(null)
      } finally {
        setLoading(false)
      }
    }

    getUser()

    // Set up session validation interval (check every 5 minutes)
    const interval = setInterval(() => {
      validateSession()
    }, 5 * 60 * 1000)
    setSessionCheckInterval(interval)

    // Multi-tab synchronization: Listen for storage events
    // When another tab signs out or updates the session, sync this tab
    const handleStorageChange = (event: StorageEvent) => {
      // Supabase stores auth data in localStorage with a specific key pattern
      if (event.key?.includes('auth-token') || event.key?.includes('supabase.auth.token')) {
        console.log('🔄 Auth state changed in another tab, syncing...')
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        console.log('🔄 Auth state changed:', _event)
        
        // Handle different auth events
        if (_event === 'TOKEN_REFRESHED') {
          console.log('✅ Token refreshed successfully')
          // Reset the refresh lock since Supabase handled it
          isRefreshing = false
          refreshPromise = null
        } else if (_event === 'SIGNED_OUT') {
          console.log('👋 User signed out')
          setUser(null)
          setProfile(null)
          if (sessionCheckInterval) {
            clearInterval(sessionCheckInterval)
          }
          return
        }
        
        setUser(session?.user ?? null)
        
        if (session?.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single()
          
          setProfile(profile)
        } else {
          setProfile(null)
        }
        setLoading(false)
      }
    )

    return () => {
      subscription.unsubscribe()
      if (interval) {
        clearInterval(interval)
      }
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) throw error
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signOut }}>
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
