"use client";

import { DashboardLayout } from "@/components/layouts";

export default function ProfileLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // Profile page uses the user's actual role from auth context
    return <DashboardLayout>{children}</DashboardLayout>;
}
