"use client";

import { CacheProvider } from "@/lib/cache/CacheProvider";
import { PageTransitionProvider } from "@/lib/transitions/PageTransition";
import { AuthProvider } from "@/lib/mongodb/auth-context";
import { ReactNode } from "react";

export default function Providers({ children }: { children: ReactNode }) {
    return (
        <AuthProvider>
            <CacheProvider>
                <PageTransitionProvider>
                    {children}
                </PageTransitionProvider>
            </CacheProvider>
        </AuthProvider>
    );
}
