import { ReactNode } from "react";
import DashboardSidebar from "./_components/sidebar";
import DashboardHeader from "./_components/header";

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-muted/40">
      {/* Sidebar */}
      <DashboardSidebar />

      {/* Main Content */}
      <div className="flex flex-1 flex-col">
        <DashboardHeader />
        

        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}