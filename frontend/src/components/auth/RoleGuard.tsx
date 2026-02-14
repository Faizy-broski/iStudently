'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { UserRole } from '@/types'

interface RoleGuardProps {
  children: React.ReactNode
  allowedRoles: UserRole[]
  redirectTo?: string
}

export function RoleGuard({ children, allowedRoles, redirectTo }: RoleGuardProps) {
  const { profile, loading, profileFetchPending } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading) {
      // CRITICAL: If profile fetch is pending (server was unavailable, retrying)
      // Do NOT redirect - wait for the retry to complete
      if (profileFetchPending) {
        console.log('⏳ Profile fetch pending (server may have been unavailable), waiting for retry...')
        return
      }
      
      // If no profile after loading, redirect to login (clean redirect, no error)
      if (!profile) {
        console.log('🔒 No profile found, redirecting to login')
        router.replace('/auth/login')
        return
      }

      // Check if user's role is in the allowed roles
      if (!allowedRoles.includes(profile.role)) {
        // Redirect to user's appropriate dashboard or custom redirect
        if (redirectTo) {
          router.replace(redirectTo)
        } else {
          // Default redirection based on user's role
          const roleRedirects: Record<UserRole, string> = {
            super_admin: '/superadmin/dashboard',
            admin: '/admin/dashboard',
            teacher: '/teacher/dashboard',
            student: '/student/dashboard',
            parent: '/parent/dashboard',
            staff: '/staff/dashboard',
            librarian: '/librarian/dashboard'
          }
          router.replace(roleRedirects[profile.role] || '/')
        }
      }
    }
  }, [profile, loading, profileFetchPending, allowedRoles, redirectTo, router])

  // Show minimal loading state while checking authentication or profile fetch pending
  if (loading || profileFetchPending) {
    return (
      <>
        {children}
      </>
    )
  }

  // If user doesn't have permission, redirect immediately
  if (profile && !allowedRoles.includes(profile.role)) {
    return null
  }

  // If authentication is not loaded yet
  if (!profile) {
    return null
  }

  return <>{children}</>
}
