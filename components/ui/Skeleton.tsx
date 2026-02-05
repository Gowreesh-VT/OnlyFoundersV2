"use client";

export function SkeletonCard({ className = "" }: { className?: string }) {
    return (
        <div className={`bg-[#121212] border border-[#262626] rounded-xl p-4 animate-pulse ${className}`}>
            <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-[#262626]" />
                <div className="flex-1">
                    <div className="h-4 bg-[#262626] rounded w-2/3 mb-2" />
                    <div className="h-3 bg-[#262626] rounded w-1/2" />
                </div>
            </div>
            <div className="space-y-2">
                <div className="h-3 bg-[#262626] rounded w-full" />
                <div className="h-3 bg-[#262626] rounded w-4/5" />
            </div>
        </div>
    );
}

export function SkeletonRow({ className = "" }: { className?: string }) {
    return (
        <div className={`px-4 py-4 flex items-center justify-between border-b border-[#262626] animate-pulse ${className}`}>
            <div className="flex-1">
                <div className="h-4 bg-[#262626] rounded w-32 mb-2" />
                <div className="h-3 bg-[#262626] rounded w-24" />
            </div>
            <div className="w-12 flex justify-center">
                <div className="w-5 h-5 bg-[#262626] rounded" />
            </div>
            <div className="w-24">
                <div className="h-6 bg-[#262626] rounded" />
            </div>
        </div>
    );
}

export function SkeletonStats({ count = 3 }: { count?: number }) {
    return (
        <div className="grid grid-cols-3 gap-3 mb-8">
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="bg-[#121212] border border-[#262626] rounded-lg p-4 text-center animate-pulse">
                    <div className="h-8 bg-[#262626] rounded w-12 mx-auto mb-2" />
                    <div className="h-3 bg-[#262626] rounded w-16 mx-auto" />
                </div>
            ))}
        </div>
    );
}

export function SkeletonHeader() {
    return (
        <div className="flex items-center gap-3 mb-6 animate-pulse">
            <div className="w-10 h-10 rounded-full bg-[#262626]" />
            <div>
                <div className="h-6 bg-[#262626] rounded w-48 mb-2" />
                <div className="h-4 bg-[#262626] rounded w-32" />
            </div>
        </div>
    );
}

export function SkeletonList({ rows = 5 }: { rows?: number }) {
    return (
        <div className="border border-[#262626] rounded-lg overflow-hidden">
            {Array.from({ length: rows }).map((_, i) => (
                <SkeletonRow key={i} />
            ))}
        </div>
    );
}

export function SkeletonPage() {
    return (
        <div className="px-6 py-6 animate-pulse">
            <SkeletonHeader />
            <SkeletonStats />
            <SkeletonList rows={4} />
        </div>
    );
}
