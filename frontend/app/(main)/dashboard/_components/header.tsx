import { Button } from "@/components/ui/button";

export default function DashboardHeader() {
  return (
    <header className="flex h-16 items-center justify-between border-b bg-background px-6">
      <span className="font-medium">Welcome back 👋</span>

      <Button size="sm">Logout</Button>
    </header>
  );
}