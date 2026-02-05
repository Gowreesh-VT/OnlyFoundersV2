"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Building2, Eye, EyeOff, User, Check, Loader2 } from "lucide-react";
import SuperAdminBottomNav from "../../../components/SuperAdminBottomNav";

export default function CreateCollegePage() {
    const router = useRouter();
    const [formData, setFormData] = useState({
        collegeName: "",
        location: "",
        adminName: "",
        adminEmail: "",
        adminPassword: "",
    });
    const [showPassword, setShowPassword] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [isCreated, setIsCreated] = useState(false);
    const [error, setError] = useState("");
    const [createdCollegeId, setCreatedCollegeId] = useState("");

    const handleChange = (field: string, value: string) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (!formData.collegeName || !formData.adminName || !formData.adminEmail || !formData.adminPassword) {
            setError("Please fill in all required fields");
            return;
        }

        if (formData.adminPassword.length < 6) {
            setError("Password must be at least 6 characters");
            return;
        }

        setIsCreating(true);

        try {
            // Step 1: Create the college
            const collegeRes = await fetch('/api/super-admin/colleges/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: formData.collegeName,
                    location: formData.location || null,
                    status: 'active',
                }),
            });

            if (!collegeRes.ok) {
                const data = await collegeRes.json();
                setError(data.error || 'Failed to create college');
                return;
            }

            const collegeData = await collegeRes.json();
            const collegeId = collegeData.college.id;
            setCreatedCollegeId(collegeId);

            // Step 2: Create the admin for this college
            const adminRes = await fetch(`/api/super-admin/colleges/${collegeId}/admins`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fullName: formData.adminName,
                    email: formData.adminEmail,
                    password: formData.adminPassword,
                }),
            });

            if (!adminRes.ok) {
                const data = await adminRes.json();
                setError(data.error || 'College created but failed to create admin');
                // Still show success for college creation
            }

            setIsCreated(true);
        } catch (err) {
            console.error('Create failed:', err);
            setError('An error occurred. Please try again.');
        } finally {
            setIsCreating(false);
        }
    };

    const handleGoBack = () => {
        router.push("/super-admin/colleges");
    };

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
                <div className="absolute top-1/4 left-0 w-64 h-64 bg-green-500/10 rounded-full blur-3xl" />
            </div>

            {/* Header */}
            <header className="relative z-10 px-6 py-5 flex items-center gap-4 border-b border-[#262626]">
                <button
                    onClick={handleGoBack}
                    className="p-2 text-gray-500 hover:text-primary transition-colors"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center">
                        <Building2 className="w-4 h-4 text-green-500" />
                    </div>
                    <div>
                        <h1 className="font-serif text-lg font-bold text-white">
                            Onboard College
                        </h1>
                        <p className="text-[9px] text-gray-500 uppercase tracking-[0.2em]">
                            Add New Institution & Admin
                        </p>
                    </div>
                </div>
            </header>

            <div className="relative z-10 px-6 py-8 max-w-md mx-auto">
                {!isCreated ? (
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Error Message */}
                        {error && (
                            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                                {error}
                            </div>
                        )}

                        {/* College Details */}
                        <div className="bg-[#121212] border border-[#262626] rounded-xl p-5">
                            <h2 className="text-[10px] text-primary font-bold uppercase tracking-widest mb-4">
                                College Details
                            </h2>

                            <div className="mb-4">
                                <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-2">
                                    College Name *
                                </label>
                                <input
                                    type="text"
                                    placeholder="Enter new college name"
                                    value={formData.collegeName}
                                    onChange={(e) => handleChange("collegeName", e.target.value)}
                                    className="w-full bg-[#0A0A0A] border border-[#262626] text-white placeholder-gray-600 py-3 px-4 focus:outline-none focus:border-green-500 transition-colors text-sm rounded-lg"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-2">
                                    Location
                                </label>
                                <input
                                    type="text"
                                    placeholder="City, State"
                                    value={formData.location}
                                    onChange={(e) => handleChange("location", e.target.value)}
                                    className="w-full bg-[#0A0A0A] border border-[#262626] text-white placeholder-gray-600 py-3 px-4 focus:outline-none focus:border-green-500 transition-colors text-sm rounded-lg"
                                />
                            </div>
                        </div>

                        {/* Initial Admin - Compulsory */}
                        <div className="bg-[#121212] border border-[#262626] rounded-xl p-5">
                            <h2 className="text-[10px] text-primary font-bold uppercase tracking-widest mb-1 flex items-center gap-2">
                                <User className="w-4 h-4" />
                                Initial Admin (Required)
                            </h2>
                            <p className="text-[10px] text-gray-500 mb-4">
                                You can add more admins later from the college details page
                            </p>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-2">
                                        Admin Name *
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Full name"
                                        value={formData.adminName}
                                        onChange={(e) => handleChange("adminName", e.target.value)}
                                        className="w-full bg-[#0A0A0A] border border-[#262626] text-white placeholder-gray-600 py-3 px-4 focus:outline-none focus:border-green-500 transition-colors text-sm rounded-lg"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-2">
                                        Admin Email *
                                    </label>
                                    <input
                                        type="email"
                                        placeholder="admin@college.edu"
                                        value={formData.adminEmail}
                                        onChange={(e) => handleChange("adminEmail", e.target.value)}
                                        className="w-full bg-[#0A0A0A] border border-[#262626] text-white placeholder-gray-600 py-3 px-4 focus:outline-none focus:border-green-500 transition-colors text-sm rounded-lg"
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
                                        value={formData.adminPassword}
                                        onChange={(e) => handleChange("adminPassword", e.target.value)}
                                        className="w-full bg-[#0A0A0A] border border-[#262626] text-white placeholder-gray-600 py-3 px-4 pr-12 focus:outline-none focus:border-green-500 transition-colors text-sm rounded-lg"
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
                            </div>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={isCreating}
                            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-4 rounded-xl transition-all duration-300 shadow-[0_0_20px_rgba(34,197,94,0.15)] hover:shadow-[0_0_30px_rgba(34,197,94,0.25)] uppercase tracking-widest text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                        >
                            {isCreating ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                "Create College & Admin"
                            )}
                        </button>
                    </form>
                ) : (
                    /* Success State */
                    <div className="bg-[#121212] border border-[#262626] rounded-xl p-8 text-center">
                        <div className="mx-auto w-16 h-16 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center mb-6">
                            <Check className="w-8 h-8 text-green-500" />
                        </div>

                        <h2 className="font-serif text-2xl font-bold text-white mb-2">
                            College Onboarded!
                        </h2>
                        <p className="text-gray-500 text-sm mb-6">
                            {formData.collegeName} has been successfully added with initial admin.
                        </p>

                        <div className="bg-[#0A0A0A] border border-[#262626] rounded-lg p-4 mb-6 text-left">
                            <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Admin Login Details</p>
                            <p className="text-sm text-white mb-1">Name: <span className="text-gray-300">{formData.adminName}</span></p>
                            <p className="text-sm text-white mb-1">Email: <span className="text-primary">{formData.adminEmail}</span></p>
                            <p className="text-sm text-white">Password: <span className="text-gray-400">(as set)</span></p>
                        </div>

                        <p className="text-xs text-gray-500 mb-6">
                            💡 Need more admins? Go to college details to add additional admins.
                        </p>

                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setIsCreated(false);
                                    setFormData({
                                        collegeName: "",
                                        location: "",
                                        adminName: "",
                                        adminEmail: "",
                                        adminPassword: "",
                                    });
                                    setError("");
                                }}
                                className="flex-1 border border-[#262626] text-gray-400 font-semibold py-3 rounded-xl hover:border-green-500 hover:text-green-500 transition-colors text-sm uppercase tracking-wider"
                            >
                                Add Another
                            </button>
                            <button
                                onClick={handleGoBack}
                                className="flex-1 bg-primary hover:bg-primary-hover text-black font-semibold py-3 rounded-xl transition-colors text-sm uppercase tracking-wider"
                            >
                                View All
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Bottom Navigation */}
            <SuperAdminBottomNav />
        </div>
    );
}
