"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
    FileText,
    Loader2,
    RefreshCw,
    Filter,
    ChevronLeft,
    User,
    Layers,
    Shield,
    Fingerprint,
    DollarSign,
} from 'lucide-react';
import SuperAdminBottomNav from '../../components/SuperAdminBottomNav';

type AuditLog = {
    _id: string;
    id?: string;
    event_type?: string;
    eventType?: string;
    actor_id?: string | null;
    actorId?: string | null;
    target_id?: string | null;
    targetId?: string | null;
    metadata: any;
    created_at?: string;
    createdAt?: string;
    actor_name?: string;
};

const eventTypeIcons: Record<string, any> = {
    'onboarding_completed': Fingerprint,
    'team_shuffle_completed': Layers,
    'cluster_created': Layers,
    'investment_created': DollarSign,
    'admin_override': Shield,
    'default': FileText,
};

const eventTypeColors: Record<string, string> = {
    'onboarding_completed': 'text-green-400 bg-green-500/10 border-green-500/30',
    'team_shuffle_completed': 'text-primary bg-primary/10 border-primary/30',
    'cluster_created': 'text-blue-400 bg-blue-500/10 border-blue-500/30',
    'investment_created': 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
    'admin_override': 'text-red-400 bg-red-500/10 border-red-500/30',
    'default': 'text-gray-400 bg-gray-500/10 border-gray-500/30',
};

export default function AuditLogsPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [filter, setFilter] = useState<string>('all');

    const fetchLogs = useCallback(async () => {
        try {
            const response = await fetch('/api/super-admin/logs');
            if (!response.ok) {
                if (response.status === 401) {
                    router.push('/auth/login');
                    return;
                }
                if (response.status === 403) {
                    router.push('/dashboard');
                    return;
                }
                throw new Error('Failed to fetch logs');
            }

            const data = await response.json();
            setLogs(data.logs || []);
        } catch (err) {
            console.error('Failed to fetch logs:', err);
        } finally {
            setLoading(false);
        }
    }, [router]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    // Helper to get event type (handle both snake_case and camelCase)
    const getEventType = (log: AuditLog) => log.event_type || log.eventType || 'unknown';
    const getCreatedAt = (log: AuditLog) => log.created_at || log.createdAt || new Date().toISOString();

    const filteredLogs = filter === 'all' 
        ? logs 
        : logs.filter(log => getEventType(log) === filter);

    const uniqueEventTypes = [...new Set(logs.map(log => getEventType(log)).filter(Boolean))] as string[];

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleString('en-US', {
            month: 'short',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        });
    };

    const getIcon = (eventType: string) => {
        return eventTypeIcons[eventType] || eventTypeIcons['default'];
    };

    const getColor = (eventType: string) => {
        return eventTypeColors[eventType] || eventTypeColors['default'];
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen pb-28 bg-[#0A0A0A] text-white relative overflow-hidden">
            {/* Header */}
            <header className="relative z-10 px-6 py-4 flex items-center justify-between border-b border-[#262626] bg-[#0A0A0A]/80 backdrop-blur-sm sticky top-0">
                <div className="flex items-center gap-4">
                    <button onClick={() => router.back()} className="text-gray-400 hover:text-white transition-colors">
                        <ChevronLeft size={24} />
                    </button>
                    <div>
                        <h1 className="text-lg font-serif text-white">Audit Logs</h1>
                        <p className="tech-text text-primary text-[10px] tracking-widest">SYSTEM ACTIVITY</p>
                    </div>
                </div>
                <button
                    onClick={fetchLogs}
                    className="p-2 text-gray-400 hover:text-primary transition-colors"
                >
                    <RefreshCw size={20} />
                </button>
            </header>

            <div className="relative z-10 px-6 py-6 max-w-4xl mx-auto">
                {/* Filter */}
                <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
                    <Filter size={16} className="text-gray-500 shrink-0" />
                    <button
                        onClick={() => setFilter('all')}
                        className={`tech-text text-[10px] px-3 py-1.5 border transition-colors shrink-0 ${
                            filter === 'all' 
                                ? 'border-primary text-primary bg-primary/10' 
                                : 'border-[#262626] text-gray-500 hover:border-gray-500'
                        }`}
                    >
                        ALL
                    </button>
                    {uniqueEventTypes.map(type => (
                        <button
                            key={type}
                            onClick={() => setFilter(type)}
                            className={`tech-text text-[10px] px-3 py-1.5 border transition-colors shrink-0 ${
                                filter === type 
                                    ? 'border-primary text-primary bg-primary/10' 
                                    : 'border-[#262626] text-gray-500 hover:border-gray-500'
                            }`}
                        >
                            {type.replace(/_/g, ' ').toUpperCase()}
                        </button>
                    ))}
                </div>

                {/* Logs List */}
                {filteredLogs.length === 0 ? (
                    <div className="bg-[#121212] border border-[#262626] p-8 text-center">
                        <FileText size={48} className="text-gray-700 mx-auto mb-4" />
                        <p className="text-gray-500">No audit logs found</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {filteredLogs.map((log, index) => {
                            const eventType = getEventType(log);
                            const Icon = getIcon(eventType);
                            const colorClass = getColor(eventType);
                            
                            return (
                                <div
                                    key={log._id || log.id || `log-${index}`}
                                    className="bg-[#121212] border border-[#262626] p-4 hover:border-[#363636] transition-colors"
                                >
                                    <div className="flex items-start gap-4">
                                        <div className={`p-2 border ${colorClass}`}>
                                            <Icon size={16} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-4">
                                                <span className="tech-text text-white text-xs">
                                                    {eventType.replace(/_/g, ' ').toUpperCase()}
                                                </span>
                                                <span className="tech-text text-gray-600 text-[10px] shrink-0">
                                                    {formatDate(getCreatedAt(log))}
                                                </span>
                                            </div>
                                            {log.metadata && Object.keys(log.metadata).length > 0 && (
                                                <div className="mt-2 text-gray-500 text-xs font-mono">
                                                    {Object.entries(log.metadata).map(([key, value]) => (
                                                        <span key={key} className="mr-4">
                                                            <span className="text-gray-600">{key}:</span>{' '}
                                                            <span className="text-gray-400">{String(value)}</span>
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Stats */}
                <div className="mt-6 text-center">
                    <p className="tech-text text-gray-600 text-[10px]">
                        SHOWING {filteredLogs.length} OF {logs.length} ENTRIES
                    </p>
                </div>
            </div>

            <SuperAdminBottomNav />
        </div>
    );
}
