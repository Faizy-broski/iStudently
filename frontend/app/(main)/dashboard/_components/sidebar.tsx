"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    School,
    GraduationCap,
    CreditCard,
    Settings,
    Menu,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import clsx from "clsx";
import Image from "next/image";

const menu = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Schools List", href: "/dashboard/schools-list", icon: School },
    {
        name: "Schools Management",
        href: "/dashboard/schools-management",
        icon: GraduationCap,
    },
    { name: "Subscription", href: "/dashboard/subscriptions", icon: CreditCard },
    { name: "Settings", href: "/dashboard/settings", icon: Settings },
];

function SidebarContent() {
    const pathname = usePathname();

    return (
        <div className="relative flex h-full flex-col rounded-br-4xl overflow-hidden p-4 ps-12 text-white">
            {/* Gradient */}
            <div className="absolute inset-0 z-0 bg-gradient-to-b from-[#57A3CC] to-[#022172]" />

            {/* Background image */}
            <div className="absolute inset-0 z-0 bg-[url('/sidebar-image.png')] bg-cover bg-center opacity-10" />

            {/* Content */}
            <div className="relative z-10 flex h-full flex-col">
                {/* Logo */}
                <div className="mb-6 flex items-center gap-3">
                    <Image src="/logo.png" alt="Logo" width={40} height={40} />
                    <div>
                        <p className="text-sm font-semibold">ISTUDENTS.LY</p>
                        <p className="text-xs text-white/70">Education ERP</p>
                    </div>
                </div>

                {/* Menu */}
                <nav className="flex-1 space-y-1">
                    {menu.map((item) => {
                        const isActive = pathname === item.href;

                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={clsx(
                                    "flex items-center gap-3 rounded-xl px-4 py-2 text-sm transition",
                                    isActive
                                        ? "bg-white text-blue-700 shadow"
                                        : "text-white/80 hover:bg-white/10"
                                )}
                            >
                                <item.icon className="h-4 w-4" />
                                {item.name}
                            </Link>
                        );
                    })}
                </nav>

                {/* Footer */}
                <p className="mt-4 text-center text-xs text-white/60">
                    © 2026 istudents.ly
                </p>
            </div>
        </div>
    );
}


export default function DashboardSidebar() {
    return (
        <>
            {/* Desktop Sidebar */}
            <aside className="hidden h-screen w-72 md:block">
                <SidebarContent />
            </aside>

            {/* Mobile Sidebar */}
            <div className="fixed left-4 top-4 z-50 md:hidden">
                <Sheet>
                    <SheetTrigger asChild>
                        <Button size="icon" variant="outline">
                            <Menu className="h-5 w-5" />
                        </Button>
                    </SheetTrigger>

                    <SheetContent side="left" className="w-80 border-none p-4">
                        <SidebarContent />
                    </SheetContent>
                </Sheet>
            </div>
        </>
    );
}