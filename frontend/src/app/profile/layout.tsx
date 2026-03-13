"use client";

import { DashboardLayout } from "@/components/layouts";
import { SchoolSettingsProvider } from "@/context/SchoolSettingsContext";

export default function ProfileLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // Profile page uses the user's actual role from auth context
    return (
        <SchoolSettingsProvider>
            <DashboardLayout>{children}</DashboardLayout>
        </SchoolSettingsProvider>
    );
}
