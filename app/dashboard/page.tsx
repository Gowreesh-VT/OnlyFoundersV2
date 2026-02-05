"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  KeySquare,
  ArrowRight,
  Bell,
  GraduationCap,
  Hourglass,
  ClipboardList,
  Megaphone,
  Copy,
  Check,
  Users,
  Calendar,
  Sparkles,
  X,
  AlertTriangle,
  Clock,
  FileText,
  ChevronRight,
  Loader2,
  LogOut,
  Settings,
  Edit3,
  User,
  Menu,
} from "lucide-react";
import StudentBottomNav from "../components/StudentBottomNav";
import { useCache } from "@/lib/cache/CacheProvider";
import type { Team as BaseTeam } from "@/lib/types/database";

// Extend Team type with code field used in this page
type Team = BaseTeam & {
  code?: string;
};

type CurrentUser = {
  id?: string;
  fullName?: string;
  email?: string;
  role?: string;
  photoUrl?: string;
  entityId?: string;
  team?: Team | null;
  college?: { name?: string } | null;
};

// Local types for schedule
type ScheduleEvent = {
  id: string;
  title: string;
  time: string;
  active?: boolean;
  description?: string;
  start_time?: string;
  end_time?: string;
  event_date?: string;
  location?: string;
  is_active?: boolean;
};

type TaskWithStatus = {
  id: string;
  title: string;
  description: string | null;
  deadline: string | null;
  teamStatus: "pending" | "submitted" | "overdue";
};

// Active Pitch type for real-time updates
interface ActivePitch {
  id: string;
  team_id: string;
  pitch_title?: string;
  actual_start: string;
  pitch_duration_seconds: number;
  status: string;
  team?: {
    id: string;
    name: string;
    domain?: string;
  };
}

export default function DashboardPage() {
  const router = useRouter();
  const cache = useCache();
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [countdown, setCountdown] = useState({ days: 2, hours: 14, minutes: 30, seconds: 45 });
  
  // Active pitch state for real-time updates
  const [activePitch, setActivePitch] = useState<ActivePitch | null>(null);
  const [pitchTimeRemaining, setPitchTimeRemaining] = useState(0);
  const [clusterId, setClusterId] = useState<string | null>(null);

  // User data
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [schedule, setSchedule] = useState<ScheduleEvent[]>([]);
  const [tasks, setTasks] = useState<TaskWithStatus[]>([]);
  const [homeData, setHomeData] = useState<any>(null);

  // Expanded states
  const [showSchedule, setShowSchedule] = useState(false);
  const [showTasks, setShowTasks] = useState(false);

  // Profile dropdown states
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showEditName, setShowEditName] = useState(false);
  const [editNameValue, setEditNameValue] = useState("");
  const [isSavingName, setIsSavingName] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const hasTeam = true;

  // Fetch user data and active pitch
  const fetchData = useCallback(async () => {
    try {
      // Fetch user
      const userRes = await fetch('/api/auth/me');
      if (!userRes.ok) {
        router.push('/auth/login');
        return;
      }
      const userData = await userRes.json();
      // Fetch dashboard home data
      const homeRes = await fetch('/api/dashboard/home');
      if (homeRes.ok) {
        const homeJson = await homeRes.json();
        setHomeData(homeJson);
      }

      // Redirect based on role
      const role = userData.user?.role;
      if (role === 'super_admin') {
        router.push('/super-admin/dashboard');
        return;
      } else if (role === 'admin') {
        router.push('/cluster-admin/dashboard');
        return;
      } else if (role === 'gate_volunteer') {
        router.push('/gate/scanner');
        return;
      } else if (role === 'event_coordinator') {
        router.push('/coordinator/dashboard');
        return;
      }
      
      setUser(userData.user);
      
      // Get cluster ID from user's team
      const userClusterId = userData.user?.team?.cluster_id;
      if (userClusterId) {
        setClusterId(userClusterId);
        
        // Fetch active pitch for this cluster
        const pitchRes = await fetch(`/api/cluster-admin/pitch?clusterId=${userClusterId}`);
        if (pitchRes.ok) {
          const pitchData = await pitchRes.json();
          setActivePitch(pitchData.activePitch);
        }
      }

      // Fetch schedule
      const scheduleRes = await fetch('/api/schedule');
      if (scheduleRes.ok) {
        const scheduleData = await scheduleRes.json();
        setSchedule(scheduleData.schedule || []);
      }

      // Fetch tasks
      const tasksRes = await fetch('/api/tasks');
      if (tasksRes.ok) {
        const tasksData = await tasksRes.json();
        setTasks(tasksData.tasks || []);
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
  
  // Poll for pitch updates (replaces Supabase realtime)
  useEffect(() => {
    if (!clusterId) return;

    const pollPitchStatus = async () => {
      try {
        const pitchRes = await fetch(`/api/cluster-admin/pitch?clusterId=${clusterId}`);
        if (pitchRes.ok) {
          const pitchData = await pitchRes.json();
          setActivePitch(pitchData.activePitch);
        }
      } catch (error) {
        console.error('Error polling pitch status:', error);
      }
    };

    // Poll every 5 seconds for pitch updates
    const interval = setInterval(pollPitchStatus, 5000);

    return () => {
      clearInterval(interval);
    };
  }, [clusterId]);
  
  // Pitch timer countdown
  useEffect(() => {
    if (!activePitch || !activePitch.actual_start) return;

    const interval = setInterval(() => {
      const startTime = new Date(activePitch.actual_start).getTime();
      const now = Date.now();
      const elapsed = Math.floor((now - startTime) / 1000);
      const remaining = activePitch.pitch_duration_seconds - elapsed;
      setPitchTimeRemaining(remaining > 0 ? remaining : 0);
    }, 1000);

    return () => clearInterval(interval);
  }, [activePitch]);

  // Live countdown
  useEffect(() => {
  if (!homeData?.countdown?.endsAt) return;

  const endTime = new Date(homeData.countdown.endsAt).getTime();

  const timer = setInterval(() => {
    const now = Date.now();
    const diff = endTime - now;

    if (diff <= 0) {
      clearInterval(timer);
      setCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      return;
    }

    setCountdown({
      days: Math.floor(diff / (1000 * 60 * 60 * 24)),
      hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((diff / (1000 * 60)) % 60),
      seconds: Math.floor((diff / 1000) % 60),
    });
  }, 1000);

  return () => clearInterval(timer);
}, [homeData?.countdown?.endsAt]);


  const handleCopyCode = () => {
    if (user?.team?.code) {
      const displayCode = user.team.code.slice(0, 3) + '-' + user.team.code.slice(3);
      navigator.clipboard.writeText(displayCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleEditName = () => {
    setEditNameValue(user?.fullName || "");
    setShowEditName(true);
    setShowProfileMenu(false);
  };

  const handleSaveName = async () => {
    if (!editNameValue.trim()) return;

    setIsSavingName(true);
    try {
      const response = await fetch('/api/profile/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName: editNameValue.trim() }),
      });

      if (response.ok) {
        setUser(prev => prev ? {
          ...prev,
          fullName: editNameValue.trim()
        } : null);
        setShowEditName(false);
      }
    } catch (error) {
      console.error('Failed to update name:', error);
    } finally {
      setIsSavingName(false);
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    setShowProfileMenu(false);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/auth/login');
    } catch (error) {
      console.error('Logout failed:', error);
      setIsLoggingOut(false);
    }
  };

  // Format schedule items
  const scheduleItems = schedule.map(s => ({
    id: s.id,
    title: s.title,
    description: s.description || '',
    time: s.start_time && s.end_time ? `${s.start_time} - ${s.end_time}` : s.time,
    date: s.event_date ? new Date(s.event_date).getDate().toString() : '1',
    month: s.event_date ? new Date(s.event_date).toLocaleDateString('en', { month: 'short' }).toUpperCase() : 'JAN',
    location: s.location || '',
    active: s.is_active ?? s.active ?? false,
  }));

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0A0A0A] px-4 py-6 pb-28 relative overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-full h-2/3 opacity-10"
            style={{ backgroundImage: "url('https://images.unsplash.com/photo-1516912481808-3406841bd33c?q=80&w=2444&auto=format&fit=crop')" }} />
        </div>
        <div className="max-w-md mx-auto relative z-10">
          {/* Header Skeleton */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#262626] animate-pulse" />
              <div>
                <div className="h-5 w-24 bg-[#262626] rounded mb-1 animate-pulse" />
                <div className="h-3 w-32 bg-[#262626] rounded animate-pulse" />
              </div>
            </div>
            <div className="w-10 h-10 rounded-full bg-[#262626] animate-pulse" />
          </div>
          {/* Greeting Skeleton */}
          <div className="mb-6">
            <div className="h-8 w-40 bg-[#262626] rounded mb-2 animate-pulse" />
            <div className="h-4 w-64 bg-[#262626] rounded animate-pulse" />
          </div>
          {/* Countdown Skeleton */}
          <div className="bg-[#121212] border border-[#262626] rounded-xl p-4 mb-6 animate-pulse">
            <div className="flex justify-between gap-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex-1 text-center">
                  <div className="h-8 w-12 mx-auto bg-[#262626] rounded mb-1" />
                  <div className="h-3 w-10 mx-auto bg-[#262626] rounded" />
                </div>
              ))}
            </div>
          </div>
          {/* Team Card Skeleton */}
          <div className="bg-[#121212] border border-[#262626] rounded-xl p-4 mb-6 animate-pulse">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#262626]" />
                <div>
                  <div className="h-4 w-24 bg-[#262626] rounded mb-1" />
                  <div className="h-3 w-20 bg-[#262626] rounded" />
                </div>
              </div>
              <div className="h-8 w-16 bg-[#262626] rounded" />
            </div>
          </div>
          {/* Quick Actions Skeleton */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-[#121212] border border-[#262626] rounded-xl p-4 animate-pulse">
                <div className="w-8 h-8 bg-[#262626] rounded-lg mb-2" />
                <div className="h-4 w-16 bg-[#262626] rounded" />
              </div>
            ))}
          </div>
        </div>
        <StudentBottomNav />
      </main>
    );
  }

  const teamCode = user?.team?.code ? user.team.code.slice(0, 3) + '-' + user.team.code.slice(3) : '';
  const firstName = user?.fullName?.split(' ')[0] || 'User';
  const milestoneRemaining =
  homeData?.milestone?.deadline
    ? Math.max(
        0,
        Math.floor(
          (new Date(homeData.milestone.deadline).getTime() - Date.now()) / 60000
        )
      )
    : null;

  return (
    <main className="min-h-screen bg-[#0A0A0A] px-4 py-6 pb-28 relative overflow-hidden">
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

      <div className="relative z-10 max-w-md mx-auto">
        {/* Top Status Bar */}
        {hasTeam && (
          <div className="flex items-center justify-between mb-6">
            <Menu className="text-gray-400" />

            <div className="text-center">
              <p className="text-[9px] tracking-[0.3em] text-gray-500 uppercase">
                Event Status
              </p>
              <p className="text-[10px] tracking-widest text-primary font-bold">
                PHASE 02 · HACKING
              </p>
            </div>

            <Bell className="text-gray-400" />
          </div>
        )}


        {/* Header */}
        <header className="mt-6 flex justify-between items-start">
          <div>
            <p className="text-[10px] tracking-[0.3em] uppercase text-primary font-bold">
              Student Dashboard
            </p>
            {hasTeam ? (
              <h1 className="mt-2 text-3xl font-serif font-bold leading-tight text-white">
                Hello, <span className="italic font-medium text-gray-300">{firstName}</span>
              </h1>
            ) : (
              <h1 className="mt-2 text-3xl font-serif font-bold leading-tight text-white">
                {user?.fullName || 'Welcome'}
              </h1>
            )}
            <p className="mt-2 flex items-center gap-2 text-gray-400 text-sm">
              {hasTeam && <GraduationCap size={16} className="text-primary" />}
              {user?.college?.name || 'Your College'}
            </p>
          </div>
          <div className="relative">
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="h-14 w-14 rounded-full border-2 border-primary/30 bg-gradient-to-br from-primary/20 to-[#121212] flex items-center justify-center text-primary font-serif text-xl shadow-[0_0_20px_rgba(255,215,0,0.1)] hover:border-primary/50 transition-colors cursor-pointer"
            >
              {firstName.charAt(0)}
            </button>

            {/* Profile Dropdown Menu */}
            {showProfileMenu && (
              <div className="absolute right-0 top-16 w-56 bg-[#121212] border border-[#262626] rounded-xl shadow-2xl overflow-hidden z-50">
                <div className="px-4 py-3 border-b border-[#262626]">
                  <p className="text-white font-medium truncate">{user?.fullName}</p>
                  <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                </div>

                <div className="py-2">
                  <button
                    onClick={handleEditName}
                    className="w-full px-4 py-3 flex items-center gap-3 text-gray-300 hover:bg-[#1A1A1A] hover:text-white transition-colors"
                  >
                    <Edit3 className="w-4 h-4" />
                    <span className="text-sm">Edit Name</span>
                  </button>
                </div>

                <div className="border-t border-[#262626] py-2">
                  <button
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                    className="w-full px-4 py-3 flex items-center gap-3 text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    <span className="text-sm">{isLoggingOut ? 'Logging out...' : 'Logout'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Click outside to close */}
            {showProfileMenu && (
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowProfileMenu(false)}
              />
            )}
          </div>
        </header>


        {/* Has Team State */}
        {hasTeam && (
          <>
              {/* Team Code */}
              <button
                onClick={handleCopyCode}
                className="w-full mt-4 bg-[#121212] border border-[#262626] rounded-xl p-4 flex items-center justify-between hover:border-primary/50 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <Users className="w-5 h-5 text-primary" />
                  </div>
                  <div className="text-left">
                    <p className="text-[9px] text-gray-500 uppercase tracking-widest">Team Code</p>
                    <p className="font-mono text-lg text-white tracking-widest">{teamCode}</p>
                  </div>
                </div>
                <div className={`p-2 rounded-lg transition-all ${copied ? "bg-green-500/20" : "bg-[#0A0A0A]"}`}>
                  {copied ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5 text-gray-500 group-hover:text-primary transition-colors" />}
                </div>
              </button>

            {/* Main Countdown */}
            <section className="mt-6 text-center">
              <p className="text-[10px] tracking-[0.3em] uppercase text-gray-500">
                Time Remaining
              </p>

              <h1 className="mt-3 text-5xl font-bold font-mono text-white">
                {String(countdown.hours).padStart(2, "0")}:
                {String(countdown.minutes).padStart(2, "0")}:
                {String(countdown.seconds).padStart(2, "0")}
              </h1>

              <div className="mt-4 h-1 w-24 mx-auto bg-primary rounded" />
            </section>

            {/* Next Milestone */}
            <section className="mt-8 bg-[#121212] border border-[#262626] rounded-xl p-4">
              <div className="flex justify-between items-center mb-2">
                <p className="text-[9px] tracking-widest text-gray-500 uppercase">
                  Next Milestone
                </p>
                <span className="text-yellow-400 text-xs font-semibold">
                  {homeData?.milestone?.status ?? ""}
                </span>

              </div>

              <p className="text-white font-semibold">
                {homeData?.milestone?.title ?? "--"}
              </p>

              <div className="mt-2 flex justify-between text-xs text-gray-400">
                <span>Until Deadline</span>
                <span className="text-yellow-400">
                  {milestoneRemaining !== null ? `${milestoneRemaining}m` : "--"}
                </span>

              </div>

              <div className="mt-2 h-1 bg-gray-700 rounded">
                <div
                  className="h-1 bg-primary rounded transition-all"
                  style={{
                    width:
                      milestoneRemaining !== null
                        ? `${Math.max(5, 100 - milestoneRemaining)}%`
                        : "0%",
                  }}
                />

              </div>
            </section>

            {/* Live Pitch - Real-time updates */}
            {activePitch ? (
              <section className={`mt-6 border-2 rounded-xl p-4 bg-black transition-all ${
                pitchTimeRemaining <= 30 ? 'border-red-500 animate-pulse' : 'border-primary'
              }`}>
                <div className="flex items-center justify-center gap-2 mb-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <p className="text-[9px] tracking-widest text-green-500 uppercase">
                    Live Now
                  </p>
                </div>

                <h2 className="text-center text-2xl font-bold text-primary">
                  {activePitch.team?.name || 'Unknown Team'}
                </h2>

                <p className="text-center text-xs text-gray-400 mt-1">
                  {activePitch.pitch_title || activePitch.team?.domain || 'Pitching...'}
                </p>

                <div className={`mt-4 rounded-lg py-4 text-center ${
                  pitchTimeRemaining <= 30 ? 'bg-red-500/10' : 'bg-[#121212]'
                }`}>
                  <p className={`text-4xl font-mono font-bold ${
                    pitchTimeRemaining <= 30 ? 'text-red-500' : 'text-white'
                  }`}>
                    {String(Math.floor(pitchTimeRemaining / 60)).padStart(2, '0')}:
                    {String(pitchTimeRemaining % 60).padStart(2, '0')}
                  </p>
                  <p className={`text-[9px] tracking-widest uppercase mt-1 ${
                    pitchTimeRemaining <= 30 ? 'text-red-400' : 'text-primary'
                  }`}>
                    {pitchTimeRemaining <= 30 ? 'Almost Done!' : 'Time Remaining'}
                  </p>
                </div>
                
                {/* Own team indicator */}
                {user?.team?.id === activePitch.team_id && (
                  <div className="mt-3 text-center">
                    <span className="text-xs bg-primary/20 text-primary px-3 py-1 rounded-full border border-primary/30">
                      🎤 Your Team is Pitching!
                    </span>
                  </div>
                )}
              </section>
            ) : (
              <section className="mt-6 border border-[#262626] rounded-xl p-4 bg-[#0A0A0A]">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-gray-500" />
                  <p className="text-[9px] tracking-widest text-gray-500 uppercase">
                    No Active Pitch
                  </p>
                </div>

                <p className="text-center text-sm text-gray-400">
                  Waiting for next team to present...
                </p>
              </section>
            )}
            {/* Syndicate Valuation */}
            <section className="mt-8 bg-[#121212] border border-[#262626] rounded-xl p-5">
              <p className="text-[9px] tracking-widest text-gray-500 uppercase mb-2">
                Syndicate Valuation
              </p>

              <div className="flex items-end justify-between">
                <div>
                  <p className="text-xs text-gray-400">Total Portfolio Value</p>
                  <h2 className="text-3xl font-bold text-primary mt-1">
                    ${homeData?.valuation?.total?.toLocaleString() ?? "--"}

                  </h2>
                </div>

                <div className="text-right">
                  <p className="text-green-400 text-xs font-semibold">+12.5%</p>
                  <p className="text-[10px] text-gray-500">Since Start</p>
                </div>
              </div>

              {/* Fake graph bar (UI only) */}
              <div className="mt-4 h-10 w-full bg-gradient-to-r from-primary/10 via-primary/30 to-primary/10 rounded" />
            </section>






            {/* Action Cards */}
            <section className="mt-6 grid grid-cols-2 gap-4">
              <button
                onClick={() => setShowTasks(true)}
                className="bg-[#121212] border border-[#262626] rounded-xl p-4 hover:border-primary/50 hover:shadow-[0_0_20px_rgba(255,215,0,0.05)] transition-all group text-left"
              >
                <ClipboardList className="text-primary" />
                <h4 className="mt-4 font-semibold text-white">Pending Tasks</h4>
                <p className="text-sm text-gray-500 mt-1">{tasks.filter(t => t.teamStatus === "pending").length} remaining</p>
                <div className="mt-3 flex items-center gap-1 text-primary text-[9px] uppercase tracking-widest font-bold">
                  <span>View</span>
                  <ChevronRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                </div>
              </button>
            </section>
            {/* Commits & Teams Active */}
            <section className="mt-8 grid grid-cols-2 gap-4">
              {/* Commits */}
              <div className="bg-[#121212] border border-[#262626] rounded-xl p-4">
                <p className="text-[9px] tracking-widest uppercase text-gray-500">
                  Commits
                </p>
                <h3>{homeData?.stats?.commits ?? "--"}</h3>
                <p className="mt-1 text-xs text-green-400 font-semibold">
                  +24/hr
                </p>
              </div>

              {/* Teams Active */}
              <div className="bg-[#121212] border border-[#262626] rounded-xl p-4">
                <p className="text-[9px] tracking-widest uppercase text-gray-500">
                  Teams Active
                </p>
                <h3>{homeData?.stats?.teamsActive ?? "--"}</h3>
                <p className="mt-1 text-xs text-green-400 font-semibold">
                  100% Online
                </p>
              </div>
            </section>             
          </>
        )}
        {/* Schedule */}
        <section className="mt-8">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-serif text-2xl font-bold text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              Schedule
            </h3>
            <button
              onClick={() => setShowSchedule(true)}
              className="text-primary text-[9px] uppercase tracking-[0.2em] font-bold"
            >
              View All
            </button>
          </div>

          {scheduleItems.length === 0 ? (
            <div className="bg-[#121212] border border-[#262626] rounded-xl p-6 text-center text-gray-500">
              No upcoming events
            </div>
          ) : (
            scheduleItems.slice(0, 2).map((item) => (
              <button
                key={item.id}
                onClick={() => setShowSchedule(true)}
                className="w-full mb-3 bg-[#121212] border border-[#262626] rounded-xl p-4 flex justify-between items-center text-left"
              >
                <div className="flex gap-4 items-center">
                  <div className="text-center px-3 py-2 rounded-lg bg-[#0A0A0A]">
                    <p className="text-[9px] font-bold tracking-widest text-gray-500">{item.month}</p>
                    <p className="text-lg font-bold text-white">{item.date}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-white">{item.title}</p>
                    <p className="text-sm text-gray-500 mt-1">{item.time}</p>
                  </div>
                </div>
              </button>
            ))
          )}
        </section>

        <footer className="mt-12 text-center">
          <div className="flex items-center justify-center gap-3 text-[10px] text-gray-600 tracking-widest">
            <span className="w-12 h-px bg-[#262626]" />
            <span>© 2026 ONLYFOUNDERS</span>
            <span className="w-12 h-px bg-[#262626]" />
          </div>
        </footer>
      </div>

      {/* Schedule Modal */}
      {showSchedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <div className="bg-[#121212] border border-[#262626] rounded-2xl w-full max-w-md max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-[#262626]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-serif text-lg font-bold text-white">Full Schedule</h2>
                  <p className="text-xs text-gray-500">{scheduleItems.length} events</p>
                </div>
              </div>
              <button onClick={() => setShowSchedule(false)} className="p-2 text-gray-500 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto max-h-[60vh] p-4 space-y-3">
              {scheduleItems.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No upcoming events</div>
              ) : (
                scheduleItems.map((item) => (
                  <div
                    key={item.id}
                    className={`p-4 rounded-xl border ${item.active ? "border-primary/50 bg-primary/5" : "border-[#262626] bg-[#0A0A0A]"
                      }`}
                  >
                    <div className="flex gap-4">
                      <div className={`text-center px-3 py-2 rounded-lg flex-shrink-0 ${item.active ? "bg-primary/20" : "bg-[#121212]"}`}>
                        <p className={`text-[9px] font-bold tracking-widest ${item.active ? "text-primary" : "text-gray-500"}`}>{item.month}</p>
                        <p className={`text-xl font-bold ${item.active ? "text-primary" : "text-white"}`}>{item.date}</p>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-white">{item.title}</p>
                          {item.active && (
                            <span className="px-2 py-0.5 bg-primary/20 text-primary text-[8px] font-bold uppercase tracking-widest rounded-full animate-pulse">Live</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-400 mt-1">{item.description}</p>
                        <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {item.time}
                          </span>
                          <span>{item.location}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tasks Modal */}
      {showTasks && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <div className="bg-[#121212] border border-[#262626] rounded-2xl w-full max-w-md max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-[#262626]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
                  <ClipboardList className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-serif text-lg font-bold text-white">Tasks</h2>
                  <p className="text-xs text-gray-500">{tasks.filter(t => t.teamStatus === "pending").length} pending</p>
                </div>
              </div>
              <button onClick={() => setShowTasks(false)} className="p-2 text-gray-500 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto max-h-[60vh] p-4 space-y-3">
              {tasks.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No tasks assigned</div>
              ) : (
                tasks.map((task) => (
                  <div
                    key={task.id}
                    className={`p-4 rounded-xl border ${task.teamStatus === "pending"
                      ? "border-yellow-500/30 bg-yellow-500/5"
                      : task.teamStatus === "submitted"
                        ? "border-green-500/30 bg-green-500/5"
                        : "border-red-500/30 bg-red-500/5"
                      }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${task.teamStatus === "pending" ? "bg-yellow-500/20" : task.teamStatus === "submitted" ? "bg-green-500/20" : "bg-red-500/20"
                          }`}>
                          <FileText className={`w-4 h-4 ${task.teamStatus === "pending" ? "text-yellow-500" : task.teamStatus === "submitted" ? "text-green-500" : "text-red-500"
                            }`} />
                        </div>
                        <div>
                          <p className="font-semibold text-white">{task.title}</p>
                          <p className="text-sm text-gray-500 mt-1">{task.description}</p>
                          <p className="text-[10px] text-gray-600 mt-2">Due: {task.deadline ? new Date(task.deadline).toLocaleDateString() : 'No deadline'}</p>
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded text-[9px] font-bold uppercase tracking-wider ${task.teamStatus === "pending"
                        ? "bg-yellow-500/20 text-yellow-400"
                        : task.teamStatus === "submitted"
                          ? "bg-green-500/20 text-green-400"
                          : "bg-red-500/20 text-red-400"
                        }`}>
                        {task.teamStatus}
                      </span>
                    </div>
                    {task.teamStatus === "pending" && (
                      <Link
                        href="/submission"
                        className="mt-4 w-full block text-center py-2 border border-primary/30 text-primary text-sm font-semibold rounded-lg hover:bg-primary/10 transition-colors"
                      >
                        Submit Now
                      </Link>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Name Modal */}
      {showEditName && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <div className="bg-[#121212] border border-[#262626] rounded-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-[#262626]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
                  <Edit3 className="w-5 h-5 text-primary" />
                </div>
                <h2 className="font-serif text-lg font-bold text-white">Edit Name</h2>
              </div>
              <button onClick={() => setShowEditName(false)} className="p-2 text-gray-500 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              <label className="block text-[9px] text-gray-500 uppercase tracking-widest mb-2 font-bold">
                Full Name
              </label>
              <input
                type="text"
                value={editNameValue}
                onChange={(e) => setEditNameValue(e.target.value)}
                placeholder="Enter your full name"
                className="w-full py-3 px-4 bg-[#0A0A0A] border border-[#262626] rounded-lg text-white text-sm placeholder-gray-600 focus:outline-none focus:border-primary transition-colors mb-6"
              />

              <div className="flex gap-3">
                <button
                  onClick={() => setShowEditName(false)}
                  className="flex-1 py-3 border border-[#262626] text-gray-400 font-semibold rounded-xl hover:border-white hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveName}
                  disabled={isSavingName || !editNameValue.trim()}
                  className="flex-1 py-3 bg-primary text-black font-semibold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {isSavingName ? <Loader2 className="w-5 h-5 animate-spin" /> : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <StudentBottomNav />
    </main>
  );
}
