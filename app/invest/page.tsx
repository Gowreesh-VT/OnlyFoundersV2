"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Loader2 } from "lucide-react";
import StudentBottomNav from "../components/StudentBottomNav";

type Investment = {
  id: string;
  amount: number;
  reasoning?: string;
  confidence_level?: number;
  is_locked?: boolean;
  target_team?: { id?: string; name?: string } | null;
  investor_team?: { id?: string; name?: string } | null;
};

type TeamData = {
  id: string;
  name: string;
  domain?: string;
  investments_made?: Investment[];
  investments_received?: Investment[];
};

type CurrentUser = {
  id?: string;
  role?: string;
  teamId?: any;
};

export default function InvestPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [team, setTeam] = useState<TeamData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const authRes = await fetch("/api/auth/me");
        if (!authRes.ok) {
          router.push("/auth/login");
          return;
        }

        const authData = await authRes.json();
        const currentUser: CurrentUser = authData.user;
        setUser(currentUser);

        const teamId =
          currentUser?.teamId?._id || currentUser?.teamId || authData.user?.team?._id;

        if (!teamId) {
          setError("No team assigned. Please contact admin.");
          return;
        }

        const teamRes = await fetch(`/api/teams?teamId=${teamId}`);
        if (!teamRes.ok) {
          const data = await teamRes.json();
          setError(data.error || "Failed to load investments");
          return;
        }

        const teamData = await teamRes.json();
        setTeam(teamData.team);
      } catch (err) {
        setError("Failed to load investments");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-white pb-24">
        <div className="bg-[#0A0A0A] border-b border-[#262626] px-4 py-4 sticky top-0 z-40">
          <div className="max-w-lg mx-auto flex items-center justify-between">
            <button onClick={() => router.back()} className="text-gray-400 hover:text-white transition-colors">
              <ChevronLeft size={24} />
            </button>
            <h1 className="tech-text text-white tracking-widest text-sm">ONLYFOUNDERS</h1>
            <div className="w-6" />
          </div>
        </div>
        <div className="max-w-lg mx-auto px-6 py-8">
          <div className="border border-red-500/30 bg-red-500/10 rounded-xl p-4 text-red-400 text-sm">
            {error}
          </div>
        </div>
        <StudentBottomNav />
      </div>
    );
  }

  const isLeader = user?.role === "team_lead" || user?.role === "super_admin";

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white pb-24">
      <div className="bg-[#0A0A0A] border-b border-[#262626] px-4 py-4 sticky top-0 z-40">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-white transition-colors">
            <ChevronLeft size={24} />
          </button>
          <h1 className="tech-text text-white tracking-widest text-sm">INVESTMENTS</h1>
          <div className="w-6" />
        </div>
      </div>

      <div className="max-w-lg mx-auto px-6 py-8 space-y-6">
        {!isLeader && (
          <div className="border border-red-500/30 bg-red-500/10 rounded-xl p-4 text-red-400 text-sm">
            Access denied. Only team leads can create investments.
          </div>
        )}

        <div className="border border-[#262626] rounded-xl p-4 bg-[#121212]">
          <p className="text-xs text-gray-500 mb-1">TEAM</p>
          <p className="text-white text-lg font-semibold">{team?.name || "Your Team"}</p>
          <p className="text-xs text-gray-500">{team?.domain || ""}</p>
        </div>

        <div className="border border-[#262626] rounded-xl p-4 bg-[#121212]">
          <p className="text-xs text-gray-500 mb-3">INVESTMENTS MADE</p>
          {team?.investments_made && team.investments_made.length > 0 ? (
            <div className="space-y-3">
              {team.investments_made.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between border border-[#2a2a2a] rounded-lg p-3">
                  <div>
                    <p className="text-white text-sm">{inv.target_team?.name || "Unknown"}</p>
                    <p className="text-xs text-gray-500">Confidence: {inv.confidence_level ?? "-"}</p>
                  </div>
                  <p className="text-primary font-mono">₹{inv.amount}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No investments yet.</p>
          )}
        </div>

        <div className="border border-[#262626] rounded-xl p-4 bg-[#121212]">
          <p className="text-xs text-gray-500 mb-3">INVESTMENTS RECEIVED</p>
          {team?.investments_received && team.investments_received.length > 0 ? (
            <div className="space-y-3">
              {team.investments_received.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between border border-[#2a2a2a] rounded-lg p-3">
                  <div>
                    <p className="text-white text-sm">{inv.investor_team?.name || "Unknown"}</p>
                  </div>
                  <p className="text-primary font-mono">₹{inv.amount}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No investments received yet.</p>
          )}
        </div>
      </div>

      <StudentBottomNav />
    </div>
  );
}
