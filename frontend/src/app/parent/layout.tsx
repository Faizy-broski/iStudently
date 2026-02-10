'use client'

import { DashboardLayout } from '@/components/layouts'
import { AuthLoadingGuard } from '@/components/auth/AuthLoadingGuard'
import { RoleGuard } from '@/components/auth/RoleGuard'
import { ParentDashboardProvider } from '@/context/ParentDashboardContext'
import { RefreshOnReturn } from '@/components/RefreshOnReturn'

export default function ParentLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthLoadingGuard>
      <RoleGuard allowedRoles={['parent']}>
        <ParentDashboardProvider>
          <DashboardLayout role="parent">
            <RefreshOnReturn>{children}</RefreshOnReturn>
          </DashboardLayout>
        </ParentDashboardProvider>
      </RoleGuard>
    </AuthLoadingGuard>
  )
}
