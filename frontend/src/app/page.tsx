'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'

export default function Page() {
  const router = useRouter()
  const { user, profile, loading } = useAuth()

  useEffect(() => {
    // Skip if still loading
    if (loading) return

    // Not authenticated, go to login
    if (!user) {
      router.replace('/auth/login')
      return
    }

    // Has profile, go to dashboard
    if (profile?.role) {
      const dashboardMap: Record<string, string> = {
        'super_admin': '/superadmin/dashboard',
        'admin': '/admin/dashboard',
        'teacher': '/teacher/dashboard',
        'student': '/student/dashboard',
        'parent': '/parent/dashboard',
      }
      
      const url = dashboardMap[profile.role] || '/auth/login?error=role_not_supported'
      router.replace(url)
    }
  }, [user, profile, loading, router])

  // Show loading while redirecting
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  )
}