'use client'

import { DashboardLayout } from '@/components/layouts'
import { AuthLoadingGuard } from '@/components/auth/AuthLoadingGuard'
import { RoleGuard } from '@/components/auth/RoleGuard'
import { ParentAgreementGuard } from '@/components/auth/ParentAgreementGuard'
import { RefreshOnReturn } from '@/components/RefreshOnReturn'
import { SchoolSettingsProvider } from '@/context/SchoolSettingsContext'
import { CampusProvider } from '@/context/CampusContext'

interface StudentLayoutProps {
  children: React.ReactNode
}

export default function StudentLayout({ children }: StudentLayoutProps) {
  return (
    <AuthLoadingGuard>
      <RoleGuard allowedRoles={['student']}>
        <SchoolSettingsProvider>
          <CampusProvider>
            <ParentAgreementGuard role="student">
              <DashboardLayout role="student">
                <RefreshOnReturn>{children}</RefreshOnReturn>
              </DashboardLayout>
            </ParentAgreementGuard>
          </CampusProvider>
        </SchoolSettingsProvider>
      </RoleGuard>
    </AuthLoadingGuard>
  )
}
