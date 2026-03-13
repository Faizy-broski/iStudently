"use client"

import { DashboardLayout } from "@/components/layouts"
import { AuthLoadingGuard } from "@/components/auth/AuthLoadingGuard";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { RefreshOnReturn } from "@/components/RefreshOnReturn";
import { SchoolSettingsProvider } from "@/context/SchoolSettingsContext";

export default function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthLoadingGuard>
      <RoleGuard allowedRoles={['teacher']}>
        <SchoolSettingsProvider>
          <DashboardLayout role="teacher">
            <RefreshOnReturn>{children}</RefreshOnReturn>
          </DashboardLayout>
        </SchoolSettingsProvider>
      </RoleGuard>
    </AuthLoadingGuard>
  );
}
