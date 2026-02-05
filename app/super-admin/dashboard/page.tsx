/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  Building2, 
  Plus, 
  ArrowRight, 
  Search, 
  Loader2, 
  LogOut, 
  Edit3, 
  X, 
  Upload, 
  RefreshCw, 
  Grid, 
  CheckCircle2, 
  Activity,
  Users,
  Shield
} from "lucide-react";
import SuperAdminBottomNav from "../../components/SuperAdminBottomNav";
import { useCache } from "@/lib/cache/CacheProvider";

// --- Types ---
type CollegeWithStats = {
  id: string;
  name: string;
  location: string | null;
  status: string;
  students: number;
  teams: number;
  admins: number;
};

type Stats = {
  totalColleges: number;
  activeColleges: number;
  totalUsers: number;
  totalTeams: number;
};

type ShuffleResult = Record<string, { id: string; name: string; status: string }[]>;

export default function SuperAdminDashboard() {
  const router = useRouter();
  const cache = useCache();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showUserModal, setShowUserModal] = useState(false);
const [users, setUsers] = useState<any[]>([]);
const [loadingUsers, setLoadingUsers] = useState(false);
const [newUserName, setNewUserName] = useState("");
const [newUserEmail, setNewUserEmail] = useState("");
const [newUserRole, setNewUserRole] = useState("admin");

// Cluster assignment state
const [clusters, setClusters] = useState<any[]>([]);
const [selectedClusterForUser, setSelectedClusterForUser] = useState<Record<string, string>>({});

// Cluster teams management state
const [clustersWithTeams, setClustersWithTeams] = useState<any[]>([]);
const [unassignedTeams, setUnassignedTeams] = useState<any[]>([]);
const [loadingClustersTeams, setLoadingClustersTeams] = useState(false);
const [reassigningTeam, setReassigningTeam] = useState<string | null>(null);

  // --- State ---
  const [searchQuery, setSearchQuery] = useState("");
  const [userName, setUserName] = useState("Super Admin");
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // Data State
  const [colleges, setColleges] = useState<CollegeWithStats[]>([]);
  // Initialize with 0s to prevent undefined errors
  const [stats, setStats] = useState<Stats>({
    totalColleges: 0,
    activeColleges: 0,
    totalUsers: 0,
    totalTeams: 0,
  });

  // Profile Edit State
  const [showEditName, setShowEditName] = useState(false);
  const [newName, setNewName] = useState("");
  const [isSavingName, setIsSavingName] = useState(false);

  // New Features State
  const [latency, setLatency] = useState<number | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isShuffling, setIsShuffling] = useState(false);
  const [isExecutingShuffle, setIsExecutingShuffle] = useState(false);
  const [shuffleProgress, setShuffleProgress] = useState(0);
  const [shuffleResults, setShuffleResults] = useState<ShuffleResult | null>(null);

  // --- 1. Fetch Data ---
  const fetchData = useCallback(async () => {
    try {
      // User Info
      const userRes = await fetch('/api/auth/me');
      if (!userRes.ok) {
        router.push('/auth/login');
        return;
      }
      const userData = await userRes.json();
      const name = userData.user?.fullName || "Super Admin";
      setUserName(name);

      // Dashboard Data
      const collegesRes = await fetch('/api/super-admin/colleges');
      if (collegesRes.ok) {
        const data = await collegesRes.json();
        setColleges(data.colleges || []);
        
        // Safety check to ensure stats object exists before setting
        if (data.stats) {
            setStats({
                totalColleges: data.stats.totalColleges || 0,
                activeColleges: data.stats.activeColleges || 0,
                totalUsers: data.stats.totalUsers || 0,
                totalTeams: data.stats.totalTeams || 0,
            });
        }
      } else {
        setError('Failed to fetch data');
      }
    } catch (err) {
      console.error('Failed to fetch:', err);
      setError('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fetch clusters with teams on mount
  useEffect(() => {
    fetchClustersWithTeams();
  }, []);

  // --- 2. Live Latency ---
  useEffect(() => {
    const measureLatency = async () => {
      const start = performance.now();
      try {
        await fetch('/api/auth/me', { method: 'HEAD' });
        const end = performance.now();
        setLatency(Math.round(end - start));
      } catch (e) {
        setLatency(null);
      }
    };
    measureLatency();
    const interval = setInterval(measureLatency, 5000);
    return () => clearInterval(interval);
  }, []);

  // --- 3. Bulk Import (JSON Version) ---
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate File Type
    if (!file.name.endsWith('.json')) {
        alert("INVALID FORMAT: System requires a .json file.");
        return;
    }

    setIsImporting(true);

    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        const jsonStr = event.target?.result as string;
        let payload = JSON.parse(jsonStr);

        // NORMALIZATION:
        // If the user uploaded a simple array [...], wrap it in { participants: ... }
        // to match exactly what your backend route expects.
        if (Array.isArray(payload)) {
            payload = { participants: payload };
        }

        // Send to Backend
        const res = await fetch('/api/admin/bulk-import', { 
            method: 'POST', 
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload) 
        });

        const data = await res.json();

        if (res.ok) {
            const msg = `IMPORT COMPLETE:\n\n` +
                        `✅ Success: ${data.imported}\n` +
                        `❌ Failed: ${data.failed}\n` +
                        `📧 Emails Sent: ${data.emailsSent}`;
            alert(msg);
            fetchData(); // Refresh dashboard
        } else {
            alert(`IMPORT ERROR: ${data.error || 'Unknown error occurred'}`);
        }

      } catch (err) {
        console.error(err);
        alert("ERROR: Invalid JSON syntax in file.");
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };

    // Read file as text (JSON)
    reader.readAsText(file);
  };
  
  // --- 4. Shuffle Simulation ---
  const handleShuffle = async () => {
    setIsShuffling(true);
    setShuffleProgress(0);
    setShuffleResults(null);

    const timer = setInterval(() => setShuffleProgress(p => Math.min(p + 5, 90)), 100);

    try {
        const res = await fetch('/api/super-admin/colleges', { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'SHUFFLE_TEAMS' }) 
        });
        const data = await res.json();
        
        clearInterval(timer);
        setShuffleProgress(100);

        if (data.success) {
            setTimeout(() => {
                setShuffleResults(data.data);
                setIsShuffling(false);
            }, 500);
        } else {
            alert("Shuffle failed: " + data.error);
            setIsShuffling(false);
        }
    } catch (e) {
        clearInterval(timer);
        setIsShuffling(false);
    }
  };

  // --- 5. Execute Shuffle (Actually save to database) ---
  const handleExecuteShuffle = async () => {
    if (!confirm("This will assign all teams to clusters and create pitch schedules. Continue?")) {
      return;
    }
    
    setIsExecutingShuffle(true);

    try {
        const res = await fetch('/api/super-admin/colleges', { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'EXECUTE_SHUFFLE' }) 
        });
        const data = await res.json();

        if (data.success) {
            alert(data.message);
            setShuffleResults(data.data);
            // Refresh data
            fetchData();
            fetchClusters();
        } else {
            alert("Execute shuffle failed: " + data.error);
        }
    } catch (e) {
        console.error(e);
        alert("Failed to execute shuffle");
    } finally {
        setIsExecutingShuffle(false);
    }
  };
  // ✅ Fetch Users From Profiles Table
const fetchUsers = async () => {
  setLoadingUsers(true);

  try {
    const res = await fetch("/api/super-admin/colleges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "FETCH_USERS",
      }),
    });

    const data = await res.json();

    if (data.success) {
      setUsers(data.users);
    } else {
      alert("Failed to fetch users: " + data.error);
    }
  } catch (err) {
    console.error("Fetch users error:", err);
  } finally {
    setLoadingUsers(false);
  }
};
const updateUserRole = async (id: string, role: string) => {
  await fetch("/api/super-admin/colleges", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "UPDATE_ROLE",
      payload: { id, role },
    }),
  });

  fetchUsers();
};

// Fetch all clusters for assignment
const fetchClusters = async () => {
  try {
    const res = await fetch("/api/super-admin/colleges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "FETCH_CLUSTERS" }),
    });
    const data = await res.json();
    if (data.success) {
      setClusters(data.clusters);
    }
  } catch (err) {
    console.error("Fetch clusters error:", err);
  }
};

// Assign user to cluster
const assignCluster = async (userId: string, clusterId: string) => {
  // Optimistic update: immediately update users state
  setUsers(prevUsers => prevUsers.map(user => 
    user.id === userId 
      ? { ...user, assigned_cluster_id: clusterId || null }
      : user
  ));
  
  await fetch("/api/super-admin/colleges", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "ASSIGN_CLUSTER",
      payload: { userId, clusterId },
    }),
  });
  
  // Refresh both users and clusters to ensure counts are accurate
  fetchUsers();
  fetchClusters();
};

// Fetch clusters with their assigned teams
const fetchClustersWithTeams = async () => {
  setLoadingClustersTeams(true);
  try {
    const res = await fetch("/api/super-admin/colleges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "FETCH_CLUSTERS_WITH_TEAMS" }),
    });
    const data = await res.json();
    if (data.success) {
      setClustersWithTeams(data.clusters || []);
      setUnassignedTeams(data.unassignedTeams || []);
    }
  } catch (err) {
    console.error("Fetch clusters with teams error:", err);
  } finally {
    setLoadingClustersTeams(false);
  }
};

// Reassign team to different cluster (with optimistic UI update)
const reassignTeam = async (teamId: string, newClusterId: string | null) => {
  setReassigningTeam(teamId);
  
  // Find the team being moved
  let movedTeam: any = null;
  let sourceClusterIndex = -1;
  
  // Find in clusters
  for (let i = 0; i < clustersWithTeams.length; i++) {
    const team = clustersWithTeams[i].teams?.find((t: any) => t.id === teamId);
    if (team) {
      movedTeam = team;
      sourceClusterIndex = i;
      break;
    }
  }
  
  // Check unassigned teams
  if (!movedTeam) {
    movedTeam = unassignedTeams.find((t: any) => t.id === teamId);
  }
  
  if (!movedTeam) {
    setReassigningTeam(null);
    return;
  }

  // Optimistic UI update
  setClustersWithTeams(prev => {
    const updated = prev.map(cluster => ({
      ...cluster,
      teams: cluster.teams?.filter((t: any) => t.id !== teamId) || []
    }));
    
    if (newClusterId) {
      const targetIndex = updated.findIndex(c => c.id === newClusterId);
      if (targetIndex !== -1) {
        updated[targetIndex] = {
          ...updated[targetIndex],
          teams: [...(updated[targetIndex].teams || []), movedTeam]
        };
      }
    }
    
    return updated;
  });
  
  if (!newClusterId) {
    setUnassignedTeams(prev => [...prev, movedTeam]);
  } else {
    setUnassignedTeams(prev => prev.filter(t => t.id !== teamId));
  }

  try {
    const res = await fetch("/api/super-admin/colleges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "REASSIGN_TEAM",
        payload: { teamId, newClusterId },
      }),
    });
    const data = await res.json();
    if (!data.success) {
      // Revert on error - refetch
      fetchClustersWithTeams();
      alert("Failed to reassign team: " + data.error);
    }
  } catch (err) {
    console.error("Reassign team error:", err);
    fetchClustersWithTeams(); // Revert on error
  } finally {
    setReassigningTeam(null);
  }
};

const deleteUser = async (id: string) => {
  const confirmDelete = confirm(
    "Are you sure you want to disable this user?"
  );

  if (!confirmDelete) return;

  await fetch("/api/super-admin/colleges", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "DELETE_USER",
      payload: { id },
    }),
  });

  fetchUsers();
};

const togglePermission = async (id: string, key: string, value: boolean) => {
  await fetch("/api/super-admin/colleges", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "UPDATE_PERMISSION",
      payload: { id, key, value },
    }),
  });

  fetchUsers();
};



  // --- Helpers ---
  const handleLogout = async () => {
    setIsLoggingOut(true);
    cache.invalidateAll();
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/auth/login');
    } catch (error) {
      setIsLoggingOut(false);
    }
  };

  const filteredColleges = colleges.filter(
    (college) =>
      college.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (college.location?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
  );

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'active': return { label: 'Active', class: 'bg-green-500/20 text-green-400 border-green-500/30' };
      case 'pending': return { label: 'Pending', class: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' };
      case 'inactive': return { label: 'Inactive', class: 'bg-gray-500/20 text-gray-400 border-gray-500/30' };
      default: return { label: status, class: 'bg-gray-500/20 text-gray-400 border-gray-500/30' };
    }
  };

  // Safe display helper to prevent crashes
  const displayCount = (val: number | undefined) => {
    return (val || 0).toLocaleString();
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </main>
    );
  }
  const addNewUser = async () => {
  await fetch("/api/super-admin/colleges", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "ADD_USER",
      payload: {
        full_name: newUserName,
        email: newUserEmail,
        role: newUserRole,
      },
    }),
  });

  setNewUserName("");
  setNewUserEmail("");
  fetchUsers();
};

  
  return (
    <div className="min-h-screen pb-28 bg-[#0A0A0A] text-white relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div
          className="absolute top-0 right-0 w-full h-2/3 bg-cover bg-center opacity-10 mix-blend-color-dodge"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1516912481808-3406841bd33c?q=80&w=2444&auto=format&fit=crop')" }}
        />
        <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A] to-transparent z-10" />
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-[#0A0A0A]/80 via-transparent to-[#0A0A0A] z-10" />
        <div className="absolute top-1/4 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative z-10 px-6 flex items-center justify-between border-b border-[#262626]">
        <div className="flex items-center">
          <div>
            <img
              src="/only-founders-logo.png"
              alt="Logo"
              className="w-30 h-30 object-contain"
            />
          </div>
        </div>

        <div className="flex items-center gap-4">
            {/* Latency Indicator */}
            <div className="hidden md:flex items-center gap-2 bg-[#121212] border border-[#262626] px-3 py-1.5 rounded-full">
                <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${latency !== null ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-[10px] text-gray-400 font-mono">
                    {latency !== null ? `${latency}ms` : "OFFLINE"}
                </span>
            </div>

            {/* Profile Menu */}
            <div className="relative">
            <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="w-10 h-10 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary font-serif text-sm hover:border-primary/50 transition-colors uppercase"
            >
                {(userName || "A").charAt(0)}
            </button>

            {showProfileMenu && (
                <>
                <div className="fixed inset-0 z-40" onClick={() => setShowProfileMenu(false)} />
                <div className="absolute right-0 top-14 w-52 bg-[#121212] border border-[#262626] rounded-xl shadow-2xl overflow-hidden z-50">
                    <div className="px-4 py-3 border-b border-[#262626]">
                    <p className="text-white font-medium text-sm truncate">{userName}</p>
                    <p className="text-[10px] text-primary uppercase tracking-wider">Super Admin</p>
                    </div>
                    <div className="py-1">
                    <button
                        onClick={() => {
                        setShowProfileMenu(false);
                        setNewName(userName);
                        setShowEditName(true);
                        }}
                        className="w-full px-4 py-3 flex items-center gap-3 text-gray-300 hover:bg-[#1A1A1A] transition-colors text-left"
                    >
                        <Edit3 className="w-4 h-4" />
                        <span className="text-sm">Edit Name</span>
                    </button>
                    <button
                        onClick={handleLogout}
                        disabled={isLoggingOut}
                        className="w-full px-4 py-3 flex items-center gap-3 text-red-400 hover:bg-red-500/10 transition-colors text-left"
                    >
                        <LogOut className="w-4 h-4" />
                        <span className="text-sm">{isLoggingOut ? 'Logging out...' : 'Logout'}</span>
                    </button>
                    </div>
                </div>
                </>
            )}
            </div>
        </div>
      </header>

      <div className="relative px-6 py-6 max-w-4xl mx-auto">
        {/* Welcome */}
        <section className="mb-8">
          <h2 className="text-3xl font-serif font-bold text-white mb-2">
            Welcome, <span className="text-primary">{(userName || "Admin").split(' ')[0]}</span>
          </h2>
          <p className="text-sm text-gray-400">
            Manage colleges, onboard institutions, and oversee the network.
          </p>
        </section>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm flex justify-between items-center">
            <span>{error}</span>
            <button onClick={() => { setError(''); fetchData(); }} className="text-primary hover:underline">Retry</button>
          </div>
        )}

        {/* Stats Cards (Safe Access) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <div className="bg-[#121212] border border-[#262626] rounded-lg p-4 text-center hover:border-primary/30 transition-colors">
            <p className="text-2xl font-bold text-white mb-1">{displayCount(stats?.totalColleges)}</p>
            <p className="text-[9px] text-gray-500 uppercase tracking-widest">Colleges</p>
          </div>
          <div className="bg-[#121212] border border-primary/30 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-primary mb-1">{displayCount(stats?.activeColleges)}</p>
            <p className="text-[9px] text-gray-500 uppercase tracking-widest">Active</p>
          </div>
          <div className="bg-[#121212] border border-[#262626] rounded-lg p-4 text-center hover:border-primary/30 transition-colors">
            <p className="text-2xl font-bold text-white mb-1">{displayCount(stats?.totalUsers)}</p>
            <p className="text-[9px] text-gray-500 uppercase tracking-widest">Total Users</p>
          </div>
          <div className="bg-[#121212] border border-[#262626] rounded-lg p-4 text-center hover:border-primary/30 transition-colors">
            <p className="text-2xl font-bold text-white mb-1">{displayCount(stats?.totalTeams)}</p>
            <p className="text-[9px] text-gray-500 uppercase tracking-widest">Teams</p>
          </div>
        </div>

        {/* Quick Actions (Added Bulk Import) */}
        <div className="grid grid-cols-2 gap-4 mb-8">
            <Link
  href="#"
  onClick={() => {
  setShowUserModal(true);
  fetchUsers(); // ✅ Load profiles when modal opens
  fetchClusters(); // ✅ Load clusters for assignment
}}

  className="bg-[#121212] border border-[#262626] rounded-xl p-5 hover:border-purple-500/50 transition-all group"
>
  <div className="flex items-center gap-3 mb-3">
    <div className="w-10 h-10 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
      <Shield className="w-5 h-5 text-purple-500" />
    </div>
    <h3 className="font-serif font-semibold text-white">
      Manage Users
    </h3>
  </div>
  <p className="text-xs text-gray-500 mb-4">
    Assign roles & permissions
  </p>
  <span className="text-purple-400 text-xs uppercase tracking-widest flex items-center gap-1">
    Open Control <ArrowRight className="w-3 h-3" />
  </span>
</Link>
          <Link
            href="/super-admin/colleges"
            className="bg-[#121212] border border-[#262626] rounded-xl p-5 hover:border-primary/50 transition-all group"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-serif font-semibold text-white">Manage Colleges</h3>
            </div>
            <p className="text-xs text-gray-500 mb-4">View and edit all institutions</p>
            <span className="text-primary text-xs uppercase tracking-widest flex items-center gap-1 group-hover:gap-2 transition-all">
              View All <ArrowRight className="w-3 h-3" />
            </span>
          </Link>
          

          <div className="flex flex-col gap-3">
             <Link
                href="/super-admin/colleges/create"
                className="bg-[#121212] border border-[#262626] rounded-xl p-4 hover:border-green-500/50 transition-all group flex items-center gap-3"
            >
                <div className="w-8 h-8 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center">
                    <Plus className="w-4 h-4 text-green-500" />
                </div>
                <div>
                    <h3 className="font-serif font-semibold text-white text-sm">Onboard College</h3>
                    <span className="text-green-500 text-[10px] uppercase tracking-widest">Create New</span>
                </div>
            </Link>
            

            {/* BULK IMPORT BUTTON */}
            {/* BULK IMPORT BUTTON */}
<button
    onClick={() => fileInputRef.current?.click()}
    disabled={isImporting}
    className="bg-[#111] border border-[#333] hover:border-blue-500 text-gray-300 hover:text-blue-500 font-bold text-xs px-4 py-3 uppercase tracking-wider transition-all flex items-center gap-2"
>
    <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
        {isImporting ? <Loader2 className="w-4 h-4 text-blue-500 animate-spin"/> : <Upload className="w-4 h-4 text-blue-500" />}
    </div>
    <div>
        <h3 className="font-serif font-semibold text-white text-sm">Import Teams</h3>
        <span className="text-blue-500 text-[10px] uppercase tracking-widest">
            {isImporting ? "Processing..." : ".JSON ONLY"}
        </span>
    </div>
    {/* Updated accept attribute for JSON */}
    <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        onChange={handleFileChange}
        accept=".json,application/json" 
    />
</button>
          </div>
        </div>

        {/* CLUSTER MANAGEMENT (Simulation Block) */}
        <section className="mb-8 bg-[#121212] border border-[#262626] rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-yellow-500/20 border border-yellow-500/30 flex items-center justify-center">
                        <Grid className="w-5 h-5 text-yellow-500" />
                    </div>
                    <div>
                        <h3 className="font-serif font-semibold text-white">Cluster Distribution</h3>
                        <p className="text-xs text-gray-500">Simulate team assignments (Fisher-Yates)</p>
                    </div>
                </div>
                {isShuffling && <span className="text-yellow-500 text-xs font-mono">{Math.round(shuffleProgress)}%</span>}
            </div>

            {/* Progress Bar */}
            <div className="h-1 w-full bg-[#0A0A0A] rounded-full overflow-hidden mb-4">
                <div 
                    className="h-full bg-yellow-500 transition-all duration-300 ease-out" 
                    style={{ width: `${isShuffling ? shuffleProgress : 0}%` }}
                />
            </div>

            <button
                onClick={handleShuffle}
                disabled={isShuffling}
                className="w-full bg-[#0A0A0A] border border-[#333] hover:border-yellow-500 text-gray-300 hover:text-white py-3 rounded-lg flex items-center justify-center gap-2 transition-all uppercase text-xs tracking-wider font-bold"
            >
                <RefreshCw className={`w-4 h-4 ${isShuffling ? 'animate-spin text-yellow-500' : ''}`} />
                {isShuffling ? "Processing Simulation..." : "Preview Shuffle"}
            </button>

            {/* Execute Shuffle Button - appears after preview */}
            <button
                onClick={handleExecuteShuffle}
                disabled={isExecutingShuffle}
                className="w-full mt-3 bg-yellow-500/20 border border-yellow-500/50 hover:bg-yellow-500/30 text-yellow-500 py-3 rounded-lg flex items-center justify-center gap-2 transition-all uppercase text-xs tracking-wider font-bold"
            >
                <CheckCircle2 className={`w-4 h-4 ${isExecutingShuffle ? 'animate-spin' : ''}`} />
                {isExecutingShuffle ? "Executing..." : "Execute Shuffle (Save to Database)"}
            </button>

            {/* Preview Grid */}
            {shuffleResults && (
                <div className="mt-6 grid grid-cols-1 md:grid-cols-5 gap-3 animate-in fade-in slide-in-from-bottom-2">
                    {Object.entries(shuffleResults).map(([cluster, teams]) => (
                        <div key={cluster} className="bg-[#0A0A0A] border border-[#262626] rounded-lg flex flex-col overflow-hidden">
                            <div className="bg-[#1A1A1A] p-2 border-b border-[#262626] flex justify-between items-center">
                                <span className="text-[10px] font-bold text-yellow-500 uppercase">{cluster.replace('_SECTOR', '')}</span>
                                <span className="text-[10px] text-gray-500">{teams.length}</span>
                            </div>
                            <div className="p-2 space-y-1 max-h-40 overflow-y-auto">
                                {teams.map(t => (
                                    <div key={t.id} className="text-[10px] text-gray-400 truncate flex items-center gap-1">
                                        <CheckCircle2 className="w-3 h-3 text-green-500/50" />
                                        {t.name}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </section>

        {/* Cluster Teams Management Section */}
        <section className="bg-[#121212] border border-[#262626] rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
                        <Users className="w-5 h-5 text-blue-500" />
                    </div>
                    <div>
                        <h3 className="font-serif font-semibold text-white">Cluster Teams Management</h3>
                        <p className="text-xs text-gray-500">View and reassign teams across clusters</p>
                    </div>
                </div>
                <button
                    onClick={fetchClustersWithTeams}
                    disabled={loadingClustersTeams}
                    className="text-blue-500 hover:text-blue-400 transition-colors"
                >
                    <RefreshCw className={`w-4 h-4 ${loadingClustersTeams ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {loadingClustersTeams ? (
                <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                </div>
            ) : clustersWithTeams.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                    <p>No clusters created yet.</p>
                    <p className="text-xs mt-1">Use &quot;Execute Shuffle&quot; above to create clusters and assign teams.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {/* Unassigned Teams */}
                    {unassignedTeams.length > 0 && (
                        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-sm font-bold text-red-400 uppercase">Unassigned Teams</span>
                                <span className="text-xs text-red-400">{unassignedTeams.length} teams</span>
                            </div>
                            <div className="space-y-2">
                                {unassignedTeams.map((team: any) => (
                                    <div key={team.id} className="flex items-center justify-between bg-[#0A0A0A] rounded-lg p-3">
                                        <span className="text-sm text-white">{team.name}</span>
                                        <select
                                            disabled={reassigningTeam === team.id}
                                            onChange={(e) => reassignTeam(team.id, e.target.value || null)}
                                            className="bg-[#1A1A1A] border border-[#333] rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
                                            defaultValue=""
                                        >
                                            <option value="">Assign to cluster...</option>
                                            {clustersWithTeams.map((c: any) => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Clusters Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                        {clustersWithTeams.map((cluster: any) => (
                            <div key={cluster.id} className="bg-[#0A0A0A] border border-[#262626] rounded-xl overflow-hidden">
                                <div className="bg-[#1A1A1A] p-3 border-b border-[#262626]">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-bold text-blue-400">{cluster.name}</span>
                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">
                                            {cluster.teams?.length || 0} teams
                                        </span>
                                    </div>
                                    {cluster.monitor && (
                                        <p className="text-[10px] text-gray-500 mt-1 truncate">
                                            Monitor: {cluster.monitor.full_name}
                                        </p>
                                    )}
                                    <p className="text-[10px] text-gray-600 truncate">{cluster.location}</p>
                                </div>
                                <div className="p-2 max-h-48 overflow-y-auto space-y-1">
                                    {cluster.teams?.length === 0 ? (
                                        <p className="text-[10px] text-gray-600 text-center py-2">No teams assigned</p>
                                    ) : (
                                        cluster.teams?.map((team: any) => (
                                            <div key={team.id} className="group flex items-center justify-between bg-[#121212] hover:bg-[#1A1A1A] rounded-lg p-2 transition-colors">
                                                <span className="text-[11px] text-gray-300 truncate flex-1">{team.name}</span>
                                                <select
                                                    disabled={reassigningTeam === team.id}
                                                    onChange={(e) => {
                                                        const newVal = e.target.value;
                                                        if (newVal !== cluster.id) {
                                                            reassignTeam(team.id, newVal || null);
                                                        }
                                                    }}
                                                    value={cluster.id}
                                                    className="opacity-0 group-hover:opacity-100 bg-[#0A0A0A] border border-[#333] rounded px-1 py-0.5 text-[10px] text-white focus:outline-none focus:border-blue-500 transition-opacity ml-2"
                                                >
                                                    <option value="">Unassign</option>
                                                    {clustersWithTeams.map((c: any) => (
                                                        <option key={c.id} value={c.id}>{c.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </section>

        {/* Recent Colleges (Original Section) */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-serif text-xl font-bold text-white">Recent Colleges</h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-[#121212] border border-[#262626] rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-primary transition-colors w-40"
              />
            </div>
          </div>

          <div className="space-y-3">
            {filteredColleges.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                {searchQuery ? 'No colleges found matching your search.' : 'No colleges yet. Create one to get started!'}
              </div>
            )}

            {filteredColleges.slice(0, 5).map((college) => {
              const statusInfo = getStatusDisplay(college.status);
              return (
                <Link
                  key={college.id}
                  href={`/super-admin/colleges/${college.id}`}
                  className="block bg-[#121212] border border-[#262626] rounded-xl p-4 hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary font-serif text-sm">
                        {college.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-semibold text-white">{college.name}</p>
                        <p className="text-xs text-gray-500">{college.location || 'No location'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-sm font-semibold text-white">{college.students}</p>
                        <p className="text-[9px] text-gray-500 uppercase">Students</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-white">{college.teams}</p>
                        <p className="text-[9px] text-gray-500 uppercase">Teams</p>
                      </div>
                      <span className={`px-2 py-1 rounded text-[9px] font-bold uppercase tracking-wider border ${statusInfo.class}`}>
                        {statusInfo.label}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          {filteredColleges.length > 5 && (
            <Link
              href="/super-admin/colleges"
              className="block mt-4 text-center text-primary text-sm hover:underline"
            >
              View all {filteredColleges.length} colleges →
            </Link>
          )}
        </section>
      </div>

      {/* Bottom Navigation */}
      <SuperAdminBottomNav />

      {/* Edit Name Modal (Unchanged) */}
      {showEditName && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/80">
          <div className="bg-[#121212] border border-[#262626] rounded-xl p-6 w-full max-w-sm relative">
            <button
              onClick={() => setShowEditName(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="font-serif text-xl font-bold text-white mb-6">Edit Name</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full bg-[#0A0A0A] border border-[#262626] text-white py-3 px-4 focus:outline-none focus:border-primary transition-colors text-sm rounded-lg"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowEditName(false)}
                  className="flex-1 border border-[#262626] text-gray-400 font-semibold py-3 rounded-lg hover:border-gray-500 transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (!newName.trim()) return;
                    setIsSavingName(true);
                    try {
                      const res = await fetch('/api/profile/update', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ fullName: newName.trim() }),
                      });
                      if (res.ok) {
                        setUserName(newName.trim());
                        cache.set('super-admin-user', { name: newName.trim() }, 10 * 60 * 1000);
                        setShowEditName(false);
                      }
                    } catch (err) {
                      console.error('Failed to update name:', err);
                    } finally {
                      setIsSavingName(false);
                    }
                  }}
                  disabled={isSavingName || !newName.trim()}
                  className="flex-1 bg-primary hover:bg-primary-hover text-black font-semibold py-3 rounded-lg transition-colors text-sm flex items-center justify-center disabled:opacity-50"
                >
                  {isSavingName ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showUserModal && (
  <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4">

    <div className="bg-[#121212] border border-[#262626] rounded-xl w-full max-w-3xl p-6 relative">

      {/* Close */}
      <button
        onClick={() => setShowUserModal(false)}
        className="absolute top-4 right-4 text-gray-500 hover:text-white"
      >
        <X className="w-5 h-5" />
      </button>

      <h2 className="text-xl font-serif font-bold text-white mb-4">
        User Access Control
      </h2>

      {/* ✅ Add New User */}
      <div className="bg-[#0A0A0A] border border-[#262626] rounded-lg p-4 mb-6">
        <h3 className="text-sm font-semibold text-purple-400 mb-3">
          Add New Admin User
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            value={newUserName}
            onChange={(e) => setNewUserName(e.target.value)}
            placeholder="Full Name"
            className="bg-[#111] border border-[#333] px-3 py-2 rounded text-sm text-white"
          />
          <input
            value={newUserEmail}
            onChange={(e) => setNewUserEmail(e.target.value)}
            placeholder="Email"
            className="bg-[#111] border border-[#333] px-3 py-2 rounded text-sm text-white"
          />
          <select
            value={newUserRole}
            onChange={(e) => setNewUserRole(e.target.value)}
            className="bg-[#111] border border-[#333] px-3 py-2 rounded text-sm text-white"
          >
            <option value="admin">Admin</option>
            <option value="team_lead">team lead</option>
            <option value="super_admin">Super Admin</option>
          </select>
        </div>

        <button
          onClick={addNewUser}
          className="mt-4 w-full bg-purple-500 hover:bg-purple-600 text-black font-bold py-2 rounded-lg text-sm"
        >
          ➕ Add User
        </button>
      </div>

      {/* ✅ User List */}
      {loadingUsers ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
        </div>
      ) : (
        <div className="space-y-4 max-h-[400px] overflow-y-auto">

          {users.map((u) => (
            <div
              key={u.id}
              className="bg-[#0A0A0A] border border-[#262626] rounded-lg p-4 space-y-3"
            >
              {/* User Header */}
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-white font-semibold">{u.full_name}</p>
                  <p className="text-[11px] text-gray-500">{u.email}</p>
                </div>

                {/* ✅ Role Dropdown */}
                <select
                  value={u.role}
                  onChange={(e) => updateUserRole(u.id, e.target.value)}
                  className="bg-[#111] border border-[#333] px-2 py-1 rounded text-xs text-white"
                >
                  <option value="participant">Participant</option>
                  <option value="team_lead">Team Lead</option>
                  <option value="gate_volunteer">Gate Volunteer</option>
                  <option value="admin">Cluster Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>

              {/* ✅ Cluster Assignment (for admin/cluster admin role) */}
              {u.role === 'admin' && (
                <div className="bg-[#1a1a1a] border border-[#333] rounded-lg p-3">
                  <label className="text-xs text-gray-400 block mb-2">Assign to Cluster (max 3 admins per cluster):</label>
                  <select
                    value={u.assigned_cluster_id || clusters.find(c => c.monitor_id === u.id)?.id || ''}
                    onChange={(e) => assignCluster(u.id, e.target.value)}
                    className="w-full bg-[#111] border border-[#444] px-2 py-1 rounded text-xs text-white"
                  >
                    <option value="">-- Select Cluster --</option>
                    {clusters.map((cluster) => {
                      const adminCount = cluster.adminCount || 0;
                      const maxAdmins = cluster.maxAdmins || 3;
                      const isFull = adminCount >= maxAdmins && !cluster.admins?.some((a: any) => a.id === u.id);
                      return (
                        <option 
                          key={cluster.id} 
                          value={cluster.id}
                          disabled={isFull}
                        >
                          {cluster.name} ({adminCount}/{maxAdmins} admins){isFull ? ' - FULL' : ''}
                        </option>
                      );
                    })}
                  </select>
                  {(u.assigned_cluster_id || clusters.find(c => c.monitor_id === u.id)) && (
                    <p className="text-green-400 text-[10px] mt-1">
                      ✓ Currently admin of: {clusters.find(c => c.id === u.assigned_cluster_id || c.monitor_id === u.id)?.name}
                    </p>
                  )}
                </div>
              )}

              <button
  onClick={() => deleteUser(u.id)}
  className="text-red-400 hover:text-red-500 text-xs font-bold uppercase tracking-widest"
>
  ❌ Disable User
</button>


              {/* ✅ Permission Toggles */}
              <div className="grid grid-cols-2 gap-3 text-xs text-gray-400">
                {["canImportTeams", "canShuffleTeams", "canManageUsers"].map((perm) => (
                  <label key={perm} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={u.permissions?.[perm] || false}
                      onChange={(e) =>
                        togglePermission(u.id, perm, e.target.checked)
                      }
                    />
                    {perm}
                  </label>
                ))}
              </div>
            </div>
          ))}

        </div>
      )}
    </div>
  </div>
)}


    </div>
    
  );
}
