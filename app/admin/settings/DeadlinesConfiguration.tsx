"use client";

import { useState } from "react";
import { Clock, Settings, ChevronLeft } from "lucide-react";

export function DeadlinesConfiguration() {
  const [enforceHardStop, setEnforceHardStop] = useState(true);
  const [defaultSubmissionTime, setDefaultSubmissionTime] = useState("11:59");
  const [allowLateSubmissions, setAllowLateSubmissions] = useState(false);
  const [graceWindow, setGraceWindow] = useState(12);
  const [penaltyDeduction, setPenaltyDeduction] = useState(10);
  const [remind24h, setRemind24h] = useState(true);
  const [remind1h, setRemind1h] = useState(false);
  const [pushNotifications, setPushNotifications] = useState(true);

  const handleSave = () => {
    console.log({
      enforceHardStop,
      defaultSubmissionTime,
      allowLateSubmissions,
      graceWindow,
      penaltyDeduction,
      remind24h,
      remind1h,
      pushNotifications,
    });
    alert("Settings saved successfully!");
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white relative overflow-hidden">
      {/* Background Effects - Landing Page Style */}
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
      <header className="relative z-10 px-6 py-5 flex items-center justify-between border-b border-[#262626]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
            <Settings className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h1 className="font-serif text-lg font-bold text-white">
              Settings
            </h1>
            <p className="text-[9px] text-gray-500 uppercase tracking-[0.2em]">
              Deadline Configuration
            </p>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="relative z-10 px-6 py-6 max-w-2xl mx-auto space-y-6">
        {/* Global Parameters Section */}
        <section>
          <h2 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-primary">
            Global Parameters
          </h2>
          <div className="bg-[#121212] border border-[#262626] rounded-xl overflow-hidden">
            {/* Enforce Hard Stop */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#262626]">
              <div>
                <h3 className="text-sm font-semibold text-white">Enforce Hard Stop</h3>
                <p className="mt-1 text-xs text-gray-500">
                  Students cannot submit after deadline
                </p>
              </div>
              <button
                onClick={() => setEnforceHardStop(!enforceHardStop)}
                className={`relative w-12 h-6 rounded-full transition-colors ${enforceHardStop ? "bg-primary" : "bg-[#262626]"
                  }`}
              >
                <div
                  className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-md transition-transform ${enforceHardStop ? "left-7" : "left-1"
                    }`}
                />
              </button>
            </div>

            {/* Default Submission Time */}
            <div className="flex items-center justify-between px-5 py-4">
              <h3 className="text-sm font-semibold text-white">Default Submission Time</h3>
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold text-primary">{defaultSubmissionTime}</span>
                <div className="flex items-center gap-1 bg-[#0A0A0A] border border-[#262626] rounded-lg px-3 py-2">
                  <Clock className="w-4 h-4 text-gray-500" />
                  <input
                    type="time"
                    value={defaultSubmissionTime}
                    onChange={(e) => setDefaultSubmissionTime(e.target.value)}
                    className="bg-transparent text-sm text-white focus:outline-none w-20"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Grace Periods Section */}
        <section>
          <h2 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-primary">
            Grace Periods
          </h2>
          <div className="bg-[#121212] border border-[#262626] rounded-xl overflow-hidden">
            {/* Allow Late Submissions */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#262626]">
              <h3 className="text-sm font-semibold text-white">Allow Late Submissions</h3>
              <button
                onClick={() => setAllowLateSubmissions(!allowLateSubmissions)}
                className={`relative w-12 h-6 rounded-full transition-colors ${allowLateSubmissions ? "bg-primary" : "bg-[#262626]"
                  }`}
              >
                <div
                  className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-md transition-transform ${allowLateSubmissions ? "left-7" : "left-1"
                    }`}
                />
              </button>
            </div>

            {/* Grace Window */}
            <div className="px-5 py-4 border-b border-[#262626]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white">Grace Window</h3>
                <span className="text-lg font-bold text-primary">{graceWindow}h</span>
              </div>
              <input
                type="range"
                min={0}
                max={48}
                step={1}
                value={graceWindow}
                onChange={(e) => setGraceWindow(Number(e.target.value))}
                className="w-full h-2 bg-[#262626] rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <div className="flex justify-between mt-2 text-[10px] text-gray-600">
                <span>0h</span>
                <span>24h</span>
                <span>48h</span>
              </div>
            </div>

            {/* Late Penalty Deduction */}
            <div className="flex items-center justify-between px-5 py-4">
              <h3 className="text-sm font-semibold text-white">Late Penalty Deduction</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPenaltyDeduction(Math.max(0, penaltyDeduction - 5))}
                  className="w-8 h-8 rounded-lg bg-[#0A0A0A] border border-[#262626] text-gray-400 hover:border-primary hover:text-primary transition-colors"
                >
                  -
                </button>
                <span className="w-16 text-center text-lg font-bold text-primary">{penaltyDeduction}%</span>
                <button
                  onClick={() => setPenaltyDeduction(Math.min(100, penaltyDeduction + 5))}
                  className="w-8 h-8 rounded-lg bg-[#0A0A0A] border border-[#262626] text-gray-400 hover:border-primary hover:text-primary transition-colors"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Notifications Section */}
        <section>
          <h2 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-primary">
            Notifications
          </h2>
          <div className="bg-[#121212] border border-[#262626] rounded-xl overflow-hidden">
            {/* Remind 24h before */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#262626]">
              <h3 className="text-sm font-semibold text-white">Remind 24h before</h3>
              <button
                onClick={() => setRemind24h(!remind24h)}
                className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${remind24h ? "bg-primary border-primary" : "border-[#262626]"
                  }`}
              >
                {remind24h && <span className="text-black text-sm">✓</span>}
              </button>
            </div>

            {/* Remind 1h before */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#262626]">
              <h3 className="text-sm font-semibold text-white">Remind 1h before</h3>
              <button
                onClick={() => setRemind1h(!remind1h)}
                className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${remind1h ? "bg-primary border-primary" : "border-[#262626]"
                  }`}
              >
                {remind1h && <span className="text-black text-sm">✓</span>}
              </button>
            </div>

            {/* Push to Students */}
            <div className="flex items-center justify-between px-5 py-4">
              <div>
                <h3 className="text-sm font-semibold text-white">Push to Students</h3>
                <p className="mt-1 text-xs text-gray-500">
                  Send mobile push notifications
                </p>
              </div>
              <button
                onClick={() => setPushNotifications(!pushNotifications)}
                className={`relative w-12 h-6 rounded-full transition-colors ${pushNotifications ? "bg-primary" : "bg-[#262626]"
                  }`}
              >
                <div
                  className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-md transition-transform ${pushNotifications ? "left-7" : "left-1"
                    }`}
                />
              </button>
            </div>
          </div>
        </section>

        {/* Save Button */}
        <button
          onClick={handleSave}
          className="w-full bg-primary hover:bg-primary-hover text-black font-semibold py-4 rounded-xl transition-all duration-300 shadow-[0_0_20px_rgba(255,215,0,0.15)] hover:shadow-[0_0_30px_rgba(255,215,0,0.25)] uppercase tracking-widest text-sm"
        >
          Save Changes
        </button>
      </main>
    </div>
  );
}
