"use client";

import { DashboardLayout } from "@/components/layouts";
import { AuthLoadingGuard } from "@/components/auth/AuthLoadingGuard";
import { RoleGuard } from "@/components/auth/RoleGuard";

export default function LibrarianLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <AuthLoadingGuard>
            <RoleGuard allowedRoles={['librarian']}>
                <DashboardLayout role="librarian">{children}</DashboardLayout>
            </RoleGuard>
        </AuthLoadingGuard>
    );
}
