"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, TrendingUp, Fingerprint, Users, User } from "lucide-react";

const navItems = [
    { href: "/dashboard", icon: Home, label: "HOME" },
    { href: "/invest", icon: TrendingUp, label: "INVEST" },
    { href: "/eid", icon: Fingerprint, label: "E-ID" },
    { href: "/team", icon: Users, label: "TEAM" },
    { href: "/profile", icon: User, label: "PROFILE" },
];

export default function StudentBottomNav() {
    const pathname = usePathname();

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#0A0A0A] border-t border-primary/20">
            <div className="flex justify-around items-center max-w-lg mx-auto px-4 py-3">
                {navItems.map((item) => {
                    const isActive = pathname === item.href;

                    return (
                        <Link
                            key={item.label}
                            href={item.href}
                            className="flex flex-col items-center gap-1.5 group min-w-15"
                        >
                            <div className={`p-2 rounded-lg transition-all ${
                                isActive ? "bg-primary/20" : "bg-transparent"
                            }`}>
                                <item.icon
                                    className={`w-5 h-5 transition-colors ${
                                        isActive ? "text-primary" : "text-gray-600 group-hover:text-gray-400"
                                    }`}
                                    strokeWidth={1.5}
                                />
                            </div>
                            <span
                                className={`text-[8px] font-mono uppercase tracking-wider transition-colors ${
                                    isActive ? "text-primary" : "text-gray-700 group-hover:text-gray-500"
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
