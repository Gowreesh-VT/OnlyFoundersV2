"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Clock, Filter, Search, Square, TrendingUp, User, Loader2, LogOut, Edit3, X } from "lucide-react";
import AdminBottomNav from "../../components/AdminBottomNav";
import { useCache } from "@/lib/cache/CacheProvider";

// Local type for submissions
type Submission = {
  id: string;
  team_id: string;
  status: string;
  score?: number;
  project_title?: string;
  team?: {
    id: string;
    name: string;
    code?: string;
  };
  created_at: string;
};

type TeamStatus = "PENDING" | "GRADED";

type Team = {
  name: string;
  id: string;
  project: string;
  status: TeamStatus;
  score?: string;
  badge?: "orange";
  submissionId: string;
};

const filters = ["All Teams", "Needs Grading", "Graded"];

const statusClasses: Record<TeamStatus, string> = {
  PENDING: "bg-orange-500/10 text-orange-500 border border-orange-500/20",
  GRADED: "bg-green-500/10 text-green-500 border border-green-500/20",
};

export default function AdminDashboardPage() {
  const router = useRouter();
  const cache = useCache();
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState(0);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [collegeName, setCollegeName] = useState("");
  const [userName, setUserName] = useState("Admin");
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showEditName, setShowEditName] = useState(false);
  const [newName, setNewName] = useState("");
  const [isSavingName, setIsSavingName] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      // Check cache for user info
      const cachedUser = cache.get<{ name: string; college: string }>('admin-user');
      const cachedSubmissions = cache.get<Submission[]>('admin-submissions');

      if (cachedUser && cachedSubmissions) {
        setUserName(cachedUser.name);
        setCollegeName(cachedUser.college);
        setSubmissions(cachedSubmissions);
        setLoading(false);
        return;
      }

      // Check auth and role
      const userRes = await fetch('/api/auth/me');
      if (!userRes.ok) {
        router.push('/auth/login');
        return;
      }
      const userData = await userRes.json();
      if (userData.user?.role !== 'admin' && userData.user?.role !== 'super_admin') {
        router.push('/dashboard');
        return;
      }

      const name = userData.user?.fullName || 'Admin';
      const college = userData.user?.college?.name || 'Your College';
      setUserName(name);
      setCollegeName(college);
      cache.set('admin-user', { name, college }, 10 * 60 * 1000);

      // Fetch submissions
      const submissionsRes = await fetch('/api/submissions');
      if (submissionsRes.ok) {
        const submissionsData = await submissionsRes.json();
        setSubmissions(submissionsData.submissions || []);
        cache.set('admin-submissions', submissionsData.submissions || []);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }, [router, cache]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    cache.invalidateAll();
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/auth/login');
    } catch (error) {
      console.error('Logout failed:', error);
      setIsLoggingOut(false);
    }
  };

  // Convert submissions to teams format
  const teams: Team[] = submissions.map(s => ({
    name: s.team?.name || 'Unknown Team',
    id: s.team?.code || s.id.slice(0, 10),
    project: s.project_title || 'Unknown Project',
    status: s.status === 'not_viewed' || s.status === 'waiting' ? 'PENDING' : 'GRADED',
    badge: s.status === 'not_viewed' ? 'orange' : undefined,
    score: s.status === 'selected' ? '✓ Selected' : s.status === 'not_selected' ? 'Not Selected' : undefined,
    submissionId: s.id,
  }));

  const totalSubmissions = teams.length;
  const pendingGrade = teams.filter(t => t.status === 'PENDING').length;
  const gradePercentage = totalSubmissions > 0
    ? Math.round((teams.filter(t => t.status === 'GRADED').length / totalSubmissions) * 100)
    : 0;

  const filteredTeams = teams.filter(team => {
    const matchesSearch = team.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      team.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      team.project.toLowerCase().includes(searchQuery.toLowerCase());

    if (activeFilter === 1) return matchesSearch && team.status === 'PENDING';
    if (activeFilter === 2) return matchesSearch && team.status === 'GRADED';
    return matchesSearch;
  });

  const handleGrade = async (submissionId: string, status: string) => {
    try {
      const response = await fetch(`/api/submissions/${submissionId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      if (response.ok) {
        cache.invalidate('admin-submissions');
        fetchData();
      }
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0A0A0A] text-white relative overflow-hidden">
        <div className="absolute inset-0 z-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-full h-2/3 opacity-10"
            style={{ backgroundImage: "url('https://images.unsplash.com/photo-1516912481808-3406841bd33c?q=80&w=2444&auto=format&fit=crop')" }} />
        </div>
        <div className="mx-auto max-w-md pb-10 relative z-10">
          {/* Header Skeleton */}
          <header className="px-6 py-3 flex items-center justify-between border-b border-[#262626] bg-[#0A0A0A]">
            <div className="h-10 w-24 bg-[#262626] rounded animate-pulse" />
            <div className="w-10 h-10 rounded-full bg-[#262626] animate-pulse" />
          </header>
          <div className="px-6 py-6">
            {/* Greeting Skeleton */}
            <div className="mb-6">
              <div className="h-8 bg-[#262626] rounded w-48 mb-2 animate-pulse" />
            </div>
            {/* Stats Skeleton */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-[#121212] border border-[#262626] rounded-xl p-4 animate-pulse">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-[#262626]" />
                    <div className="h-6 w-12 bg-[#262626] rounded" />
                  </div>
                  <div className="h-3 w-20 bg-[#262626] rounded" />
                </div>
              ))}
            </div>
            {/* Teams Header Skeleton */}
            <div className="flex items-center justify-between mb-4">
              <div className="h-5 w-32 bg-[#262626] rounded animate-pulse" />
              <div className="flex gap-2">
                <div className="h-8 w-24 bg-[#262626] rounded-lg animate-pulse" />
              </div>
            </div>
            {/* Team Cards Skeleton */}
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-[#121212] border border-[#262626] rounded-xl p-4 animate-pulse">
                  <div className="flex items-center justify-between mb-2">
                    <div className="h-5 w-32 bg-[#262626] rounded" />
                    <div className="h-5 w-16 bg-[#262626] rounded" />
                  </div>
                  <div className="h-4 w-24 bg-[#262626] rounded" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0A0A0A] text-white relative overflow-hidden">
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

      <div className="mx-auto max-w-md pb-10 relative z-10">
        {/* Header - Similar to Super Admin */}
        <header className="px-6 py-3 flex items-center justify-between border-b border-[#262626] bg-[#0A0A0A]">
          <div className="flex items-center">
            <img
              src="/only-founders-logo.png"
              alt="Logo"
              className="h-10 w-auto object-contain"
            />
          </div>

          {/* Profile Menu */}
          <div className="relative">
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="w-10 h-10 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary font-serif text-sm hover:border-primary/50 transition-colors uppercase"
            >
              {userName.charAt(0)}
            </button>

            {showProfileMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowProfileMenu(false)} />
                <div className="absolute right-0 top-full mt-2 w-52 bg-[#121212] border border-[#262626] rounded-xl shadow-2xl overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-[#262626]">
                    <p className="text-white font-medium text-sm truncate">{userName}</p>
                    <p className="text-[10px] text-primary uppercase tracking-wider">Admin • {collegeName}</p>
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
        </header>

        <div className="px-6 py-6">
          <h1 className="mb-6 text-3xl font-serif text-white">
            Hello, <span className="border-b-2 border-primary">{userName.split(' ')[0]}</span>
          </h1>

          <div className="mb-6 grid grid-cols-2 gap-3">
            <div className="rounded-sm border border-[#2A2A2A] bg-[#121212] p-4 hover:border-primary/30 transition-colors">
              <div className="mb-2 flex items-start justify-between">
                <span className="text-[11px] uppercase tracking-[0.14em] text-gray-500">
                  Submissions
                </span>
                <Square className="h-5 w-5 text-gray-600" />
              </div>
              <div className="flex items-end gap-2">
                <p className="text-3xl font-semibold text-white">{totalSubmissions}</p>
                <div className="mb-1 flex items-center gap-1 text-[11px] text-green-500">
                  <TrendingUp className="h-3 w-3" />
                  <span>live</span>
                </div>
              </div>
            </div>

            <div className="rounded-sm border border-[#2A2A2A] bg-[#121212] p-4 hover:border-primary/30 transition-colors">
              <div className="mb-2 flex items-start justify-between">
                <span className="text-[11px] uppercase tracking-[0.14em] text-gray-500">
                  Pending Grade
                </span>
                <Clock className="h-5 w-5 text-gray-600" />
              </div>
              <div className="flex items-end gap-2">
                <p className="text-3xl font-semibold text-primary">{pendingGrade}</p>
                <span className="mb-1 text-[11px] text-gray-500">{pendingGrade > 0 ? 'urgent' : 'done'}</span>
              </div>
            </div>
          </div>

          <div className="mb-6 rounded-sm border border-[#2A2A2A] bg-[#121212] p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-[0.14em] text-gray-500">
                Batch Status
              </span>
              <div className="text-right">
                <p className="text-2xl font-semibold text-white">{gradePercentage}%</p>
                <p className="text-xs text-gray-500">Graded</p>
              </div>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-sm border border-[#2A2A2A] bg-[#0A0A0A]">
              <div className="h-full bg-primary shadow-[0_0_10px_rgba(255,215,0,0.3)]" style={{ width: `${gradePercentage}%` }} />
            </div>
          </div>

          <div className="mb-4 flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-600" />
              <input
                type="text"
                placeholder="Search team or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-sm border border-[#2A2A2A] bg-[#121212] py-3 pl-11 pr-4 text-sm text-white placeholder:text-gray-600 focus:border-primary focus:outline-none transition-colors"
              />
            </div>
            <button
              type="button"
              className="flex items-center justify-center rounded-sm border border-[#2A2A2A] bg-[#121212] px-4 transition-all duration-150 hover:border-primary active:translate-y-[1px] active:scale-[0.98]"
            >
              <Filter className="h-5 w-5 text-gray-500" />
            </button>
          </div>

          <div className="mb-6 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {filters.map((filter, idx) => (
              <button
                key={filter}
                type="button"
                onClick={() => setActiveFilter(idx)}
                className={`whitespace-nowrap rounded-sm px-5 py-2 text-sm font-semibold transition-all duration-150 active:translate-y-[1px] active:scale-[0.98] ${idx === activeFilter
                  ? "bg-primary text-black shadow-[0_0_15px_rgba(255,215,0,0.2)]"
                  : "border border-[#2A2A2A] bg-[#121212] text-gray-400 hover:border-primary hover:text-primary"
                  }`}
              >
                {filter}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            {filteredTeams.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {searchQuery ? 'No teams found matching your search' : 'No submissions yet'}
              </div>
            ) : (
              filteredTeams.map((team) => (
                <article
                  key={team.submissionId}
                  className="rounded-sm border border-[#2A2A2A] bg-[#121212] p-4 hover:border-primary/30 transition-colors"
                >
                  <div className="mb-3 flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-serif font-semibold text-white">
                        {team.name}
                      </h3>
                      {team.badge ? (
                        <span className="h-2 w-2 rounded-full bg-orange-500 animate-pulse" />
                      ) : null}
                    </div>
                    <span
                      className={`rounded-sm px-3 py-1 text-xs font-semibold ${statusClasses[team.status]}`}
                    >
                      {team.status}
                    </span>
                  </div>

                  <p className="mb-3 text-xs text-gray-500">ID: {team.id}</p>

                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[#2A2A2A] bg-[#0A0A0A]">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                      <span className="text-sm text-gray-500">
                        Project: {team.project}
                      </span>
                    </div>
                    {team.score ? (
                      <div className="text-right">
                        <p className="text-[11px] text-gray-500">STATUS</p>
                        <p className={`text-lg font-semibold ${team.score.includes('Selected') ? 'text-green-500' : 'text-gray-400'}`}>
                          {team.score}
                        </p>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleGrade(team.submissionId, 'selected')}
                          className="rounded-sm bg-green-500 px-4 py-2 text-xs font-semibold text-black transition-all duration-150 hover:bg-green-400"
                        >
                          Select
                        </button>
                        <button
                          type="button"
                          onClick={() => handleGrade(team.submissionId, 'not_selected')}
                          className="rounded-sm bg-gray-600 px-4 py-2 text-xs font-semibold text-white transition-all duration-150 hover:bg-gray-500"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <AdminBottomNav />

      {/* Edit Name Modal */}
      {showEditName && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80">
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
                        cache.set('admin-user', { name: newName.trim(), college: collegeName }, 10 * 60 * 1000);
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
    </main>
  );
}
