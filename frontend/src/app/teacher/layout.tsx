"use client"

import { DashboardLayout } from "@/components/layouts"
import { AuthLoadingGuard } from "@/components/auth/AuthLoadingGuard";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { RefreshOnReturn } from "@/components/RefreshOnReturn";
import { SchoolSettingsProvider } from "@/context/SchoolSettingsContext";
import { CampusProvider } from "@/context/CampusContext";

export default function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthLoadingGuard>
      <RoleGuard allowedRoles={['teacher']}>
        <CampusProvider>
          <SchoolSettingsProvider>
            <DashboardLayout role="teacher">
              <RefreshOnReturn>{children}</RefreshOnReturn>
            </DashboardLayout>
          </SchoolSettingsProvider>
        </CampusProvider>
      </RoleGuard>
    </AuthLoadingGuard>
  );
}
