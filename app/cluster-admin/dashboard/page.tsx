"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { 
  Play, 
  Pause, 
  Square, 
  SkipForward, 
  Clock, 
  Users, 
  TrendingUp, 
  Lock,
  Unlock,
  Eye,
  LogOut,
  User,
  Loader2
} from "lucide-react";

type PitchStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

interface Team {
  id: string;
  name: string;
  domain?: string;
  balance: number;
  total_received: number;
  total_invested: number;
  is_finalized: boolean;
}

interface PitchSchedule {
  id: string;
  team_id: string;
  pitch_title?: string;
  pitch_abstract?: string;
  scheduled_start: string;
  actual_start?: string;
  actual_end?: string;
  status: PitchStatus;
  pitch_position?: number;
  pitch_duration_seconds: number;
  team?: Team;
}

interface Cluster {
  id: string;
  name: string;
  location?: string;
  current_pitching_team_id?: string;
  current_stage: string;
  pitch_duration_seconds: number;
  bidding_open: boolean;
  bidding_deadline?: string;
  is_complete: boolean;
}

export default function ClusterAdminDashboard() {
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [cluster, setCluster] = useState<Cluster | null>(null);
  const [pitchSchedule, setPitchSchedule] = useState<PitchSchedule[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [activePitch, setActivePitch] = useState<PitchSchedule | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [userName, setUserName] = useState("Cluster Admin");
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  
  // Super admin cluster selection
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [allClusters, setAllClusters] = useState<Cluster[]>([]);
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);

  // Fetch cluster and related data
  // Fast cluster data fetch (used when switching clusters)
  const fetchClusterData = useCallback(async (clusterId: string) => {
    const params = new URLSearchParams({
      action: 'GET_CLUSTER_DATA',
      clusterId
    });
    const clusterRes = await fetch(`/api/cluster-admin/pitch?${params.toString()}`);
    
    const clusterData = await clusterRes.json();

    if (clusterData.cluster) {
      setCluster(clusterData.cluster);
    }

    if (clusterData.teams) {
      setTeams(clusterData.teams);
    }

    if (clusterData.schedule) {
      setPitchSchedule(clusterData.schedule);
      const active = clusterData.schedule.find((p: PitchSchedule) => p.status === 'in_progress');
      setActivePitch(active || null);
    }
    
    setLoading(false);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      // Check auth and role
      const userRes = await fetch('/api/auth/me');
      if (!userRes.ok) {
        router.push('/auth/login');
        return;
      }
      
      const userData = await userRes.json();
      const user = userData.user;
      
      if (user?.role !== 'admin' && user?.role !== 'cluster_monitor' && user?.role !== 'super_admin') {
        console.error('User role not authorized for cluster admin:', user?.role);
        router.push('/dashboard');
        return;
      }

      setUserName(user?.fullName || 'Cluster Admin');
      const isSuper = user?.role === 'super_admin';
      setIsSuperAdmin(isSuper);

      let targetClusterId: string | null = null;

      // If super admin, fetch all clusters for selection (use API to bypass RLS)
      if (isSuper) {
        // Only fetch clusters list if we don't have it yet
        if (allClusters.length === 0) {
          const clustersRes = await fetch('/api/super-admin/colleges', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'FETCH_CLUSTERS' }),
          });
          const clustersData = await clustersRes.json();
          
          if (clustersData.success && clustersData.clusters?.length > 0) {
            setAllClusters(clustersData.clusters);
            targetClusterId = selectedClusterId || clustersData.clusters[0].id;
            if (!selectedClusterId) {
              setSelectedClusterId(targetClusterId);
            }
          }
        } else {
          targetClusterId = selectedClusterId || allClusters[0]?.id;
        }
      } else {
        // Regular admin - check assignedClusterId on user first
        // assignedClusterId could be: string ID, ObjectId, or populated Cluster object
        const assignedCluster = user.assignedClusterId;
        console.log('DEBUG - user.assignedClusterId:', assignedCluster);
        console.log('DEBUG - typeof assignedCluster:', typeof assignedCluster);
        
        if (assignedCluster) {
          if (typeof assignedCluster === 'string') {
            targetClusterId = assignedCluster;
            console.log('DEBUG - extracted as string:', targetClusterId);
          } else if (typeof assignedCluster === 'object') {
            // Handle populated object or ObjectId
            targetClusterId = assignedCluster._id?.toString() || 
                             assignedCluster.id?.toString() || 
                             assignedCluster.toString();
            console.log('DEBUG - extracted from object:', targetClusterId);
          }
        }
        
        if (!targetClusterId) {
          console.log('DEBUG - No targetClusterId from assignedCluster, trying fallback API');
          // Fallback: try to get cluster via API (legacy monitor_id approach)
          const clustersRes = await fetch('/api/super-admin/colleges', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'FETCH_CLUSTERS' }),
          });
          const clustersData = await clustersRes.json();
          console.log('DEBUG - clustersData:', clustersData);
          
          if (clustersData.success) {
            console.log('DEBUG - Looking for monitor_id:', user.id);
            const myCluster = clustersData.clusters?.find((c: any) => c.monitor_id === user.id);
            console.log('DEBUG - Found cluster by monitor_id:', myCluster);
            if (myCluster) {
              targetClusterId = myCluster.id;
            }
          }
          
          if (!targetClusterId) {
            console.error('No cluster assigned - assignedClusterId was:', user.assignedClusterId);
            setLoading(false);
            return;
          }
        }
      }

      if (!targetClusterId) {
        setLoading(false);
        return;
      }

      // Fetch cluster data
      await fetchClusterData(targetClusterId);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      setLoading(false);
    }
  }, [router, selectedClusterId, allClusters, fetchClusterData]);

  // Initial load
  useEffect(() => {
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fast switch when cluster selection changes (super admin only)
  const handleClusterChange = useCallback((clusterId: string) => {
    setSelectedClusterId(clusterId);
    setLoading(true);
    fetchClusterData(clusterId);
  }, [fetchClusterData]);

  // Timer logic for active pitch
  useEffect(() => {
    if (!activePitch || !activePitch.actual_start || isPaused) return;

    const interval = setInterval(() => {
      const startTime = new Date(activePitch.actual_start!).getTime();
      const now = Date.now();
      const elapsed = Math.floor((now - startTime) / 1000);
      setElapsedTime(elapsed);
    }, 1000);

    return () => clearInterval(interval);
  }, [activePitch, isPaused]);

  // Poll for pitch updates (replaces Supabase realtime)
  useEffect(() => {
    if (!cluster) return;

    // Poll every 5 seconds for updates
    const interval = setInterval(() => {
      fetchClusterData(cluster.id);
    }, 5000);

    return () => {
      clearInterval(interval);
    };
  }, [cluster, fetchClusterData]);

  const startPitch = async (pitch: PitchSchedule) => {
    if (!cluster) return;
    const teamId =
      (typeof pitch.team_id === 'string' ? pitch.team_id : (pitch.team_id as any)?._id) ||
      pitch.team?.id ||
      (pitch.team as any)?._id;

    if (!teamId) {
      console.error('Start pitch error: missing teamId for schedule', pitch);
      return;
    }

    try {
      const res = await fetch('/api/cluster-admin/pitch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'START_PITCH',
          payload: { scheduleId: pitch.id, teamId, clusterId: cluster.id }
        })
      });
      
      const data = await res.json();
      if (data.success) {
        setElapsedTime(0);
        setIsPaused(false);
        fetchData();
      }
    } catch (error) {
      console.error('Start pitch error:', error);
    }
  };

  const pausePitch = async () => {
    if (!activePitch || !cluster) return;
    
    if (!isPaused) {
      // Pausing - call API to store elapsed time
      try {
        await fetch('/api/cluster-admin/pitch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'PAUSE_PITCH',
            payload: { pitchId: activePitch.id }
          })
        });
      } catch (error) {
        console.error('Pause error:', error);
      }
    } else {
      // Resuming - call API to reset start time
      try {
        await fetch('/api/cluster-admin/pitch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'RESUME_PITCH',
            payload: { pitchId: activePitch.id }
          })
        });
        fetchData();
      } catch (error) {
        console.error('Resume error:', error);
      }
    }
    setIsPaused(!isPaused);
  };

  const endPitch = async (scheduleId: string) => {
    if (!cluster) return;
    
    try {
      const res = await fetch('/api/cluster-admin/pitch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'END_PITCH',
          payload: { scheduleId, clusterId: cluster.id }
        })
      });
      
      const data = await res.json();
      if (data.success) {
        setActivePitch(null);
        setElapsedTime(0);
        setIsPaused(false);
        fetchData();
      }
    } catch (error) {
      console.error('End pitch error:', error);
    }
  };

  const skipPitch = async (pitchId: string) => {
    if (!cluster) return;
    
    try {
      const res = await fetch('/api/cluster-admin/pitch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'SKIP_PITCH',
          payload: { pitchId, clusterId: cluster.id }
        })
      });
      
      const data = await res.json();
      if (data.success) {
        setActivePitch(null);
        setElapsedTime(0);
        fetchData();
      }
    } catch (error) {
      console.error('Skip pitch error:', error);
    }
  };

  const toggleBidding = async () => {
    if (!cluster) return;

    try {
      const res = await fetch('/api/cluster-admin/pitch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: cluster.bidding_open ? 'CLOSE_BIDDING' : 'OPEN_BIDDING',
          payload: { clusterId: cluster.id }
        })
      });
      
      const data = await res.json();
      if (data.success) {
        fetchData();
      }
    } catch (error) {
      console.error('Toggle bidding error:', error);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/auth/login');
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const getTimeRemaining = (seconds: number, duration: number) => {
    const remaining = duration - seconds;
    return remaining > 0 ? remaining : 0;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!cluster) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-serif text-white mb-2">No Cluster Assigned</h1>
          <p className="text-gray-500 text-sm mb-4">Contact super admin to assign you to a cluster as a monitor</p>
          <p className="text-xs text-gray-600">
            Super admin must go to &quot;Manage Users&quot; → find your user → set your role to &quot;cluster_monitor&quot; 
            and assign you to a cluster using the dropdown.
          </p>
          <button
            onClick={handleLogout}
            className="mt-6 px-4 py-2 bg-red-500/10 border border-red-500 text-red-500 rounded-lg text-sm hover:bg-red-500/20 transition-colors"
          >
            Logout
          </button>
        </div>
      </div>
    );
  }

  const remainingSeconds = activePitch 
    ? getTimeRemaining(elapsedTime, activePitch.pitch_duration_seconds)
    : 0;
  const isCritical = remainingSeconds <= 30 && remainingSeconds > 0;

  return (
    <div className="min-h-screen bg-black text-white pb-24">
      {/* Header */}
      <header className="border-b border-[#262626] bg-[#0A0A0A] sticky top-0 z-40">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="font-serif text-xl text-white">{cluster.name}</h1>
              <p className="text-[10px] uppercase tracking-widest text-primary">
                {cluster.location || 'Cluster Monitor'}
              </p>
            </div>
            
            {/* Super Admin Cluster Selector */}
            {isSuperAdmin && allClusters.length > 0 && (
              <select
                value={selectedClusterId || ''}
                onChange={(e) => handleClusterChange(e.target.value)}
                className="bg-[#121212] border border-[#262626] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
              >
                {allClusters.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}
          </div>
          
          <div className="relative">
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center gap-2 bg-[#121212] border border-[#262626] rounded-lg px-3 py-2"
            >
              <User className="w-4 h-4 text-primary" />
              <span className="text-xs text-white hidden sm:inline">{userName}</span>
            </button>
            
            {showProfileMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-[#121212] border border-[#262626] rounded-lg shadow-xl">
                <button
                  onClick={handleLogout}
                  className="w-full px-4 py-3 text-left text-sm text-red-400 hover:bg-[#1A1A1A] flex items-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-4 space-y-6">
        {/* Active Pitch Control */}
        {activePitch ? (
          <div className="border-2 border-primary bg-[#0A0A0A] rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-gray-500">Now Pitching</p>
                <h2 className="text-2xl font-serif text-white mt-1">{activePitch.team?.name}</h2>
                <p className="text-sm text-gray-400 mt-1">{activePitch.pitch_title || activePitch.team?.domain}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-widest text-gray-500">Position</p>
                <p className="text-2xl font-mono text-primary">#{activePitch.pitch_position}</p>
              </div>
            </div>

            {/* Timer */}
            <div className={`text-center py-8 border-2 rounded-lg mb-6 ${
              isCritical ? 'border-red-500 bg-red-500/5' : 'border-primary/30 bg-black'
            }`}>
              <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-2">Time Remaining</p>
              <div className={`text-6xl font-mono font-bold ${
                isCritical ? 'text-red-500 animate-pulse' : 'text-primary'
              }`}>
                {formatTime(remainingSeconds)}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Elapsed: {formatTime(elapsedTime)} / {formatTime(activePitch.pitch_duration_seconds)}
              </p>
            </div>

            {/* Controls */}
            <div className="flex gap-3">
              <button
                onClick={pausePitch}
                className="flex-1 bg-yellow-500/10 border border-yellow-500 text-yellow-500 py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-yellow-500/20 transition-colors"
              >
                {isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
                {isPaused ? 'Resume' : 'Pause'}
              </button>
              
              <button
                onClick={() => endPitch(activePitch.id)}
                className="flex-1 bg-green-500/10 border border-green-500 text-green-500 py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-green-500/20 transition-colors"
              >
                <Square className="w-5 h-5" />
                End Pitch
              </button>
              
              <button
                onClick={() => skipPitch(activePitch.id)}
                className="flex-1 bg-red-500/10 border border-red-500 text-red-500 py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-red-500/20 transition-colors"
              >
                <SkipForward className="w-5 h-5" />
                Skip
              </button>
            </div>
          </div>
        ) : (
          <div className="border border-[#262626] bg-[#0A0A0A] rounded-xl p-6 text-center">
            <Clock className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <h3 className="text-lg font-serif text-white">No Active Pitch</h3>
            <p className="text-sm text-gray-500 mt-1">Select a team below to start their pitch</p>
          </div>
        )}

        {/* Bidding Control */}
        <div className="border border-[#262626] bg-[#0A0A0A] rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {cluster.bidding_open ? (
                <Unlock className="w-5 h-5 text-green-500" />
              ) : (
                <Lock className="w-5 h-5 text-gray-500" />
              )}
              <div>
                <h3 className="font-serif text-white">Bidding Phase</h3>
                <p className="text-xs text-gray-500">
                  {cluster.bidding_open ? 'Teams can submit investments' : 'Investment locked'}
                </p>
              </div>
            </div>
            <button
              onClick={toggleBidding}
              className={`px-6 py-2 rounded-lg font-semibold text-sm transition-colors ${
                cluster.bidding_open
                  ? 'bg-red-500/10 border border-red-500 text-red-500 hover:bg-red-500/20'
                  : 'bg-green-500/10 border border-green-500 text-green-500 hover:bg-green-500/20'
              }`}
            >
              {cluster.bidding_open ? 'Close Bidding' : 'Open Bidding'}
            </button>
          </div>
        </div>

        {/* Pitch Schedule */}
        <div className="border border-[#262626] bg-[#0A0A0A] rounded-xl overflow-hidden">
          <div className="bg-[#121212] px-4 py-3 border-b border-[#262626]">
            <h3 className="font-serif text-white">Pitch Schedule</h3>
            <p className="text-[10px] uppercase tracking-widest text-gray-500 mt-1">
              {pitchSchedule.filter(p => p.status === 'completed').length} / {pitchSchedule.length} Completed
            </p>
          </div>
          
          <div className="divide-y divide-[#262626]">
            {pitchSchedule.map((pitch) => (
              <div
                key={pitch.id}
                className={`p-4 transition-colors ${
                  pitch.status === 'in_progress' 
                    ? 'bg-primary/5 border-l-4 border-l-primary' 
                    : 'hover:bg-[#121212]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <p className="text-xs text-gray-500">Pos</p>
                      <p className="text-lg font-mono text-white">#{pitch.pitch_position}</p>
                    </div>
                    <div>
                      <h4 className="text-white font-semibold">{pitch.team?.name}</h4>
                      <p className="text-xs text-gray-500">{pitch.pitch_title || pitch.team?.domain}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-3 py-1 rounded-full border ${
                      pitch.status === 'completed' 
                        ? 'bg-green-500/10 border-green-500 text-green-500'
                        : pitch.status === 'in_progress'
                        ? 'bg-primary/10 border-primary text-primary'
                        : pitch.status === 'cancelled'
                        ? 'bg-red-500/10 border-red-500 text-red-500'
                        : 'bg-gray-500/10 border-gray-500 text-gray-500'
                    }`}>
                      {pitch.status.replace('_', ' ').toUpperCase()}
                    </span>
                    
                    {pitch.status === 'scheduled' && !activePitch && (
                      <button
                        onClick={() => startPitch(pitch)}
                        className="bg-primary/10 border border-primary text-primary px-4 py-2 rounded-lg text-sm flex items-center gap-2 hover:bg-primary/20 transition-colors"
                      >
                        <Play className="w-4 h-4" />
                        Start
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Live Leaderboard */}
        <div className="border border-[#262626] bg-[#0A0A0A] rounded-xl overflow-hidden">
          <div className="bg-[#121212] px-4 py-3 border-b border-[#262626] flex items-center justify-between">
            <div>
              <h3 className="font-serif text-white">Live Rankings</h3>
              <p className="text-[10px] uppercase tracking-widest text-gray-500 mt-1">
                {cluster.bidding_open ? 'Hidden during bidding' : 'Total investment received'}
              </p>
            </div>
            <Eye className={`w-5 h-5 ${cluster.bidding_open ? 'text-gray-600' : 'text-green-500'}`} />
          </div>
          
          <div className="divide-y divide-[#262626]">
            {teams
              .sort((a, b) => b.total_received - a.total_received)
              .map((team, index) => (
                <div key={team.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                      index === 0 
                        ? 'bg-primary text-black' 
                        : 'bg-[#121212] text-gray-500'
                    }`}>
                      {index + 1}
                    </div>
                    <div>
                      <h4 className="text-white font-semibold">{team.name}</h4>
                      <p className="text-xs text-gray-500">{team.domain}</p>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    {cluster.bidding_open ? (
                      <p className="text-gray-600">●●●●●</p>
                    ) : (
                      <>
                        <p className="text-lg font-mono text-primary">
                          ₹{(team.total_received / 100000).toFixed(1)}L
                        </p>
                        <p className="text-xs text-gray-500">
                          {team.is_finalized ? 'Finalized' : 'Pending'}
                        </p>
                      </>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Cluster Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="border border-[#262626] bg-[#0A0A0A] rounded-lg p-4 text-center">
            <Users className="w-5 h-5 text-primary mx-auto mb-2" />
            <p className="text-2xl font-mono text-white">{teams.length}</p>
            <p className="text-[10px] uppercase tracking-widest text-gray-500 mt-1">Teams</p>
          </div>
          
          <div className="border border-[#262626] bg-[#0A0A0A] rounded-lg p-4 text-center">
            <Clock className="w-5 h-5 text-primary mx-auto mb-2" />
            <p className="text-2xl font-mono text-white">
              {pitchSchedule.filter(p => p.status === 'completed').length}
            </p>
            <p className="text-[10px] uppercase tracking-widest text-gray-500 mt-1">Completed</p>
          </div>
          
          <div className="border border-[#262626] bg-[#0A0A0A] rounded-lg p-4 text-center">
            <TrendingUp className="w-5 h-5 text-primary mx-auto mb-2" />
            <p className="text-2xl font-mono text-white">
              {teams.filter(t => t.is_finalized).length}
            </p>
            <p className="text-[10px] uppercase tracking-widest text-gray-500 mt-1">Finalized</p>
          </div>
        </div>
      </div>
    </div>
  );
}
