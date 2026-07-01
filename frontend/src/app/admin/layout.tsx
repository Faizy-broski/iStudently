"use client";

import { DashboardLayout } from "@/components/layouts";
import { CampusProvider } from "@/context/CampusContext";
import { ProfileViewProvider } from "@/context/ProfileViewContext";
import { SchoolSettingsProvider } from "@/context/SchoolSettingsContext";
import { AuthLoadingGuard } from "@/components/auth/AuthLoadingGuard";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { RefreshOnReturn } from "@/components/RefreshOnReturn";
import { ImpersonationBanner } from "@/components/admin/ImpersonationBanner";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthLoadingGuard>
      <RoleGuard allowedRoles={['admin', 'super_admin']}>
        <CampusProvider>
          <ProfileViewProvider>
            <SchoolSettingsProvider>
              <ImpersonationBanner />
              <DashboardLayout role="admin">
                <RefreshOnReturn>{children}</RefreshOnReturn>
              </DashboardLayout>
            </SchoolSettingsProvider>
          </ProfileViewProvider>
        </CampusProvider>
      </RoleGuard>
    </AuthLoadingGuard>
  );
}
