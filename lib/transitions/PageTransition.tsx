"use client";

import { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import { usePathname } from "next/navigation";

type TransitionContextType = {
    isTransitioning: boolean;
    startTransition: () => void;
};

const TransitionContext = createContext<TransitionContextType>({
    isTransitioning: false,
    startTransition: () => { },
});

export function usePageTransition() {
    return useContext(TransitionContext);
}

export function PageTransitionProvider({ children }: { children: ReactNode }) {
    const [isTransitioning, setIsTransitioning] = useState(false);
    const pathname = usePathname();
    const prevPathname = useRef(pathname);

    useEffect(() => {
        if (prevPathname.current !== pathname) {
            setIsTransitioning(true);
            const timer = setTimeout(() => setIsTransitioning(false), 150);
            prevPathname.current = pathname;
            return () => clearTimeout(timer);
        }
    }, [pathname]);

    const startTransition = () => setIsTransitioning(true);

    return (
        <TransitionContext.Provider value={{ isTransitioning, startTransition }}>
            <div
                className={`transition-opacity duration-150 ease-out ${isTransitioning ? "opacity-0" : "opacity-100"
                    }`}
            >
                {children}
            </div>
        </TransitionContext.Provider>
    );
}
