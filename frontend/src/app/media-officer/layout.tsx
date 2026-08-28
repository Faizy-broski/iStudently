"use client"

import { DashboardLayout } from "@/components/layouts"
import { AuthLoadingGuard } from "@/components/auth/AuthLoadingGuard"
import { RoleGuard } from "@/components/auth/RoleGuard"
import { RefreshOnReturn } from "@/components/RefreshOnReturn"
import { SchoolSettingsProvider } from "@/context/SchoolSettingsContext"
import { CampusProvider } from "@/context/CampusContext"

// Media Officer portal shell — the Al-Fina' module's first-review
// moderation role. Single-school scoped like teacher/admin (not a
// cross-campus grant list like inspector), so this includes CampusProvider.
export default function MediaOfficerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthLoadingGuard>
      <RoleGuard allowedRoles={["media_officer"]}>
        <CampusProvider>
          <SchoolSettingsProvider>
            <DashboardLayout role="media_officer">
              <RefreshOnReturn>{children}</RefreshOnReturn>
            </DashboardLayout>
          </SchoolSettingsProvider>
        </CampusProvider>
      </RoleGuard>
    </AuthLoadingGuard>
  )
}
