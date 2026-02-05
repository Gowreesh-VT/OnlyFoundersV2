"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X, Check, Loader2, AlertCircle, Shield } from 'lucide-react';

type OnboardingStep = 'photo' | 'complete';

export default function OnboardingPage() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [step, setStep] = useState<OnboardingStep>('photo');
    
    // Photo upload states
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        checkAuth();
    }, []);

    const checkAuth = async () => {
        try {
            const response = await fetch('/api/auth/me');
            if (!response.ok) {
                router.push('/auth/login');
                return;
            }

            const data = await response.json();
            setUser(data.user);

            // Non-participant roles don't need onboarding - redirect to appropriate dashboard
            const role = data.user?.role;
            if (role === 'super_admin') {
                router.push('/super-admin/dashboard');
                return;
            } else if (role === 'admin') {
                router.push('/admin/dashboard');
                return;
            } else if (role === 'gate_volunteer') {
                router.push('/gate/scanner');
                return;
            } else if (role === 'cluster_monitor') {
                router.push('/cluster-admin/dashboard');
                return;
            }

            // If user already has photo, redirect to dashboard
            if (data.user?.photoUrl) {
                router.push('/dashboard');
                return;
            }
        } catch (error) {
            console.error('Auth check failed:', error);
            router.push('/auth/login');
        } finally {
            setLoading(false);
        }
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setError(null);

        // Validate file type
        if (!file.type.startsWith('image/')) {
            setError('Please select an image file');
            return;
        }

        // Validate file size (1.2MB max)
        const maxSize = 1.2 * 1024 * 1024;
        if (file.size > maxSize) {
            setError('Image size must be less than 1.2MB');
            return;
        }

        setSelectedFile(file);

        // Create preview
        const reader = new FileReader();
        reader.onloadend = () => {
            setPreview(reader.result as string);
        };
        reader.readAsDataURL(file);
    };

    const handleUpload = async () => {
        if (!selectedFile || !user) return;

        setUploading(true);
        setError(null);

        try {
            // Upload photo via API
            const formData = new FormData();
            formData.append('photo', selectedFile);

            const uploadResponse = await fetch('/api/upload/photo', {
                method: 'POST',
                body: formData,
            });

            if (!uploadResponse.ok) {
                const uploadData = await uploadResponse.json();
                throw new Error(uploadData.error || 'Failed to upload photo');
            }

            const { photoUrl } = await uploadResponse.json();

            // Complete onboarding - generate E-ID and QR token
            const response = await fetch('/api/onboarding/complete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ photoUrl }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to complete onboarding');
            }

            setStep('complete');
            
            // Redirect to E-ID page after success animation
            setTimeout(() => {
                router.push('/eid');
            }, 2000);
        } catch (err: any) {
            setError(err.message || 'Failed to upload photo. Please try again.');
            console.error('Upload error:', err);
        } finally {
            setUploading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4 relative">
            {/* Corner Dots */}
            <div className="corner-dot top-4 left-4" />
            <div className="corner-dot top-4 right-4" />
            <div className="corner-dot bottom-4 left-4" />
            <div className="corner-dot bottom-4 right-4" />

            {step === 'photo' && (
                <>
                    {/* Diamond Logo with Glow */}
                    <div className="flex justify-center mb-8">
                        <div className="w-24 h-24 rotate-45 border-2 border-primary relative gold-glow bg-black flex items-center justify-center">
                            <div className="w-12 h-12 -rotate-45">
                                <svg viewBox="0 0 24 24" fill="#FFD700" className="w-full h-full">
                                    <path d="M12 2L2 7L12 12L22 7L12 2Z"/>
                                    <path d="M2 17L12 22L22 17L12 12L2 17Z" opacity="0.7"/>
                                    <path d="M2 12L12 17L22 12" opacity="0.5"/>
                                </svg>
                            </div>
                        </div>
                    </div>

                    {/* Upload Area */}
                    <div className="w-full max-w-sm">
                        <div className="border-2 border-primary border-dashed p-8 mb-6 relative bg-[#0A0A0A]">
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleFileSelect}
                                className="hidden"
                                disabled={uploading}
                            />

                            {preview ? (
                                <div className="relative">
                                    <img 
                                        src={preview} 
                                        alt="Preview" 
                                        className="w-full h-64 object-cover"
                                    />
                                    {!uploading && (
                                        <button
                                            onClick={() => {
                                                setPreview(null);
                                                setSelectedFile(null);
                                            }}
                                            className="absolute top-2 right-2 bg-black/80 text-primary p-2 hover:bg-black transition-colors"
                                        >
                                            <X size={20} />
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full h-64 flex flex-col items-center justify-center text-primary hover:bg-primary/5 transition-colors"
                                    disabled={uploading}
                                >
                                    <Plus size={48} strokeWidth={1} />
                                    <span className="tech-text text-sm mt-4">UPLOAD PHOTO</span>
                                    <span className="tech-text text-xs text-gray-600 mt-1">TO INITIALIZE</span>
                                </button>
                            )}
                        </div>

                        {/* Status Text */}
                        <div className="text-center mb-6">
                            <span className="tech-text text-gray-500 text-sm tracking-widest">
                                PENDING IDENTITY VERIFICATION...
                            </span>
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="flex items-center gap-2 text-red-500 mb-4 p-3 bg-red-500/10 border border-red-500/30">
                                <AlertCircle size={16} />
                                <span className="tech-text text-xs">{error}</span>
                            </div>
                        )}

                        {/* Mandatory Notice */}
                        <div className="bg-primary/10 border-l-4 border-primary p-4 mb-8">
                            <p className="tech-text text-primary text-xs">
                                &gt; MANDATORY: UPLOAD IDENTITY IMAGE
                            </p>
                        </div>

                        {/* Upload Button */}
                        {preview && (
                            <button
                                onClick={handleUpload}
                                disabled={uploading}
                                className="w-full bg-primary hover:bg-primary-hover text-black py-4 tech-text text-sm tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {uploading ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        INITIALIZING...
                                    </>
                                ) : (
                                    <>
                                        <Shield size={18} />
                                        VERIFY IDENTITY
                                    </>
                                )}
                            </button>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="absolute bottom-8 left-0 right-0 px-6">
                        <div className="flex justify-between items-center max-w-sm mx-auto">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-0.5 bg-primary" />
                                <span className="tech-text text-gray-600 text-[10px]">SECURE CONNECTION</span>
                            </div>
                            <span className="tech-text text-gray-600 text-[10px]">ONLYFOUNDERS V2.0</span>
                        </div>
                    </div>
                </>
            )}

            {step === 'complete' && (
                <div className="text-center">
                    <div className="w-20 h-20 bg-green-500/20 border-2 border-green-500 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                        <Check size={40} className="text-green-500" />
                    </div>
                    <h2 className="text-2xl font-serif text-white mb-2">Identity Verified</h2>
                    <p className="tech-text text-gray-500 text-sm">REDIRECTING TO E-ID...</p>
                </div>
            )}
        </div>
    );
}
