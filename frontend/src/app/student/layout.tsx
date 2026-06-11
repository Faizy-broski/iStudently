'use client'

import { DashboardLayout } from '@/components/layouts'
import { AuthLoadingGuard } from '@/components/auth/AuthLoadingGuard'
import { RoleGuard } from '@/components/auth/RoleGuard'
import { SchoolSettingsProvider } from '@/context/SchoolSettingsContext'
import { CampusProvider } from '@/context/CampusContext'

interface StudentLayoutProps {
  children: React.ReactNode
}

export default function StudentLayout({ children }: StudentLayoutProps) {
  return (
    <AuthLoadingGuard>
      <RoleGuard allowedRoles={['student']}>
        <CampusProvider>
          <SchoolSettingsProvider>
            <DashboardLayout role="student">
              {children}
            </DashboardLayout>
          </SchoolSettingsProvider>
        </CampusProvider>
      </RoleGuard>
    </AuthLoadingGuard>
  )
}
