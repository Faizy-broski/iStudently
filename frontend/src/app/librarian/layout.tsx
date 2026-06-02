"use client";

import { DashboardLayout } from "@/components/layouts";
import { CampusProvider } from "@/context/CampusContext";
import { AuthLoadingGuard } from "@/components/auth/AuthLoadingGuard";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { RefreshOnReturn } from "@/components/RefreshOnReturn";
import { SchoolSettingsProvider } from "@/context/SchoolSettingsContext";

export default function LibrarianLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <AuthLoadingGuard>
            <RoleGuard allowedRoles={['librarian']}>
                <SchoolSettingsProvider>
                    <CampusProvider>
                        <DashboardLayout role="librarian">
                            <RefreshOnReturn>{children}</RefreshOnReturn>
                        </DashboardLayout>
                    </CampusProvider>
                </SchoolSettingsProvider>
            </RoleGuard>
        </AuthLoadingGuard>
    );
}
