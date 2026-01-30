'use client'

import { DashboardLayout } from '@/components/layouts'
import { AuthLoadingGuard } from '@/components/auth/AuthLoadingGuard'
import { RoleGuard } from '@/components/auth/RoleGuard'
import { ParentDashboardProvider } from '@/context/ParentDashboardContext'

export default function ParentLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthLoadingGuard>
      <RoleGuard allowedRoles={['parent']}>
        <ParentDashboardProvider>
          <DashboardLayout role="parent">{children}</DashboardLayout>
        </ParentDashboardProvider>
      </RoleGuard>
    </AuthLoadingGuard>
  )
}
