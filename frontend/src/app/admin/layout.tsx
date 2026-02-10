"use client";

import { DashboardLayout } from "@/components/layouts";
import { CampusProvider } from "@/context/CampusContext";
import { ProfileViewProvider } from "@/context/ProfileViewContext";
import { AuthLoadingGuard } from "@/components/auth/AuthLoadingGuard";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { RefreshOnReturn } from "@/components/RefreshOnReturn";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthLoadingGuard>
      <RoleGuard allowedRoles={['admin']}>
        <CampusProvider>
          <ProfileViewProvider>
            <DashboardLayout role="admin">
              <RefreshOnReturn>{children}</RefreshOnReturn>
            </DashboardLayout>
          </ProfileViewProvider>
        </CampusProvider>
      </RoleGuard>
    </AuthLoadingGuard>
  );
}
