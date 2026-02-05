"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, Plus, TrendingUp, Users, Building2, Edit2, Trash2, UserPlus, X, Loader2, Eye } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import SuperAdminBottomNav from "../../components/SuperAdminBottomNav";
import { useCache } from "@/lib/cache/CacheProvider";

type CollegeWithStats = {
  id: string;
  name: string;
  location: string | null;
  status: string;
  students: number;
  teams: number;
  admins: number;
};

const statusStyles: Record<string, string> = {
  active: "bg-green-500/20 text-green-400 border-green-500/30",
  pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  inactive: "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

export default function SuperAdminCollegesPage() {
  const router = useRouter();
  const cache = useCache();
  const [loading, setLoading] = useState(true);
  const [colleges, setColleges] = useState<CollegeWithStats[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("All");
  const [editingCollege, setEditingCollege] = useState<CollegeWithStats | null>(null);
  const [editForm, setEditForm] = useState({ name: "", location: "", status: "active" });
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const fetchColleges = useCallback(async () => {
    try {
      // Check cache first
      const cached = cache.get<{ colleges: CollegeWithStats[] }>('super-admin-colleges');
      const cachedUser = cache.get<{ name: string }>('super-admin-user');

      if (cached && cachedUser) {
        setColleges(cached.colleges);
        setLoading(false);
        return;
      }

      // Verify auth
      const authRes = await fetch('/api/auth/me');
      if (!authRes.ok) { router.push('/auth/login'); return; }
      const authData = await authRes.json();
      if (authData.user?.role !== 'super_admin') { router.push('/dashboard'); return; }

      // Cache user info
      cache.set('super-admin-user', { name: authData.user?.fullName || 'Super Admin' }, 10 * 60 * 1000);

      // Fetch colleges
      const res = await fetch('/api/super-admin/colleges');
      if (res.ok) {
        const data = await res.json();
        setColleges(data.colleges || []);
        cache.set('super-admin-colleges', data);
      }
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [router, cache]);


  useEffect(() => {
    fetchColleges();
  }, [fetchColleges]);

  const totalStudents = colleges.reduce((sum, c) => sum + c.students, 0);
  const activeColleges = colleges.filter((c) => c.status === "active").length;

  const filteredColleges = colleges.filter(
    (college) =>
      (filterStatus === "All" || college.status === filterStatus.toLowerCase()) &&
      (college.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (college.location?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false))
  );

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to remove this college?")) return;
    setIsDeleting(id);
    try {
      const response = await fetch(`/api/super-admin/colleges/${id}`, { method: 'DELETE' });
      if (response.ok) {
        cache.invalidate('super-admin-colleges');
        setColleges(prev => prev.filter(c => c.id !== id));
      } else { alert('Failed to delete'); }
    } catch { alert('Failed to delete'); }
    finally { setIsDeleting(null); }
  };

  const handleEdit = (college: CollegeWithStats) => {
    setEditingCollege(college);
    setEditForm({ name: college.name, location: college.location || "", status: college.status });
  };

  const handleSaveEdit = async () => {
    if (!editingCollege || !editForm.name) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/super-admin/colleges/${editingCollege.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editForm.name, location: editForm.location || null, status: editForm.status }),
      });
      if (response.ok) {
        cache.invalidate('super-admin-colleges');
        const updated = await response.json();
        setColleges(prev => prev.map(c => c.id === editingCollege.id ? { ...c, ...updated.college } : c));
        setEditingCollege(null);
      } else { alert('Failed to update'); }
    } catch { alert('Failed to update'); }
    finally { setIsSaving(false); }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white pb-28 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-full h-2/3 bg-cover bg-center opacity-10 mix-blend-color-dodge"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1516912481808-3406841bd33c?q=80&w=2444&auto=format&fit=crop')" }} />
        <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A] to-transparent z-10" />
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-[#0A0A0A]/80 via-transparent to-[#0A0A0A] z-10" />
      </div>

      {/* Header */}
      <header className="relative z-10 px-6 py-5 flex items-center justify-between border-b border-[#262626]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
            <Building2 className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h1 className="font-serif text-lg font-bold text-white">Manage Colleges</h1>
            <p className="text-[9px] text-gray-500 uppercase tracking-[0.2em]">Super Admin Portal</p>
          </div>
        </div>
        <Link href="/super-admin/colleges/create"
          className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-black font-semibold px-4 py-2 rounded-lg transition-all text-sm">
          <Plus className="w-4 h-4" /> Add
        </Link>
      </header>

      <div className="relative z-10 px-6 py-6 max-w-4xl mx-auto">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-[#121212] border border-[#262626] rounded-xl p-5 hover:border-primary/30 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-500">Total Colleges</p>
              <Building2 className="w-5 h-5 text-gray-600" />
            </div>
            <p className="text-3xl font-bold text-white">{colleges.length}</p>
            <div className="flex items-center gap-1 mt-1">
              <TrendingUp className="w-3 h-3 text-green-500" />
              <span className="text-xs text-green-500">{activeColleges} active</span>
            </div>
          </div>
          <div className="bg-[#121212] border border-[#262626] rounded-xl p-5 hover:border-primary/30 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-500">Total Students</p>
              <Users className="w-5 h-5 text-gray-600" />
            </div>
            <p className="text-3xl font-bold text-white">{totalStudents.toLocaleString()}</p>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="flex gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-600" />
            <input type="text" placeholder="Search colleges..."
              value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#121212] border border-[#262626] rounded-lg px-12 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-primary transition-colors" />
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {(["All", "Active", "Pending", "Inactive"] as const).map((status) => (
            <button key={status} onClick={() => setFilterStatus(status)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${filterStatus === status
                ? "bg-primary text-black" : "bg-[#121212] border border-[#262626] text-gray-400 hover:border-primary hover:text-primary"}`}>
              {status}
            </button>
          ))}
        </div>

        {/* College List */}
        <div className="space-y-3">
          {filteredColleges.map((college) => (
            <div key={college.id} className="bg-[#121212] border border-[#262626] rounded-xl p-4 hover:border-primary/30 transition-colors">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary font-serif text-sm">
                    {college.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold text-white">{college.name}</p>
                    <p className="text-xs text-gray-500">{college.location || 'No location'} • {college.admins} admin{college.admins !== 1 ? 's' : ''}</p>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded text-[9px] font-bold uppercase tracking-wider border ${statusStyles[college.status] || statusStyles.inactive}`}>
                  {college.status}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6 text-sm">
                  <div><span className="text-white font-semibold">{college.students.toLocaleString()}</span><span className="text-gray-500 ml-1">students</span></div>
                  <div><span className="text-white font-semibold">{college.teams}</span><span className="text-gray-500 ml-1">teams</span></div>
                </div>
                <div className="flex items-center gap-2">
                  <Link href={`/super-admin/colleges/${college.id}`} className="p-2 text-gray-500 hover:text-primary transition-colors" title="View Details">
                    <Eye className="w-4 h-4" />
                  </Link>
                  <button onClick={() => handleEdit(college)} className="p-2 text-gray-500 hover:text-primary transition-colors" title="Edit"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={() => handleDelete(college.id)} disabled={isDeleting === college.id} className="p-2 text-gray-500 hover:text-red-500 transition-colors disabled:opacity-50" title="Delete">
                    {isDeleting === college.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredColleges.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            {searchQuery || filterStatus !== "All" ? "No colleges found matching your criteria." : "No colleges yet. Add one to get started!"}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingCollege && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <div className="bg-[#121212] border border-[#262626] rounded-xl p-6 w-full max-w-md relative">
            <button onClick={() => setEditingCollege(null)} className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
            <h2 className="font-serif text-xl font-bold text-white mb-6">Edit College</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-2">College Name *</label>
                <input type="text" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full bg-[#0A0A0A] border border-[#262626] text-white py-3 px-4 focus:outline-none focus:border-primary transition-colors text-sm rounded-lg" />
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-2">Location</label>
                <input type="text" value={editForm.location} onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                  className="w-full bg-[#0A0A0A] border border-[#262626] text-white py-3 px-4 focus:outline-none focus:border-primary transition-colors text-sm rounded-lg" />
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-2">Status</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["active", "pending", "inactive"] as const).map((status) => (
                    <button key={status} type="button" onClick={() => setEditForm({ ...editForm, status })}
                      className={`py-2 px-3 rounded-lg text-sm font-semibold transition-all capitalize ${editForm.status === status ? statusStyles[status] + " border" : "bg-[#0A0A0A] border border-[#262626] text-gray-500 hover:border-gray-500"}`}>
                      {status}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button onClick={() => setEditingCollege(null)} className="flex-1 border border-[#262626] text-gray-400 font-semibold py-3 rounded-lg hover:border-gray-500 transition-colors text-sm">Cancel</button>
                <button onClick={handleSaveEdit} disabled={isSaving}
                  className="flex-1 bg-primary hover:bg-primary-hover text-black font-semibold py-3 rounded-lg transition-colors text-sm flex items-center justify-center">
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <SuperAdminBottomNav />
    </div>
  );
}
