"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Building2, Users, Layers, FileText } from "lucide-react";

const navItems = [
    { href: "/super-admin/dashboard", icon: LayoutDashboard, label: "SYSTEM" },
    { href: "/super-admin/clusters", icon: Layers, label: "CLUSTERS" },
    { href: "/super-admin/colleges", icon: Building2, label: "GATE" },
    { href: "/super-admin/colleges/create", icon: Users, label: "USERS" },
    { href: "/super-admin/logs", icon: FileText, label: "LOGS" },
];

export default function SuperAdminBottomNav() {
    const pathname = usePathname();

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#0A0A0A]/95 backdrop-blur-md border-t border-[#262626] pb-6 pt-3 px-4">
            <div className="flex justify-between items-center max-w-lg mx-auto">
                {navItems.map((item) => {
                    const isActive = pathname === item.href ||
                        pathname.startsWith(item.href + '/');

                    return (
                        <Link
                            key={item.label}
                            href={item.href}
                            className="flex flex-col items-center gap-1 group"
                        >
                            <div className={`p-2 transition-colors ${isActive ? "bg-primary/20" : ""}`}>
                                <item.icon
                                    className={`w-5 h-5 transition-colors ${isActive ? "text-primary" : "text-gray-600 group-hover:text-gray-400"}`}
                                    strokeWidth={1.5}
                                />
                            </div>
                            <span
                                className={`text-[8px] font-mono uppercase tracking-wider transition-colors ${isActive ? "text-primary" : "text-gray-700 group-hover:text-gray-500"}`}
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
