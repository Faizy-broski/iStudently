"use client"

import { DashboardLayout } from "@/components/layouts"
import { AuthLoadingGuard } from "@/components/auth/AuthLoadingGuard"
import { RoleGuard } from "@/components/auth/RoleGuard"
import { RefreshOnReturn } from "@/components/RefreshOnReturn"
import { SchoolSettingsProvider } from "@/context/SchoolSettingsContext"

// Fina Supervisor portal shell — Al-Fina' module's municipal oversight role
// (Phase 5). Deliberately does NOT wrap children in CampusProvider: like
// inspector, this role's scope (every school in its municipality, via
// fina_supervisor_accounts) can span unrelated school trees entirely, not
// the admin/teacher/parent single-tree campus hierarchy that context models.
export default function FinaSupervisorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthLoadingGuard>
      <RoleGuard allowedRoles={["fina_supervisor"]}>
        <SchoolSettingsProvider>
          <DashboardLayout role="fina_supervisor">
            <RefreshOnReturn>{children}</RefreshOnReturn>
          </DashboardLayout>
        </SchoolSettingsProvider>
      </RoleGuard>
    </AuthLoadingGuard>
  )
}
