"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    Shuffle,
    Plus,
    Users,
    MapPin,
    Loader2,
    AlertTriangle,
    Check,
    ChevronLeft,
    Layers,
    Lock,
    Unlock,
    RefreshCw,
    Settings2,
} from 'lucide-react';
import SuperAdminBottomNav from '../../components/SuperAdminBottomNav';

type Team = {
    id: string;
    name: string;
    domain?: string;
    balance: number;
};

type Cluster = {
    id: string;
    name: string;
    location?: string;
    max_teams: number;
    current_stage: string;
    is_complete: boolean;
    teams: Team[];
};

type Stats = {
    totalClusters: number;
    totalTeams: number;
    assignedTeams: number;
    unassignedTeams: number;
};

export default function ClusterShufflePage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [shuffling, setShuffling] = useState(false);
    const [clusters, setClusters] = useState<Cluster[]>([]);
    const [unassignedTeams, setUnassignedTeams] = useState<Team[]>([]);
    const [stats, setStats] = useState<Stats>({
        totalClusters: 0,
        totalTeams: 0,
        assignedTeams: 0,
        unassignedTeams: 0,
    });
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    
    // Shuffle settings
    const [teamsPerCluster, setTeamsPerCluster] = useState(10);
    const [clearPrevious, setClearPrevious] = useState(true);
    const [showSettings, setShowSettings] = useState(false);

    // Create cluster modal
    const [showCreateCluster, setShowCreateCluster] = useState(false);
    const [newClusterName, setNewClusterName] = useState('');
    const [newClusterLocation, setNewClusterLocation] = useState('');
    const [creating, setCreating] = useState(false);

    const fetchData = useCallback(async () => {
        try {
            const response = await fetch('/api/super-admin/clusters');
            if (!response.ok) {
                if (response.status === 401) {
                    router.push('/auth/login');
                    return;
                }
                if (response.status === 403) {
                    router.push('/dashboard');
                    return;
                }
                throw new Error('Failed to fetch data');
            }

            const data = await response.json();
            setClusters(data.clusters || []);
            setUnassignedTeams(data.unassignedTeams || []);
            setStats(data.stats || { totalClusters: 0, totalTeams: 0, assignedTeams: 0, unassignedTeams: 0 });
        } catch (err: any) {
            setError(err.message || 'Failed to load data');
        } finally {
            setLoading(false);
        }
    }, [router]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleShuffle = async () => {
        if (clusters.length === 0) {
            setError('Please create clusters before shuffling');
            return;
        }

        setShuffling(true);
        setError(null);
        setSuccess(null);

        try {
            const response = await fetch('/api/super-admin/clusters/shuffle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    clearPrevious,
                    teamsPerCluster,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Shuffle failed');
            }

            setSuccess(data.message);
            await fetchData(); // Refresh data
        } catch (err: any) {
            setError(err.message || 'Shuffle failed');
        } finally {
            setShuffling(false);
        }
    };

    const handleCreateCluster = async () => {
        if (!newClusterName.trim()) {
            setError('Cluster name is required');
            return;
        }

        setCreating(true);
        setError(null);

        try {
            const response = await fetch('/api/super-admin/clusters', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newClusterName.trim(),
                    location: newClusterLocation.trim() || null,
                    maxTeams: teamsPerCluster,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to create cluster');
            }

            setSuccess(`Cluster "${newClusterName}" created successfully`);
            setShowCreateCluster(false);
            setNewClusterName('');
            setNewClusterLocation('');
            await fetchData();
        } catch (err: any) {
            setError(err.message || 'Failed to create cluster');
        } finally {
            setCreating(false);
        }
    };

    const getStageColor = (stage: string) => {
        switch (stage) {
            case 'pitching': return 'text-green-400 bg-green-500/20 border-green-500/30';
            case 'bidding': return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30';
            case 'locked': return 'text-red-400 bg-red-500/20 border-red-500/30';
            default: return 'text-gray-400 bg-gray-500/20 border-gray-500/30';
        }
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
            {/* Background Effects */}
            <div className="absolute inset-0 z-0 pointer-events-none">
                <div className="absolute top-1/4 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl" />
                <div className="absolute bottom-1/4 left-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
            </div>

            {/* Header */}
            <header className="relative z-10 px-6 py-4 flex items-center justify-between border-b border-[#262626] bg-[#0A0A0A]/80 backdrop-blur-sm sticky top-0">
                <div className="flex items-center gap-4">
                    <button onClick={() => router.back()} className="text-gray-400 hover:text-white transition-colors">
                        <ChevronLeft size={24} />
                    </button>
                    <div>
                        <h1 className="text-lg font-serif text-white">Cluster Management</h1>
                        <p className="tech-text text-primary text-[10px] tracking-widest">TEAM SHUFFLE CONTROL</p>
                    </div>
                </div>
                <button
                    onClick={() => setShowSettings(!showSettings)}
                    className="p-2 text-gray-400 hover:text-primary transition-colors"
                >
                    <Settings2 size={20} />
                </button>
            </header>

            <div className="relative z-10 px-6 py-6 max-w-4xl mx-auto">
                {/* Stats Cards */}
                <div className="grid grid-cols-4 gap-3 mb-6">
                    <div className="bg-[#121212] border border-[#262626] p-4 text-center">
                        <p className="text-2xl font-bold text-primary">{stats.totalClusters}</p>
                        <p className="tech-text text-[9px] text-gray-500">CLUSTERS</p>
                    </div>
                    <div className="bg-[#121212] border border-[#262626] p-4 text-center">
                        <p className="text-2xl font-bold text-white">{stats.totalTeams}</p>
                        <p className="tech-text text-[9px] text-gray-500">TEAMS</p>
                    </div>
                    <div className="bg-[#121212] border border-green-500/30 p-4 text-center">
                        <p className="text-2xl font-bold text-green-400">{stats.assignedTeams}</p>
                        <p className="tech-text text-[9px] text-gray-500">ASSIGNED</p>
                    </div>
                    <div className="bg-[#121212] border border-yellow-500/30 p-4 text-center">
                        <p className="text-2xl font-bold text-yellow-400">{stats.unassignedTeams}</p>
                        <p className="tech-text text-[9px] text-gray-500">PENDING</p>
                    </div>
                </div>

                {/* Settings Panel */}
                {showSettings && (
                    <div className="bg-[#121212] border border-[#262626] p-4 mb-6">
                        <h3 className="tech-text text-primary text-xs mb-4 tracking-wider">SHUFFLE SETTINGS</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="tech-text text-gray-500 text-[10px] block mb-2">TEAMS PER CLUSTER</label>
                                <input
                                    type="number"
                                    value={teamsPerCluster}
                                    onChange={(e) => setTeamsPerCluster(Number(e.target.value))}
                                    min={1}
                                    max={20}
                                    className="w-full bg-black border border-[#262626] text-white px-3 py-2 focus:border-primary focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="tech-text text-gray-500 text-[10px] block mb-2">CLEAR PREVIOUS</label>
                                <button
                                    onClick={() => setClearPrevious(!clearPrevious)}
                                    className={`w-full flex items-center justify-center gap-2 px-3 py-2 border transition-colors ${
                                        clearPrevious
                                            ? 'bg-primary/20 border-primary text-primary'
                                            : 'bg-black border-[#262626] text-gray-500'
                                    }`}
                                >
                                    {clearPrevious ? <Unlock size={16} /> : <Lock size={16} />}
                                    <span className="tech-text text-xs">{clearPrevious ? 'YES' : 'NO'}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Error/Success Messages */}
                {error && (
                    <div className="flex items-center gap-2 text-red-400 mb-4 p-3 bg-red-500/10 border border-red-500/30">
                        <AlertTriangle size={16} />
                        <span className="tech-text text-xs">{error}</span>
                        <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-300">×</button>
                    </div>
                )}

                {success && (
                    <div className="flex items-center gap-2 text-green-400 mb-4 p-3 bg-green-500/10 border border-green-500/30">
                        <Check size={16} />
                        <span className="tech-text text-xs">{success}</span>
                        <button onClick={() => setSuccess(null)} className="ml-auto text-green-400 hover:text-green-300">×</button>
                    </div>
                )}

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-4 mb-8">
                    <button
                        onClick={handleShuffle}
                        disabled={shuffling || clusters.length === 0}
                        className="bg-primary hover:bg-primary-hover text-black py-4 tech-text text-sm tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {shuffling ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                SHUFFLING...
                            </>
                        ) : (
                            <>
                                <Shuffle size={18} />
                                SHUFFLE TEAMS
                            </>
                        )}
                    </button>
                    <button
                        onClick={() => setShowCreateCluster(true)}
                        className="border-2 border-primary text-primary hover:bg-primary/10 py-4 tech-text text-sm tracking-wider transition-all flex items-center justify-center gap-2"
                    >
                        <Plus size={18} />
                        NEW CLUSTER
                    </button>
                </div>

                {/* Clusters Grid */}
                <div className="mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="tech-text text-primary text-xs tracking-wider">ACTIVE CLUSTERS</h2>
                        <button onClick={fetchData} className="text-gray-500 hover:text-primary transition-colors">
                            <RefreshCw size={16} />
                        </button>
                    </div>

                    {clusters.length === 0 ? (
                        <div className="bg-[#121212] border border-[#262626] p-8 text-center">
                            <Layers size={48} className="text-gray-700 mx-auto mb-4" />
                            <p className="text-gray-500 mb-2">No clusters created yet</p>
                            <p className="tech-text text-gray-600 text-xs">Create clusters before shuffling teams</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {clusters.map((cluster, index) => (
                                <div
                                    key={cluster.id}
                                    className="bg-[#121212] border border-[#262626] hover:border-primary/30 transition-colors"
                                >
                                    {/* Cluster Header */}
                                    <div className="p-4 border-b border-[#262626] flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-1 h-12 ${
                                                index === 0 ? 'bg-primary' :
                                                index === 1 ? 'bg-blue-500' :
                                                index === 2 ? 'bg-green-500' :
                                                index === 3 ? 'bg-purple-500' :
                                                'bg-gray-500'
                                            }`} />
                                            <div>
                                                <h3 className="font-bold text-white text-lg">{cluster.name}</h3>
                                                {cluster.location && (
                                                    <p className="tech-text text-gray-500 text-[10px] flex items-center gap-1">
                                                        <MapPin size={10} />
                                                        {cluster.location}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className={`tech-text text-[10px] px-2 py-1 border ${getStageColor(cluster.current_stage || 'onboarding')}`}>
                                                {(cluster.current_stage || 'onboarding').toUpperCase()}
                                            </span>
                                            <p className="tech-text text-gray-500 text-[10px] mt-1">
                                                {cluster.teams.length}/{cluster.max_teams} TEAMS
                                            </p>
                                        </div>
                                    </div>

                                    {/* Teams List */}
                                    <div className="p-4">
                                        {cluster.teams.length === 0 ? (
                                            <p className="tech-text text-gray-600 text-xs text-center py-4">No teams assigned</p>
                                        ) : (
                                            <div className="grid grid-cols-2 gap-2">
                                                {cluster.teams.map((team, teamIndex) => (
                                                    <div
                                                        key={team.id}
                                                        className="bg-black/50 border border-[#262626] px-3 py-2 flex items-center justify-between"
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <span className="tech-text text-gray-600 text-[10px]">#{teamIndex + 1}</span>
                                                            <span className="text-white text-sm truncate max-w-[120px]">{team.name}</span>
                                                        </div>
                                                        {team.domain && (
                                                            <span className="tech-text text-primary text-[8px] bg-primary/10 px-1.5 py-0.5">
                                                                {team.domain.toUpperCase()}
                                                            </span>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Unassigned Teams */}
                {unassignedTeams.length > 0 && (
                    <div className="mb-6">
                        <h2 className="tech-text text-yellow-400 text-xs tracking-wider mb-4 flex items-center gap-2">
                            <AlertTriangle size={14} />
                            UNASSIGNED TEAMS ({unassignedTeams.length})
                        </h2>
                        <div className="bg-[#121212] border border-yellow-500/30 p-4">
                            <div className="grid grid-cols-3 gap-2">
                                {unassignedTeams.map((team) => (
                                    <div
                                        key={team.id}
                                        className="bg-black/50 border border-[#262626] px-3 py-2"
                                    >
                                        <span className="text-white text-sm truncate block">{team.name}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Create Cluster Modal */}
            {showCreateCluster && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
                    <div className="bg-[#121212] border border-[#262626] w-full max-w-md p-6">
                        <h2 className="text-xl font-serif text-white mb-6">Create New Cluster</h2>

                        <div className="space-y-4">
                            <div>
                                <label className="tech-text text-gray-500 text-[10px] block mb-2">CLUSTER NAME *</label>
                                <input
                                    type="text"
                                    value={newClusterName}
                                    onChange={(e) => setNewClusterName(e.target.value)}
                                    placeholder="e.g., Cluster Alpha"
                                    className="w-full bg-black border border-[#262626] text-white px-4 py-3 focus:border-primary focus:outline-none placeholder-gray-600"
                                />
                            </div>

                            <div>
                                <label className="tech-text text-gray-500 text-[10px] block mb-2">LOCATION (OPTIONAL)</label>
                                <input
                                    type="text"
                                    value={newClusterLocation}
                                    onChange={(e) => setNewClusterLocation(e.target.value)}
                                    placeholder="e.g., Room 101 - Floor 1"
                                    className="w-full bg-black border border-[#262626] text-white px-4 py-3 focus:border-primary focus:outline-none placeholder-gray-600"
                                />
                            </div>
                        </div>

                        <div className="flex gap-4 mt-8">
                            <button
                                onClick={() => {
                                    setShowCreateCluster(false);
                                    setNewClusterName('');
                                    setNewClusterLocation('');
                                }}
                                className="flex-1 border border-[#262626] text-gray-400 py-3 tech-text text-sm hover:border-gray-500 transition-colors"
                            >
                                CANCEL
                            </button>
                            <button
                                onClick={handleCreateCluster}
                                disabled={creating || !newClusterName.trim()}
                                className="flex-1 bg-primary hover:bg-primary-hover text-black py-3 tech-text text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {creating ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Plus size={16} />
                                )}
                                CREATE
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <SuperAdminBottomNav />
        </div>
    );
}
