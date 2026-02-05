"use client";

import { useState, useEffect, useCallback } from "react";
import { Calendar, Clock, Settings, Loader2, LogOut, Edit3, X, Check, Trophy, Bell, Send, AlertTriangle, Info, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import AdminBottomNav from "../../components/AdminBottomNav";
import { useCache } from "@/lib/cache/CacheProvider";

type HackathonSettings = {
  id?: string;
  college_id?: string;
  hackathon_name: string;
  start_date: string | null;
  end_date: string | null;
  submission_deadline: string | null;
  late_submissions_allowed: boolean;
  penalty_deduction: number;
};

type NotificationType = 'info' | 'warning' | 'urgent';

const defaultSettings: HackathonSettings = {
  hackathon_name: 'OnlyFounders Hackathon',
  start_date: null,
  end_date: null,
  submission_deadline: null,
  late_submissions_allowed: false,
  penalty_deduction: 10,
};

// Helper to extract date and time from ISO string
function getDateParts(isoString: string | null): { date: string; time: string } {
  if (!isoString) return { date: '', time: '' };
  try {
    const d = new Date(isoString);
    const date = d.toISOString().split('T')[0];
    const time = d.toTimeString().slice(0, 5);
    return { date, time };
  } catch {
    return { date: '', time: '' };
  }
}

// Helper to combine date and time into ISO string
function combineDateAndTime(date: string, time: string): string | null {
  if (!date) return null;
  const timeToUse = time || '00:00';
  try {
    return new Date(`${date}T${timeToUse}:00`).toISOString();
  } catch {
    return null;
  }
}

// Date Time Picker Component
function DateTimePicker({
  label,
  icon: Icon,
  value,
  onChange,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  const { date, time } = getDateParts(value);

  const handleDateChange = (newDate: string) => {
    onChange(combineDateAndTime(newDate, time));
  };

  const handleTimeChange = (newTime: string) => {
    onChange(combineDateAndTime(date, newTime));
  };

  return (
    <div className="px-5 py-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold text-white">{label}</h3>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-2">Date</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="date"
              value={date}
              onChange={(e) => handleDateChange(e.target.value)}
              className="w-full bg-[#0A0A0A] border border-[#262626] text-white py-3 pl-10 pr-3 focus:outline-none focus:border-primary transition-colors text-sm rounded-lg appearance-none"
            />
          </div>
        </div>
        <div>
          <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-2">Time</label>
          <div className="relative">
            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="time"
              value={time}
              onChange={(e) => handleTimeChange(e.target.value)}
              className="w-full bg-[#0A0A0A] border border-[#262626] text-white py-3 pl-10 pr-3 focus:outline-none focus:border-primary transition-colors text-sm rounded-lg appearance-none"
            />
          </div>
        </div>
      </div>
      {value && (
        <p className="mt-2 text-xs text-primary">
          {new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
        </p>
      )}
    </div>
  );
}

export default function AdminSettingsPage() {
  const router = useRouter();
  const cache = useCache();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [userName, setUserName] = useState("Admin");
  const [collegeName, setCollegeName] = useState("");
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showEditName, setShowEditName] = useState(false);
  const [newName, setNewName] = useState("");
  const [isSavingName, setIsSavingName] = useState(false);

  // Settings state
  const [settings, setSettings] = useState<HackathonSettings>(defaultSettings);

  // Notification state
  const [notificationTitle, setNotificationTitle] = useState("");
  const [notificationDescription, setNotificationDescription] = useState("");
  const [notificationType, setNotificationType] = useState<NotificationType>("info");
  const [sendingNotification, setSendingNotification] = useState(false);
  const [notificationSent, setNotificationSent] = useState("");

  // Internal Details state
  const [internalDetails, setInternalDetails] = useState<string>("{}");
  const [savingInternalDetails, setSavingInternalDetails] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const cachedUser = cache.get<{ name: string; college: string }>('admin-user');
      if (cachedUser) {
        setUserName(cachedUser.name);
        setCollegeName(cachedUser.college);
      } else {
        const userRes = await fetch('/api/auth/me');
        if (!userRes.ok) { router.push('/auth/login'); return; }
        const userData = await userRes.json();
        if (userData.user?.role !== 'admin' && userData.user?.role !== 'super_admin') {
          router.push('/dashboard'); return;
        }
        const name = userData.user?.fullName || 'Admin';
        const college = userData.user?.college?.name || 'Your College';
        setUserName(name);
        setCollegeName(college);
        cache.set('admin-user', { name, college }, 10 * 60 * 1000);
      }

      const settingsRes = await fetch('/api/admin/settings');
      if (settingsRes.ok) {
        const data = await settingsRes.json();
        setSettings({ ...defaultSettings, ...data.settings });
      }

      // Fetch internal details
      const collegeRes = await fetch('/api/admin/college');
      if (collegeRes.ok) {
        const data = await collegeRes.json();
        setInternalDetails(data.college?.internal_details?.notes || "");
      }
    } catch (err) {
      console.error('Failed to fetch:', err);
      setError('Failed to load settings');
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

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSaved(false);

    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to save settings');
      }
    } catch (err) {
      console.error('Save failed:', err);
      setError('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveInternalDetails = async () => {
    setSavingInternalDetails(true);
    try {
      const res = await fetch('/api/admin/college', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ internalDetails: { notes: internalDetails } }),
      });

      if (res.ok) {
        alert('Notes saved successfully');
      } else {
        alert('Failed to save notes');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to save notes');
    } finally {
      setSavingInternalDetails(false);
    }
  };

  const handleSendNotification = async () => {
    if (!notificationTitle.trim() || !notificationDescription.trim()) {
      setError('Title and description are required');
      return;
    }

    setSendingNotification(true);
    setError("");
    setNotificationSent("");

    try {
      const response = await fetch('/api/admin/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: notificationTitle.trim(),
          description: notificationDescription.trim(),
          type: notificationType,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setNotificationSent(data.message || 'Notification sent successfully!');
        setNotificationTitle("");
        setNotificationDescription("");
        setTimeout(() => setNotificationSent(""), 5000);
      } else {
        setError(data.error || 'Failed to send notification');
      }
    } catch (err) {
      console.error('Send notification failed:', err);
      setError('Failed to send notification');
    } finally {
      setSendingNotification(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen pb-28 bg-[#0A0A0A] text-white relative overflow-hidden">
        <div className="absolute inset-0 z-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-full h-2/3 opacity-10"
            style={{ backgroundImage: "url('https://images.unsplash.com/photo-1516912481808-3406841bd33c?q=80&w=2444&auto=format&fit=crop')" }} />
        </div>
        {/* Header Skeleton */}
        <header className="relative z-20 px-6 py-3 flex items-center justify-between border-b border-[#262626] bg-[#0A0A0A]">
          <div className="h-10 w-24 bg-[#262626] rounded animate-pulse" />
          <div className="w-10 h-10 rounded-full bg-[#262626] animate-pulse" />
        </header>
        <main className="relative z-10 px-6 py-6 max-w-2xl mx-auto space-y-6">
          {/* Page Title Skeleton */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-[#262626] animate-pulse" />
            <div>
              <div className="h-6 bg-[#262626] rounded w-40 mb-2 animate-pulse" />
              <div className="h-4 bg-[#262626] rounded w-32 animate-pulse" />
            </div>
          </div>
          {/* Sections Skeleton */}
          {[1, 2].map((i) => (
            <div key={i} className="space-y-3">
              <div className="h-3 bg-[#262626] rounded w-32 animate-pulse" />
              <div className="bg-[#121212] border border-[#262626] rounded-xl overflow-hidden">
                {[1, 2, 3].map((j) => (
                  <div key={j} className="px-5 py-4 border-b border-[#262626] last:border-b-0 animate-pulse">
                    <div className="h-4 bg-[#262626] rounded w-24 mb-3" />
                    <div className="h-10 bg-[#262626] rounded" />
                  </div>
                ))}
              </div>
            </div>
          ))}
          {/* Button Skeleton */}
          <div className="h-12 bg-[#262626] rounded-xl animate-pulse" />
        </main>
        <AdminBottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-28 bg-[#0A0A0A] text-white relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-full h-2/3 bg-cover bg-center opacity-10 mix-blend-color-dodge"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1516912481808-3406841bd33c?q=80&w=2444&auto=format&fit=crop')" }} />
        <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A] to-transparent z-10" />
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-[#0A0A0A]/80 via-transparent to-[#0A0A0A] z-10" />
        <div className="absolute top-1/4 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative z-20 px-6 py-3 flex items-center justify-between border-b border-[#262626] bg-[#0A0A0A]">
        <div className="flex items-center">
          <img src="/only-founders-logo.png" alt="Logo" className="h-10 w-auto object-contain" />
        </div>
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
                    onClick={() => { setShowProfileMenu(false); setNewName(userName); setShowEditName(true); }}
                    className="w-full px-4 py-3 flex items-center gap-3 text-gray-300 hover:bg-[#1A1A1A] transition-colors text-left"
                  >
                    <Edit3 className="w-4 h-4" /><span className="text-sm">Edit Name</span>
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

      {/* Content */}
      <main className="relative z-10 px-6 py-6 max-w-2xl mx-auto space-y-6">
        {/* Page Title */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
            <Settings className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="font-serif text-2xl font-bold text-white">Hackathon Settings</h1>
            <p className="text-xs text-gray-500">Configure your hackathon</p>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}
        {saved && (
          <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-sm flex items-center gap-2">
            <Check className="w-4 h-4" />Settings saved successfully!
          </div>
        )}
        {notificationSent && (
          <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-sm flex items-center gap-2">
            <Check className="w-4 h-4" />{notificationSent}
          </div>
        )}

        {/* Hackathon Info Section */}
        <section>
          <h2 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-primary">Hackathon Information</h2>
          <div className="bg-[#121212] border border-[#262626] rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#262626]">
              <div className="flex items-center gap-2 mb-3">
                <Trophy className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-white">Hackathon Name</h3>
              </div>
              <input
                type="text"
                value={settings.hackathon_name}
                onChange={(e) => setSettings({ ...settings, hackathon_name: e.target.value })}
                placeholder="Enter hackathon name"
                className="w-full bg-[#0A0A0A] border border-[#262626] text-white py-3 px-4 focus:outline-none focus:border-primary transition-colors text-sm rounded-lg"
              />
            </div>
            <div className="border-b border-[#262626]">
              <DateTimePicker label="Start Date & Time" icon={Calendar} value={settings.start_date}
                onChange={(value) => setSettings({ ...settings, start_date: value })} />
            </div>
            <DateTimePicker label="End Date & Time" icon={Calendar} value={settings.end_date}
              onChange={(value) => setSettings({ ...settings, end_date: value })} />
          </div>
        </section>

        {/* Submission Settings */}
        <section>
          <h2 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-primary">Submission Settings</h2>
          <div className="bg-[#121212] border border-[#262626] rounded-xl overflow-hidden">
            <div className="border-b border-[#262626]">
              <DateTimePicker label="Submission Deadline" icon={Clock} value={settings.submission_deadline}
                onChange={(value) => setSettings({ ...settings, submission_deadline: value })} />
            </div>
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#262626]">
              <div>
                <h3 className="text-sm font-semibold text-white">Allow Late Submissions</h3>
                <p className="mt-1 text-xs text-gray-500">Students can submit after the deadline</p>
              </div>
              <button
                onClick={() => setSettings({ ...settings, late_submissions_allowed: !settings.late_submissions_allowed })}
                className={`relative w-12 h-6 rounded-full transition-colors ${settings.late_submissions_allowed ? "bg-primary" : "bg-[#262626]"}`}
              >
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-md transition-transform ${settings.late_submissions_allowed ? "left-7" : "left-1"}`} />
              </button>
            </div>
            <div className="flex items-center justify-between px-5 py-4">
              <div>
                <h3 className="text-sm font-semibold text-white">Late Penalty Deduction</h3>
                <p className="mt-1 text-xs text-gray-500">Penalty for late submissions</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSettings({ ...settings, penalty_deduction: Math.max(0, settings.penalty_deduction - 5) })}
                  className="w-8 h-8 rounded-lg bg-[#0A0A0A] border border-[#262626] text-gray-400 hover:border-primary hover:text-primary transition-colors"
                >-</button>
                <span className="w-16 text-center text-lg font-bold text-primary">{settings.penalty_deduction}%</span>
                <button
                  onClick={() => setSettings({ ...settings, penalty_deduction: Math.min(100, settings.penalty_deduction + 5) })}
                  className="w-8 h-8 rounded-lg bg-[#0A0A0A] border border-[#262626] text-gray-400 hover:border-primary hover:text-primary transition-colors"
                >+</button>
              </div>
            </div>
          </div>
        </section>

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-primary hover:bg-primary-hover text-black font-semibold py-4 rounded-xl transition-all duration-300 shadow-[0_0_20px_rgba(255,215,0,0.15)] hover:shadow-[0_0_30px_rgba(255,215,0,0.25)] uppercase tracking-widest text-sm flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Saving...</> : 'Save Changes'}
        </button>

        {/* Internal Details Section */}
        <section>
          <h2 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-primary">Admin Notes</h2>
          <div className="bg-[#121212] border border-[#262626] rounded-xl overflow-hidden p-5">
            <textarea
              value={internalDetails}
              onChange={(e) => setInternalDetails(e.target.value)}
              rows={6}
              placeholder='Add internal notes...'
              className="w-full bg-[#0A0A0A] border border-[#262626] rounded-lg p-4 text-sm text-gray-300 focus:outline-none focus:border-primary resize-y mb-4"
            />
            <div className="flex justify-end">
              <button
                onClick={handleSaveInternalDetails}
                disabled={savingInternalDetails}
                className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-black font-semibold px-4 py-2 rounded-lg transition-colors text-xs"
              >
                {savingInternalDetails ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                Save Notes
              </button>
            </div>
          </div>
        </section>

        {/* Notifications Section */}
        <section>
          <h2 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-primary">Send Notification</h2>
          <div className="bg-[#121212] border border-[#262626] rounded-xl overflow-hidden">
            {/* Notification Type */}
            <div className="px-5 py-4 border-b border-[#262626]">
              <div className="flex items-center gap-2 mb-3">
                <Bell className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-white">Notification Type</h3>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setNotificationType('info')}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors ${notificationType === 'info'
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    : 'bg-[#0A0A0A] border border-[#262626] text-gray-400 hover:border-blue-500/30'}`}
                >
                  <Info className="w-3 h-3" /> Info
                </button>
                <button
                  onClick={() => setNotificationType('warning')}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors ${notificationType === 'warning'
                    ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                    : 'bg-[#0A0A0A] border border-[#262626] text-gray-400 hover:border-yellow-500/30'}`}
                >
                  <AlertTriangle className="w-3 h-3" /> Warning
                </button>
                <button
                  onClick={() => setNotificationType('urgent')}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors ${notificationType === 'urgent'
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                    : 'bg-[#0A0A0A] border border-[#262626] text-gray-400 hover:border-red-500/30'}`}
                >
                  <AlertTriangle className="w-3 h-3" /> Urgent
                </button>
              </div>
            </div>

            {/* Title */}
            <div className="px-5 py-4 border-b border-[#262626]">
              <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-2">Title</label>
              <input
                type="text"
                value={notificationTitle}
                onChange={(e) => setNotificationTitle(e.target.value)}
                placeholder="Enter notification title"
                className="w-full bg-[#0A0A0A] border border-[#262626] text-white py-3 px-4 focus:outline-none focus:border-primary transition-colors text-sm rounded-lg"
              />
            </div>

            {/* Description */}
            <div className="px-5 py-4 border-b border-[#262626]">
              <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-2">Message</label>
              <textarea
                value={notificationDescription}
                onChange={(e) => setNotificationDescription(e.target.value)}
                placeholder="Enter notification message"
                rows={3}
                className="w-full bg-[#0A0A0A] border border-[#262626] text-white py-3 px-4 focus:outline-none focus:border-primary transition-colors text-sm rounded-lg resize-none"
              />
            </div>

            {/* Send Button */}
            <div className="px-5 py-4">
              <button
                onClick={handleSendNotification}
                disabled={sendingNotification || !notificationTitle.trim() || !notificationDescription.trim()}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 rounded-lg transition-colors text-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {sendingNotification ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />Sending...</>
                ) : (
                  <><Send className="w-4 h-4" />Send to All Students</>
                )}
              </button>
              <p className="text-[10px] text-gray-500 text-center mt-2">
                This will notify all students in your college
              </p>
            </div>
          </div>
        </section>
      </main>

      <AdminBottomNav />

      {/* Edit Name Modal */}
      {showEditName && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80">
          <div className="bg-[#121212] border border-[#262626] rounded-xl p-6 w-full max-w-sm relative">
            <button onClick={() => setShowEditName(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
            <h2 className="font-serif text-xl font-bold text-white mb-6">Edit Name</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-2">Full Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full bg-[#0A0A0A] border border-[#262626] text-white py-3 px-4 focus:outline-none focus:border-primary transition-colors text-sm rounded-lg"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowEditName(false)}
                  className="flex-1 border border-[#262626] text-gray-400 font-semibold py-3 rounded-lg hover:border-gray-500 transition-colors text-sm">
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
    </div>
  );
}
