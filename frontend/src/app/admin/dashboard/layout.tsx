"use client";

import { DashboardLayout } from "@/components/layouts";

export default function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardLayout role="admin">
      {children}
    </DashboardLayout>
  );
}
