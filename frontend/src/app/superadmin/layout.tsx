"use client";

import { DashboardLayout } from "@/components/layouts";

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardLayout role="super_admin">
      {children}
    </DashboardLayout>
  );
}
