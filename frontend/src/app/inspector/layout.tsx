"use client";

import { DashboardLayout } from "@/components/layouts";
import { AuthLoadingGuard } from "@/components/auth/AuthLoadingGuard";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { RefreshOnReturn } from "@/components/RefreshOnReturn";
import { SchoolSettingsProvider } from "@/context/SchoolSettingsContext";

// Inspector portal shell — Phase 0 of the Educational Inspection module.
//
// Deliberately does NOT wrap children in CampusProvider: that context scopes
// a "campus switcher" to the caller's own school_id and its direct children
// (the admin/teacher/parent campus hierarchy), but an inspector's set of
// visitable campuses comes from inspector_school_assignments and can span
// campuses under different parent schools entirely. A dedicated
// inspector-campus context (backed by /inspectors/me/schools) is added when
// a later phase actually needs campus-switching UI in this portal.
export default function InspectorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthLoadingGuard>
      <RoleGuard allowedRoles={["inspector"]}>
        <SchoolSettingsProvider>
          <DashboardLayout role="inspector">
            <RefreshOnReturn>{children}</RefreshOnReturn>
          </DashboardLayout>
        </SchoolSettingsProvider>
      </RoleGuard>
    </AuthLoadingGuard>
  );
}
