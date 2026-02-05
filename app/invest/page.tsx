"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Cluster,
  Team,
  Profile,
  EventStage
} from "@/lib/types/database";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  Lock,
  Loader2,
  AlertTriangle,
  CheckCircle,
  XCircle,
  TrendingUp,
  Wallet,
  Search
} from "lucide-react";
import StudentBottomNav from "../components/StudentBottomNav";

// ============================================
// CONFIGURATION
// ============================================

const INITIAL_BUDGET = 1000000;
const MIN_INVESTMENT = 25000;
const MAX_INVESTMENT = 500000;
const STEP_AMOUNT = 25000;

// Visual assets for the cards
const LOGO_GRADIENTS = [
  "from-blue-600 to-purple-600",
  "from-orange-500 to-yellow-500",
  "from-cyan-500 to-blue-500",
  "from-green-500 to-emerald-500",
  "from-pink-500 to-rose-500",
  "from-violet-500 to-purple-500",
  "from-red-500 to-orange-500",
  "from-teal-500 to-cyan-500",
];

// ============================================
// UTILITIES
// ============================================

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);
};

const generateTicker = (name: string): string => {
  if (!name) return "UNK";
  const words = name.split(' ').filter(w => w.length > 0);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0] + words[0][1]).toUpperCase();
  }
  return name.slice(0, 3).toUpperCase();
};

// ============================================
// MAIN COMPONENT
// ============================================

export default function InvestmentTerminal() {
  const router = useRouter();

  // -- Core State --
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [myTeam, setMyTeam] = useState<Team | null>(null);
  const [cluster, setCluster] = useState<Cluster | null>(null);

  // -- Market Data State --
  const [targetTeams, setTargetTeams] = useState<any[]>([]);
  const [drafts, setDrafts] = useState<Record<string, number>>({});

  // -- Transaction State --
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [commitResult, setCommitResult] = useState<{ success: boolean; message: string } | null>(null);
  const [savingDraft, setSavingDraft] = useState<string | null>(null);
  const [investmentStates, setInvestmentStates] = useState<Record<string, { is_draft: boolean; draft_locked: boolean; is_locked: boolean }>>({});
  const [marketValuations, setMarketValuations] = useState<Record<string, number>>({});
  const [allTeamsFinalized, setAllTeamsFinalized] = useState(false);
  const [currentPitchingTeamId, setCurrentPitchingTeamId] = useState<string | null>(null);

  // -- Computed Values --
  const currentDraftTotal = useMemo(() =>
    Object.values(drafts).reduce((a, b) => a + b, 0),
    [drafts]
  );

  const teamBalance = myTeam?.balance ?? INITIAL_BUDGET;
  const remainingBalance = teamBalance - currentDraftTotal;
  const isNegative = remainingBalance < 0;

  // -- Permissions --
  const isPitching = cluster?.current_stage === 'pitching';
  const isBidding = cluster?.current_stage === 'bidding' || (cluster as any)?.bidding_open === true;
  const isTeamLead = profile?.role === 'team_lead' || profile?.role === 'super_admin';
  const isFinalized = myTeam?.is_finalized ?? false;
  
  // Can draft during pitching, can edit/commit during bidding
  const canDraft = isPitching && isTeamLead && !isFinalized;
  const canEdit = isBidding && isTeamLead && !isFinalized;
  const canInvest = canDraft || canEdit;

  // ============================================
  // DATA FETCHING (via API to bypass RLS)
  // ============================================

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      // Use API route that bypasses RLS
      const response = await fetch('/api/invest');

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/auth/login');
          return;
        }
        const err = await response.json();
        console.error('API Error:', err);
        setLoading(false);
        return;
      }

      const data = await response.json();
      console.log('📦 API Response:', data);

      // Set state from API response
      setUser({ id: data.profile.id, email: data.profile.email });
      setProfile(data.profile);
      setMyTeam(data.myTeam);
      setCluster(data.cluster);
      setCurrentPitchingTeamId(data.cluster.current_pitching_team_id || null);
      setMarketValuations(data.marketValuations || {});
      setAllTeamsFinalized(data.allTeamsFinalized || false);

      // Format target teams with UI enhancements
      const formattedTeams = data.targetTeams.map((t: any, idx: number) => ({
        id: t.id,
        team_id: t.id,
        name: t.name,
        team_name: t.name,
        domain: t.domain,
        total_received: t.total_received,
        pitch_title: t.pitch_title || 'Pitch Deck',
        pitch_abstract: t.pitch_abstract,
        pitch_completed: t.pitch_completed,
        is_pitching: t.is_pitching,
        ticker: generateTicker(t.name),
        logo_gradient: LOGO_GRADIENTS[idx % LOGO_GRADIENTS.length]
      }));
      console.log('🎯 Target teams:', formattedTeams.length);
      setTargetTeams(formattedTeams);

      // Load existing investments as drafts and their states
      if (data.investments && data.investments.length > 0) {
        const loadedDrafts: Record<string, number> = {};
        const loadedStates: Record<string, { is_draft: boolean; draft_locked: boolean; is_locked: boolean }> = {};
        data.investments.forEach((inv: any) => {
          loadedDrafts[inv.target_team_id] = Number(inv.amount);
          loadedStates[inv.target_team_id] = {
            is_draft: inv.is_draft,
            draft_locked: inv.draft_locked,
            is_locked: inv.is_locked
          };
        });
        setDrafts(loadedDrafts);
        setInvestmentStates(loadedStates);
      }

    } catch (err) {
      console.error("Critical Load Error:", err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  // ============================================
  // ACTIONS
  // ============================================

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Server-Sent Events for real-time updates
  useEffect(() => {
    if (!myTeam) return;
    
    const eventSource = new EventSource('/api/invest/stream');
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.error) {
          console.error('SSE Error:', data.error);
          return;
        }
        
        // Update cluster state
        setCurrentPitchingTeamId(data.currentPitchingTeamId);
        
        // Update cluster bidding state
        setCluster(prev => prev ? {
          ...prev,
          current_stage: data.isPitching ? 'pitching' : (data.biddingOpen ? 'bidding' : prev.current_stage),
          bidding_open: data.biddingOpen,
          current_pitching_team_id: data.currentPitchingTeamId
        } : prev);
        
        // Update investment states from server
        if (data.investmentStates) {
          setInvestmentStates(prev => ({ ...prev, ...data.investmentStates }));
          // Also update drafts with amounts from server
          const serverDrafts: Record<string, number> = {};
          Object.entries(data.investmentStates).forEach(([teamId, state]: [string, any]) => {
            if (state.amount !== undefined) {
              serverDrafts[teamId] = state.amount;
            }
          });
          if (Object.keys(serverDrafts).length > 0) {
            setDrafts(prev => ({ ...prev, ...serverDrafts }));
          }
        }
        
        // Update market data when all finalized
        setAllTeamsFinalized(data.allFinalized);
        if (data.allFinalized && data.marketData) {
          const valuations: Record<string, number> = {};
          data.marketData.forEach((m: { teamId: string; totalReceived: number }) => {
            valuations[m.teamId] = m.totalReceived;
          });
          setMarketValuations(valuations);
        }
        
        // Update target teams pitching status
        if (data.currentPitchingTeamId) {
          setTargetTeams(prev => prev.map(t => ({
            ...t,
            is_pitching: t.id === data.currentPitchingTeamId
          })));
        } else {
          setTargetTeams(prev => prev.map(t => ({
            ...t,
            is_pitching: false
          })));
        }
        
        console.log('📡 SSE Update:', data.timestamp);
      } catch (err) {
        console.error('SSE parse error:', err);
      }
    };
    
    eventSource.onerror = (err) => {
      console.error('SSE connection error:', err);
      // EventSource will auto-reconnect
    };
    
    return () => {
      eventSource.close();
    };
  }, [myTeam]);

  const adjustAmount = (teamId: string, delta: number) => {
    // Check if this team's draft is locked
    const state = investmentStates[teamId];
    if (state?.draft_locked && !canEdit) return; // Can't modify locked drafts during pitching
    if (state?.is_locked) return; // Can't modify finalized investments
    
    // During pitching, can only draft for the currently pitching team
    if (isPitching && teamId !== currentPitchingTeamId) return;
    
    if (!canInvest) return;

    setDrafts(prev => {
      const current = prev[teamId] || 0;
      let next = current + delta;

      // Bounds Check
      if (next < 0) next = 0;
      if (next > MAX_INVESTMENT) next = MAX_INVESTMENT;

      // Budget Check (Cannot exceed total balance)
      const otherTotal = Object.entries(prev)
        .filter(([id]) => id !== teamId)
        .reduce((sum, [, amt]) => sum + amt, 0);

      if (otherTotal + next > teamBalance) {
        next = Math.max(0, teamBalance - otherTotal);
      }

      return { ...prev, [teamId]: next };
    });
  };

  // Save draft during pitching
  const saveDraft = async (teamId: string, amount: number) => {
    if (!canDraft || teamId !== currentPitchingTeamId) return;
    
    setSavingDraft(teamId);
    try {
      const response = await fetch('/api/invest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'SAVE_DRAFT', targetTeamId: teamId, amount })
      });
      
      const data = await response.json();
      if (!data.success) {
        setCommitResult({ success: false, message: data.error || "Failed to save draft" });
      }
    } catch (err) {
      console.error("Save draft error:", err);
    } finally {
      setSavingDraft(null);
    }
  };

  const handleCommit = async () => {
    if (!canEdit || isNegative || currentDraftTotal === 0) return;
    if (!confirm(`Commit portfolio of ${formatCurrency(currentDraftTotal)}? This is IRREVERSIBLE.`)) return;

    setIsSubmitting(true);
    setCommitResult(null);

    // Prepare Payload
    const investments = Object.entries(drafts)
      .filter(([, amount]) => amount > 0)
      .map(([target_team_id, amount]) => ({ target_team_id, amount }));

    try {
      // Call the API endpoint
      const response = await fetch('/api/invest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'COMMIT_PORTFOLIO', investments })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setCommitResult({
          success: false,
          message: data.error || "Commit failed. Please try again."
        });
      } else {
        setCommitResult({ success: true, message: data.message || "Portfolio Locked Successfully!" });
        // Refresh data to show updated state
        await fetchData();
      }
    } catch (err) {
      console.error("Commit error:", err);
      setCommitResult({
        success: false,
        message: "Network error. Please try again."
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStageDisplay = (stage: EventStage | string): { label: string; color: string } => {
    switch (stage) {
      case 'bidding': return { label: 'LIVE BIDDING', color: 'text-[#FFD700]' };
      case 'locked': return { label: 'MARKET CLOSED', color: 'text-red-500' };
      case 'pitching': return { label: 'PITCHING', color: 'text-blue-500' };
      default: return { label: stage?.toUpperCase() || 'LOADING', color: 'text-gray-500' };
    }
  };

  // ============================================
  // RENDER UI
  // ============================================

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0A0A0A] px-4 py-6 pb-28 relative overflow-hidden flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#FFD700] mx-auto mb-2" />
          <p className="text-[#FFD700] text-xs font-mono tracking-widest">CONNECTING TO MARKET...</p>
        </div>
      </main>
    );
  }

  const stageInfo = getStageDisplay(cluster?.current_stage || 'onboarding');

  return (
    <main className="min-h-screen bg-[#0A0A0A] px-4 py-6 pb-32 relative overflow-hidden">

      {/* --- BACKGROUND EFFECTS --- */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div
          className="absolute top-0 right-0 w-full h-2/3 bg-cover bg-center opacity-10 mix-blend-color-dodge"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1516912481808-3406841bd33c?q=80&w=2444&auto=format&fit=crop')" }}
        />
        <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A] to-transparent z-10" />
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-[#0A0A0A]/80 via-transparent to-[#0A0A0A] z-10" />
        <div className="absolute top-1/4 right-0 w-64 h-64 bg-red-900/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-md mx-auto">

        {/* 1. Header Area */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2 text-gray-400">
            <ShieldCheck className="w-4 h-4 text-[#FFD700]" />
            <span className="text-[10px] tracking-[0.2em] font-bold uppercase">Investment Terminal</span>
          </div>

          <div className="text-right">
            {isFinalized ? (
              <div className="flex items-center gap-1.5 text-green-500 bg-green-500/10 px-2 py-1 rounded border border-green-500/20">
                <Lock className="w-3 h-3" />
                <span className="text-[9px] font-bold tracking-wider uppercase">LOCKED</span>
              </div>
            ) : (
              <div className={`flex items-center gap-1.5 px-2 py-1 rounded border ${canInvest ? 'bg-[#FFD700]/10 border-[#FFD700]/30 text-[#FFD700]' : 'bg-[#333] border-gray-700 text-gray-500'}`}>
                {canInvest ? <div className="w-1.5 h-1.5 rounded-full bg-[#FFD700] animate-pulse" /> : <XCircle className="w-3 h-3" />}
                <span className="text-[9px] font-bold tracking-wider uppercase">{stageInfo.label}</span>
              </div>
            )}
          </div>
        </div>

        {/* 2. Available Liquidity Card */}
        <section className="bg-[#121212] border border-[#262626] rounded-xl p-5 mb-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#FFD700]/5 rounded-full blur-2xl group-hover:bg-[#FFD700]/10 transition-colors pointer-events-none" />

          <div className="flex justify-between items-start mb-2 relative z-10">
            <p className="text-[9px] tracking-widest text-gray-500 uppercase">Available Liquidity</p>
            <Wallet className="w-4 h-4 text-[#FFD700] opacity-50" />
          </div>

          <div className="relative z-10">
            <h1 className={`text-4xl font-bold font-serif tracking-tight ${isNegative ? 'text-red-500' : 'text-white'}`}>
              {formatCurrency(remainingBalance)}
            </h1>
            {isNegative && (
              <p className="text-red-500 text-[10px] mt-1 font-bold flex items-center gap-1 animate-pulse">
                <AlertTriangle className="w-3 h-3" /> OVER BUDGET
              </p>
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-[#262626] flex justify-between items-end relative z-10">
            <div>
              <p className="text-[9px] text-gray-600 uppercase tracking-widest mb-1">Status</p>
              <p className="text-[10px] text-gray-400 font-mono">
                {isFinalized ? 'Portfolio Committed' : canInvest ? 'Trading Active' : 'Read Only'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[9px] text-gray-600 uppercase tracking-widest mb-1">Allocated</p>
              <p className={`text-sm font-mono font-bold ${currentDraftTotal > 0 ? 'text-[#FFD700]' : 'text-gray-500'}`}>
                {formatCurrency(currentDraftTotal)}
              </p>
            </div>
          </div>
        </section>

        {/* 3. Feedback Banner */}
        {commitResult && (
          <div className={`mb-6 p-4 rounded-xl border flex items-center gap-3 animate-in fade-in slide-in-from-top-2 ${commitResult.success ? 'border-green-500/30 bg-green-500/10' : 'border-red-500/30 bg-red-500/10'}`}>
            {commitResult.success ? (
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
            )}
            <span className={`text-xs font-medium ${commitResult.success ? 'text-green-400' : 'text-red-400'}`}>
              {commitResult.message}
            </span>
          </div>
        )}

        {/* 4. Market Feed (Vertical Stack) */}
        <section className="space-y-4 pb-24">
          <div className="flex justify-between items-center px-1 mb-2">
            <h3 className="font-serif text-xl font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#FFD700]" />
              Market Feed
            </h3>
            <Search className="w-4 h-4 text-gray-600" />
          </div>

          {targetTeams.length === 0 ? (
            <div className="bg-[#121212] border border-[#262626] rounded-xl p-8 text-center">
              <p className="text-gray-500 text-sm">No active teams found.</p>
              <p className="text-gray-700 text-xs mt-1">Waiting for cluster initialization.</p>
            </div>
          ) : (
            targetTeams.map((team) => {
              const id = team.id;
              const investedAmount = drafts[id] || 0;
              const active = investedAmount > 0;
              const gradient = team.logo_gradient || 'from-gray-800 to-gray-700';
              const state = investmentStates[id];
              const isCurrentlyPitching = team.is_pitching;
              const isDraftLocked = state?.draft_locked && !canEdit;
              const isInvestmentLocked = state?.is_locked;
              const marketValue = allTeamsFinalized ? marketValuations[id] : null;
              
              // Determine if controls should be enabled
              const canModifyThis = canInvest && !isInvestmentLocked && (
                (isPitching && isCurrentlyPitching) || // During pitching, only for current pitch
                (canEdit && !isInvestmentLocked) // During bidding, can edit all
              );

              return (
                <div
                  key={id}
                  className={`bg-[#121212] border rounded-xl overflow-hidden transition-all duration-300 ${
                    isCurrentlyPitching 
                      ? 'border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.2)] ring-2 ring-blue-500/30' 
                      : active 
                        ? 'border-[#FFD700] shadow-[0_0_20px_rgba(255,215,0,0.05)]' 
                        : 'border-[#262626]'
                  }`}
                >
                  {/* Pitching Indicator */}
                  {isCurrentlyPitching && (
                    <div className="bg-blue-500/20 border-b border-blue-500/30 px-4 py-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                        <span className="text-blue-400 text-[10px] font-bold tracking-widest uppercase">NOW PITCHING</span>
                      </div>
                      <span className="text-blue-300 text-[9px] font-mono">PLACE YOUR BID</span>
                    </div>
                  )}
                  
                  {/* Draft Locked Indicator */}
                  {isDraftLocked && !isCurrentlyPitching && (
                    <div className="bg-orange-500/10 border-b border-orange-500/20 px-4 py-1.5 flex items-center gap-2">
                      <Lock className="w-3 h-3 text-orange-400" />
                      <span className="text-orange-400 text-[9px] font-bold tracking-wider uppercase">DRAFT LOCKED</span>
                    </div>
                  )}

                  <div className="p-4">
                    {/* Card Header */}
                    <div className="flex items-start gap-3 mb-4">
                      <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center flex-shrink-0 shadow-inner ring-1 ring-white/10`}>
                        <span className="text-white font-bold text-xs tracking-wider">{team.ticker}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                          <h4 className="text-white font-bold text-base truncate pr-2">{team.team_name}</h4>
                          <div className="text-right">
                            {allTeamsFinalized && marketValue !== null ? (
                              <>
                                <p className="text-[9px] text-green-500 uppercase tracking-widest">MARKET CAP</p>
                                <p className="text-green-400 font-mono text-sm font-bold">
                                  {formatCurrency(marketValue)}
                                </p>
                              </>
                            ) : (
                              <>
                                <p className="text-[9px] text-gray-500 uppercase tracking-widest">ASK</p>
                                <p className="text-gray-300 font-mono text-xs">
                                  {formatCurrency(team.total_received || 0)}
                                </p>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[9px] text-gray-400 bg-[#1A1A1A] px-1.5 py-0.5 rounded border border-[#333] uppercase tracking-wide">
                            {team.domain || 'Tech'}
                          </span>
                          {team.pitch_completed && (
                            <span className="text-[9px] text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded border border-green-500/20 uppercase tracking-wide">
                              ✓ Pitched
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Pitch Snippet */}
                    {team.pitch_abstract && (
                      <div className="mb-4 pl-[60px]">
                        <p className="text-[10px] text-[#FFD700] uppercase tracking-widest font-bold mb-0.5">
                          {team.pitch_title}
                        </p>
                        <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
                          {team.pitch_abstract}
                        </p>
                      </div>
                    )}

                    {/* Controls */}
                    <div className={`bg-[#0A0A0A] rounded-lg border flex items-center h-14 relative overflow-hidden transition-colors ${
                      isCurrentlyPitching 
                        ? 'border-blue-500/50' 
                        : active 
                          ? 'border-[#FFD700]/30' 
                          : 'border-[#222]'
                    }`}>

                      {/* Decrement */}
                      <button
                        onClick={() => adjustAmount(id, -STEP_AMOUNT)}
                        disabled={!canModifyThis}
                        className="w-14 h-full flex items-center justify-center text-gray-500 hover:text-white hover:bg-[#1A1A1A] transition-colors disabled:opacity-30 disabled:cursor-not-allowed border-r border-[#222] z-10"
                      >
                        <span className="text-2xl font-light">–</span>
                      </button>

                      {/* Display */}
                      <div className="flex-1 flex flex-col items-center justify-center z-10 pointer-events-none">
                        <span className={`font-mono text-lg font-bold tracking-tight ${active ? 'text-white' : 'text-gray-600'}`}>
                          {formatCurrency(investedAmount)}
                        </span>
                        {savingDraft === id && (
                          <span className="text-[9px] text-blue-400 animate-pulse">Saving...</span>
                        )}
                      </div>

                      {/* Increment */}
                      <button
                        onClick={() => adjustAmount(id, STEP_AMOUNT)}
                        disabled={!canModifyThis}
                        className={`w-14 h-full flex items-center justify-center hover:bg-[#1A1A1A] transition-colors disabled:opacity-30 disabled:cursor-not-allowed border-l border-[#222] z-10 ${
                          isCurrentlyPitching ? 'text-blue-400' : 'text-[#FFD700]'
                        }`}
                      >
                        <span className="text-2xl font-light">+</span>
                      </button>

                      {/* Progress Bar Background */}
                      {active && (
                        <div
                          className={`absolute bottom-0 left-0 h-1 ${isCurrentlyPitching ? 'bg-blue-500' : 'bg-[#FFD700]'}`}
                          style={{ width: `${Math.min((investedAmount / 500000) * 100, 100)}%` }}
                        />
                      )}
                    </div>
                    
                    {/* Save Draft Button (during pitching) */}
                    {isCurrentlyPitching && canDraft && investedAmount > 0 && (
                      <button
                        onClick={() => saveDraft(id, investedAmount)}
                        disabled={savingDraft === id}
                        className="mt-3 w-full h-10 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/50 text-blue-400 font-bold uppercase tracking-widest text-[10px] rounded-lg flex items-center justify-center gap-2 transition-colors"
                      >
                        {savingDraft === id ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Saving Draft...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-3 h-3" />
                            Save Draft ({formatCurrency(investedAmount)})
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </section>

        {/* 5. Market Leaderboard (shown after all teams finalize) */}
        {allTeamsFinalized && Object.keys(marketValuations).length > 0 && (
          <section className="mb-6 bg-gradient-to-br from-green-900/20 to-emerald-900/10 border border-green-500/30 rounded-xl p-5">
            <h3 className="font-serif text-lg font-bold text-green-400 mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Final Market Valuations
            </h3>
            <div className="space-y-2">
              {Object.entries(marketValuations)
                .sort(([, a], [, b]) => b - a)
                .map(([teamId, value], index) => {
                  const team = targetTeams.find(t => t.id === teamId);
                  const isMyTeam = teamId === myTeam?.id;
                  const teamName = isMyTeam ? myTeam?.name : team?.team_name;
                  return (
                    <div key={teamId} className={`flex justify-between items-center py-2 border-b border-green-500/10 last:border-0 ${isMyTeam ? 'bg-[#FFD700]/10 -mx-2 px-2 rounded' : ''}`}>
                      <div className="flex items-center gap-3">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          index === 0 ? 'bg-yellow-500 text-black' : 
                          index === 1 ? 'bg-gray-400 text-black' : 
                          index === 2 ? 'bg-orange-600 text-white' : 'bg-gray-700 text-gray-300'
                        }`}>
                          {index + 1}
                        </span>
                        <span className={`font-medium ${isMyTeam ? 'text-[#FFD700]' : 'text-white'}`}>
                          {teamName || 'Unknown'}
                          {isMyTeam && <span className="ml-2 text-[10px] text-[#FFD700]/70">(YOU)</span>}
                        </span>
                      </div>
                      <span className={`font-mono font-bold ${isMyTeam ? 'text-[#FFD700]' : 'text-green-400'}`}>{formatCurrency(value)}</span>
                    </div>
                  );
                })}
            </div>
          </section>
        )}

        {/* 6. Action Bar (Fixed Floating above Nav) */}
        {!isFinalized && canEdit && currentDraftTotal > 0 && (
          <div className="fixed bottom-[84px] left-0 right-0 px-4 z-40 max-w-md mx-auto animate-in slide-in-from-bottom-4">
            <button
              onClick={handleCommit}
              disabled={isSubmitting || isNegative}
              className="w-full h-14 bg-[#FFD700] hover:bg-[#F0C000] active:scale-[0.98] transition-all text-black font-bold uppercase tracking-widest text-xs rounded-xl shadow-[0_0_30px_rgba(255,215,0,0.3)] flex items-center justify-center gap-3 border border-yellow-400"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  Confirm Allocation ({formatCurrency(currentDraftTotal)})
                </>
              )}
            </button>
          </div>
        )}

      </div>

      {/* --- BOTTOM NAVIGATION --- */}
      <StudentBottomNav />
    </main>
  );
}