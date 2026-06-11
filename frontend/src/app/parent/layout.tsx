'use client'

import { DashboardLayout } from '@/components/layouts'
import { AuthLoadingGuard } from '@/components/auth/AuthLoadingGuard'
import { RoleGuard } from '@/components/auth/RoleGuard'
import { ParentDashboardProvider } from '@/context/ParentDashboardContext'
import { RefreshOnReturn } from '@/components/RefreshOnReturn'
import { SchoolSettingsProvider } from '@/context/SchoolSettingsContext'
import { CampusProvider } from '@/context/CampusContext'

export default function ParentLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthLoadingGuard>
      <RoleGuard allowedRoles={['parent']}>
        <CampusProvider>
          <SchoolSettingsProvider>
            <ParentDashboardProvider>
              <DashboardLayout role="parent">
                <RefreshOnReturn>{children}</RefreshOnReturn>
              </DashboardLayout>
            </ParentDashboardProvider>
          </SchoolSettingsProvider>
        </CampusProvider>
      </RoleGuard>
    </AuthLoadingGuard>
  )
}
