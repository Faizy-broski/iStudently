'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { Loader2 } from 'lucide-react'

/**
 * OAuth Callback Page
 *
 * Handles the redirect from Google/Microsoft OAuth.
 * Supabase automatically exchanges the code for a session (PKCE flow).
 * AuthContext.onAuthStateChange('SIGNED_IN') fires, fetches profile,
 * and this page redirects to the appropriate dashboard.
 *
 * If no profile is found (user not pre-registered), shows an error.
 */
export default function AuthCallbackPage() {
  const router = useRouter()
  const { user, profile, loading, mustChangePassword } = useAuth()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Wait for auth to finish loading
    if (loading) return

    // Check URL for error from backend OAuth or Supabase
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      const queryError = urlParams.get('error')
      if (queryError) {
        setError(decodeURIComponent(queryError))
        return
      }

      const hash = window.location.hash
      const params = new URLSearchParams(hash.replace('#', '?'))
      const errorDesc = params.get('error_description')
      if (errorDesc) {
        setError(decodeURIComponent(errorDesc))
        return
      }
    }

    // If user is authenticated and profile is loaded, redirect to dashboard
    if (user && profile?.role) {
      if (mustChangePassword) {
        router.replace('/auth/change-password')
        return
      }

      const dashboardMap: Record<string, string> = {
        'super_admin': '/superadmin/dashboard',
        'admin': '/admin/dashboard',
        'teacher': '/teacher/dashboard',
        'student': '/student/dashboard',
        'parent': '/parent/dashboard',
        'librarian': '/librarian/dashboard',
        'staff': '/staff/dashboard',
      }
      const dashboardUrl = dashboardMap[profile.role] || '/admin/dashboard'
      router.replace(dashboardUrl)
      return
    }

    // User exists but no profile — not pre-registered
    if (user && !profile && !loading) {
      // Wait a bit for profile to load (onAuthStateChange might still be processing)
      const timeout = setTimeout(() => {
        if (!profile) {
          setError('No account found for this email. Please contact your administrator to create an account first.')
        }
      }, 5000)
      return () => clearTimeout(timeout)
    }

    // No user at all after loading — something went wrong
    if (!user && !loading) {
      setError('Authentication failed. Please try again.')
    }
  }, [user, profile, loading, mustChangePassword, router])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="max-w-md w-full px-6 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-50 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Sign In Failed</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => router.replace('/auth/login')}
            className="inline-flex items-center px-4 py-2 bg-[#022172] text-white rounded-lg hover:bg-[#022172]/90 transition-colors"
          >
            Back to Login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#022172] mx-auto mb-4" />
        <p className="text-gray-600">Completing sign in...</p>
      </div>
    </div>
  )
}
