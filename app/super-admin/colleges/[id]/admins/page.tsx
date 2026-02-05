"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Building2, Eye, EyeOff, UserPlus, Trash2, Loader2 } from "lucide-react";
import SuperAdminBottomNav from "../../../../components/SuperAdminBottomNav";

type Admin = {
    id: string;
    full_name: string;
    email: string;
    member_id: string | null;
    created_at: string;
};

type College = {
    id: string;
    name: string;
    location: string | null;
};

export default function CollegeAdminsPage() {
    const router = useRouter();
    const params = useParams();
    const collegeId = params.id as string;

    const [loading, setLoading] = useState(true);
    const [college, setCollege] = useState<College | null>(null);
    const [admins, setAdmins] = useState<Admin[]>([]);
    const [showAddForm, setShowAddForm] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    const [error, setError] = useState("");
    const [newAdmin, setNewAdmin] = useState({
        name: "",
        email: "",
        password: "",
    });

    const fetchData = useCallback(async () => {
        try {
            // Fetch college details
            const collegeRes = await fetch(`/api/super-admin/colleges/${collegeId}`);
            if (!collegeRes.ok) {
                if (collegeRes.status === 401) {
                    router.push('/auth/login');
                    return;
                }
                if (collegeRes.status === 403) {
                    router.push('/dashboard');
                    return;
                }
                throw new Error('Failed to fetch college');
            }
            const collegeData = await collegeRes.json();
            setCollege(collegeData.college);

            // Fetch admins
            const adminsRes = await fetch(`/api/super-admin/colleges/${collegeId}/admins`);
            if (adminsRes.ok) {
                const adminsData = await adminsRes.json();
                setAdmins(adminsData.admins || []);
            }
        } catch (err) {
            console.error('Failed to fetch data:', err);
            setError('Failed to load data');
        } finally {
            setLoading(false);
        }
    }, [collegeId, router]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleAddAdmin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (!newAdmin.name || !newAdmin.email || !newAdmin.password) {
            setError("Please fill in all fields");
            return;
        }

        if (newAdmin.password.length < 6) {
            setError("Password must be at least 6 characters");
            return;
        }

        setIsAdding(true);

        try {
            const response = await fetch(`/api/super-admin/colleges/${collegeId}/admins`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fullName: newAdmin.name,
                    email: newAdmin.email,
                    password: newAdmin.password,
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                setError(data.error || 'Failed to create admin');
                return;
            }

            const data = await response.json();
            setAdmins([...admins, data.admin]);
            setNewAdmin({ name: "", email: "", password: "" });
            setShowAddForm(false);
        } catch (err) {
            console.error('Add admin failed:', err);
            setError('Failed to add admin');
        } finally {
            setIsAdding(false);
        }
    };

    const handleRemoveAdmin = async (adminId: string) => {
        if (admins.length <= 1) {
            alert("College must have at least one admin");
            return;
        }
        if (!confirm("Are you sure you want to remove this admin?")) {
            return;
        }

        // Note: Would need a delete admin API endpoint
        // For now, just remove from local state
        setAdmins(admins.filter((a) => a.id !== adminId));
    };

    if (loading) {
        return (
            <main className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </main>
        );
    }

    return (
        <div className="min-h-screen bg-[#0A0A0A] pb-28 relative overflow-hidden">
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
            <header className="relative z-10 px-6 py-5 flex items-center gap-4 border-b border-[#262626]">
                <button
                    onClick={() => router.push("/super-admin/colleges")}
                    className="p-2 text-gray-500 hover:text-primary transition-colors"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
                        <Building2 className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                        <h1 className="font-serif text-lg font-bold text-white">
                            {college?.name || 'College'}
                        </h1>
                        <p className="text-[9px] text-gray-500 uppercase tracking-[0.2em]">
                            Manage Admins
                        </p>
                    </div>
                </div>
            </header>

            <div className="relative z-10 px-6 py-6 max-w-md mx-auto">
                {/* Error */}
                {error && (
                    <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                        {error}
                    </div>
                )}

                {/* College Info */}
                <div className="bg-[#121212] border border-[#262626] rounded-xl p-4 mb-6 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary font-serif text-lg">
                        {college?.name?.charAt(0) || '?'}
                    </div>
                    <div>
                        <p className="font-semibold text-white">{college?.name}</p>
                        <p className="text-xs text-gray-500">{college?.location || 'No location'} • {admins.length} admin(s)</p>
                    </div>
                </div>

                {/* Admin List */}
                <div className="mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-[10px] text-primary font-bold uppercase tracking-widest">
                            Admins ({admins.length})
                        </h2>
                        <button
                            onClick={() => setShowAddForm(!showAddForm)}
                            className="flex items-center gap-1 text-sm text-primary hover:text-primary-hover transition-colors"
                        >
                            <UserPlus className="w-4 h-4" />
                            Add Admin
                        </button>
                    </div>

                    <div className="space-y-3">
                        {admins.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                                No admins yet. Add one to get started.
                            </div>
                        ) : (
                            admins.map((admin, index) => (
                                <div
                                    key={admin.id}
                                    className="bg-[#121212] border border-[#262626] rounded-xl p-4 flex items-center justify-between"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-white font-semibold text-sm">
                                            {admin.full_name?.charAt(0) || '?'}
                                        </div>
                                        <div>
                                            <p className="font-semibold text-white">{admin.full_name}</p>
                                            <p className="text-xs text-gray-500">{admin.email}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="px-2 py-1 rounded text-[9px] font-bold uppercase tracking-wider bg-green-500/20 text-green-400 border border-green-500/30">
                                            Active
                                        </span>
                                        {index > 0 && (
                                            <button
                                                onClick={() => handleRemoveAdmin(admin.id)}
                                                className="p-2 text-gray-500 hover:text-red-500 transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Add Admin Form */}
                {showAddForm && (
                    <div className="bg-[#121212] border border-primary/30 rounded-xl p-5 mb-6">
                        <h3 className="text-[10px] text-primary font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
                            <UserPlus className="w-4 h-4" />
                            Add New Admin
                        </h3>

                        <form onSubmit={handleAddAdmin} className="space-y-4">
                            <div>
                                <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-2">
                                    Name *
                                </label>
                                <input
                                    type="text"
                                    placeholder="Full name"
                                    value={newAdmin.name}
                                    onChange={(e) => setNewAdmin({ ...newAdmin, name: e.target.value })}
                                    className="w-full bg-[#0A0A0A] border border-[#262626] text-white placeholder-gray-600 py-3 px-4 focus:outline-none focus:border-primary transition-colors text-sm rounded-lg"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-2">
                                    Email *
                                </label>
                                <input
                                    type="email"
                                    placeholder="admin@college.edu"
                                    value={newAdmin.email}
                                    onChange={(e) => setNewAdmin({ ...newAdmin, email: e.target.value })}
                                    className="w-full bg-[#0A0A0A] border border-[#262626] text-white placeholder-gray-600 py-3 px-4 focus:outline-none focus:border-primary transition-colors text-sm rounded-lg"
                                    required
                                />
                            </div>

                            <div className="relative">
                                <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-2">
                                    Temporary Password *
                                </label>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Min 6 characters"
                                    value={newAdmin.password}
                                    onChange={(e) => setNewAdmin({ ...newAdmin, password: e.target.value })}
                                    className="w-full bg-[#0A0A0A] border border-[#262626] text-white placeholder-gray-600 py-3 px-4 pr-12 focus:outline-none focus:border-primary transition-colors text-sm rounded-lg"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-[38px] text-gray-500 hover:text-gray-400"
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowAddForm(false);
                                        setNewAdmin({ name: "", email: "", password: "" });
                                        setError("");
                                    }}
                                    className="flex-1 border border-[#262626] text-gray-400 font-semibold py-3 rounded-lg hover:border-gray-500 transition-colors text-sm"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isAdding}
                                    className="flex-1 bg-primary hover:bg-primary-hover text-black font-semibold py-3 rounded-lg transition-colors text-sm flex items-center justify-center"
                                >
                                    {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add Admin"}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Note */}
                <div className="bg-[#121212] border border-[#262626] rounded-xl p-4 text-center">
                    <p className="text-xs text-gray-500">
                        💡 New admins will receive login credentials via email. They can change their password after first login.
                    </p>
                </div>
            </div>

            {/* Bottom Navigation */}
            <SuperAdminBottomNav />
        </div>
    );
}
