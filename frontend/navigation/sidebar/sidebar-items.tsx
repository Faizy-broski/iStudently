import {
  LayoutDashboard,
  School,
  ClipboardList,
  CreditCard,
  Settings,
} from "lucide-react";

export const sidebar = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Schools List",
    href: "/dashboard/schools",
    icon: School,
  },
  {
    title: "Schools Management",
    href: "/dashboard/schools-management",
    icon: ClipboardList,
  },
  {
    title: "Subscriptions",
    href: "/dashboard/subscriptions",
    icon: CreditCard,
  },
  {
    title: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
  },
];