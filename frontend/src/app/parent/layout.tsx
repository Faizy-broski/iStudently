'use client'

import { DashboardLayout } from '@/components/layouts'
import { AuthLoadingGuard } from '@/components/auth/AuthLoadingGuard'
import { RoleGuard } from '@/components/auth/RoleGuard'
import { ParentAgreementGuard } from '@/components/auth/ParentAgreementGuard'
import { ParentDashboardProvider } from '@/context/ParentDashboardContext'
import { RefreshOnReturn } from '@/components/RefreshOnReturn'
import { SchoolSettingsProvider } from '@/context/SchoolSettingsContext'

export default function ParentLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthLoadingGuard>
      <RoleGuard allowedRoles={['parent']}>
        <SchoolSettingsProvider>
          <ParentAgreementGuard role="parent">
            <ParentDashboardProvider>
              <DashboardLayout role="parent">
                <RefreshOnReturn>{children}</RefreshOnReturn>
              </DashboardLayout>
            </ParentDashboardProvider>
          </ParentAgreementGuard>
        </SchoolSettingsProvider>
      </RoleGuard>
    </AuthLoadingGuard>
  )
}
