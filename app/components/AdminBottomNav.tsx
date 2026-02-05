"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, Upload, Settings } from "lucide-react";

const navItems = [
    { href: "/admin/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/admin/bulk-import", icon: Upload, label: "Import" },
    { href: "/admin/settings", icon: Settings, label: "Settings" },
];

export default function AdminBottomNav() {
    const pathname = usePathname();

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-surface-elevated/95 backdrop-blur-md border-t border-[#262626] pb-6 pt-3 px-6">
            <div className="flex justify-between items-center max-w-lg mx-auto">
                {navItems.map((item) => {
                    const isActive = pathname === item.href ||
                        (item.label === "Dashboard" && pathname === "/admin/dashboard") ||
                        (item.label === "Import" && pathname.startsWith("/admin/bulk-import")) ||
                        (item.label === "Settings" && pathname.startsWith("/admin/settings"));

                    return (
                        <Link
                            key={item.label}
                            href={item.href}
                            className="flex flex-col items-center gap-1 group w-16"
                        >
                            <item.icon
                                className={`w-6 h-6 transition-colors ${isActive ? "text-primary" : "text-gray-500 group-hover:text-gray-300"
                                    }`}
                            />
                            <span
                                className={`text-[9px] font-medium uppercase tracking-wider transition-colors ${isActive ? "text-primary" : "text-gray-500 group-hover:text-gray-300"
                                    }`}
                            >
                                {item.label}
                            </span>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
