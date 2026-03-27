'use client'

import { DashboardLayout } from '@/components/layouts'
import { AuthLoadingGuard } from '@/components/auth/AuthLoadingGuard'
import { RoleGuard } from '@/components/auth/RoleGuard'
import { ParentAgreementGuard } from '@/components/auth/ParentAgreementGuard'
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
          <ParentAgreementGuard role="student">
            <DashboardLayout role="student">
              <RefreshOnReturn>{children}</RefreshOnReturn>
            </DashboardLayout>
          </ParentAgreementGuard>
        </SchoolSettingsProvider>
      </RoleGuard>
    </AuthLoadingGuard>
  )
}
