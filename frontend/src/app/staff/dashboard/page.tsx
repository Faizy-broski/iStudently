'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

// Staff accounts have no dedicated /staff/* pages: they use the admin app shell, scoped
// down by their User Profile. Login/2FA/RoleGuard all send role "staff" here, so forward
// them to the shared dashboard.
export default function StaffDashboardRedirect() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/admin/dashboard')
  }, [router])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  )
}
