'use client'

import { DashboardLayout } from '@/components/layouts'
import { AuthLoadingGuard } from '@/components/auth/AuthLoadingGuard'
import { RoleGuard } from '@/components/auth/RoleGuard'
import { RefreshOnReturn } from '@/components/RefreshOnReturn'

interface StudentLayoutProps {
  children: React.ReactNode
}

export default function StudentLayout({ children }: StudentLayoutProps) {
  return (
    <AuthLoadingGuard>
      <RoleGuard allowedRoles={['student']}>
        <DashboardLayout role="student">
          <RefreshOnReturn>{children}</RefreshOnReturn>
        </DashboardLayout>
      </RoleGuard>
    </AuthLoadingGuard>
  )
}
