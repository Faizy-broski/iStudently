"use client";

import { DashboardLayout } from "@/components/layouts";
import { CampusProvider } from "@/context/CampusContext";
import { AuthLoadingGuard } from "@/components/auth/AuthLoadingGuard";
import { RoleGuard } from "@/components/auth/RoleGuard";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthLoadingGuard>
      <RoleGuard allowedRoles={['admin']}>
        <CampusProvider>
          <DashboardLayout role="admin">{children}</DashboardLayout>
        </CampusProvider>
      </RoleGuard>
    </AuthLoadingGuard>
  );
}
