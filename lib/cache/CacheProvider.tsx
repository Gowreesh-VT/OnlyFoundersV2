"use client";

import React, { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';

type CacheData = {
    data: unknown;
    timestamp: number;
    expiresIn: number;
};

type CacheContextType = {
    get: <T>(key: string) => T | null;
    set: <T>(key: string, data: T, expiresInMs?: number) => void;
    invalidate: (key: string) => void;
    invalidateAll: () => void;
};

const CacheContext = createContext<CacheContextType | null>(null);

const DEFAULT_CACHE_TIME = 5 * 60 * 1000; // 5 minutes

export function CacheProvider({ children }: { children: ReactNode }) {
    const cacheRef = useRef<Map<string, CacheData>>(new Map());

    const get = useCallback(<T,>(key: string): T | null => {
        const cached = cacheRef.current.get(key);
        if (!cached) return null;

        const now = Date.now();
        if (now - cached.timestamp > cached.expiresIn) {
            cacheRef.current.delete(key);
            return null;
        }

        return cached.data as T;
    }, []);

    const set = useCallback(<T,>(key: string, data: T, expiresInMs = DEFAULT_CACHE_TIME) => {
        cacheRef.current.set(key, {
            data,
            timestamp: Date.now(),
            expiresIn: expiresInMs,
        });
    }, []);

    const invalidate = useCallback((key: string) => {
        cacheRef.current.delete(key);
    }, []);

    const invalidateAll = useCallback(() => {
        cacheRef.current.clear();
    }, []);

    return (
        <CacheContext.Provider value={{ get, set, invalidate, invalidateAll }}>
            {children}
        </CacheContext.Provider>
    );
}

export function useCache() {
    const context = useContext(CacheContext);
    if (!context) {
        // Return a no-op cache if not in provider (for SSR safety)
        return {
            get: <T,>(_key: string): T | null => null,
            set: <T,>(_key: string, _data: T, _expiresInMs?: number) => { },
            invalidate: (_key: string) => { },
            invalidateAll: () => { },
        };
    }
    return context;
}

// Simple hook for fetching with cache - fixed version
export function useCachedFetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    options?: { cacheTime?: number }
) {
    const cache = useCache();
    const [data, setData] = useState<T | null>(() => cache.get<T>(key));
    const [loading, setLoading] = useState(!cache.get<T>(key));
    const [error, setError] = useState<Error | null>(null);
    const fetchedRef = useRef(false);

    const refetch = useCallback(async (skipCache = false) => {
        if (!skipCache) {
            const cached = cache.get<T>(key);
            if (cached) {
                setData(cached);
                setLoading(false);
                return cached;
            }
        }

        setLoading(true);
        setError(null);

        try {
            const result = await fetcher();
            setData(result);
            cache.set(key, result, options?.cacheTime);
            return result;
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Fetch failed');
            setError(error);
            return null;
        } finally {
            setLoading(false);
        }
    }, [key, fetcher, cache, options?.cacheTime]);

    // Auto-fetch on mount
    React.useEffect(() => {
        if (!fetchedRef.current) {
            fetchedRef.current = true;
            refetch();
        }
    }, [refetch]);

    const invalidate = useCallback(() => {
        cache.invalidate(key);
        fetchedRef.current = false;
        return refetch(true);
    }, [cache, key, refetch]);

    return { data, loading, error, refetch, invalidate };
}
