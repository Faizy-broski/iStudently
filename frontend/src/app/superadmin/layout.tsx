"use client";

import { DashboardLayout } from "@/components/layouts";
import { RoleGuard } from "@/components/auth/RoleGuard";

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RoleGuard allowedRoles={['super_admin']}>
      <DashboardLayout role="super_admin">
        {children}
      </DashboardLayout>
    </RoleGuard>
  );
}
