'use client'

import { DashboardLayout } from '@/components/layouts'
import { AuthLoadingGuard } from '@/components/auth/AuthLoadingGuard'
import { RoleGuard } from '@/components/auth/RoleGuard'
import { RefreshOnReturn } from '@/components/RefreshOnReturn'
import { SchoolSettingsProvider } from '@/context/SchoolSettingsContext'

interface StudentLayoutProps {
  children: React.ReactNode
}

export default function StudentLayout({ children }: StudentLayoutProps) {
  return (
    <AuthLoadingGuard>
      <RoleGuard allowedRoles={['student']}>
        <SchoolSettingsProvider>
          <DashboardLayout role="student">
            <RefreshOnReturn>{children}</RefreshOnReturn>
          </DashboardLayout>
        </SchoolSettingsProvider>
      </RoleGuard>
    </AuthLoadingGuard>
  )
}
