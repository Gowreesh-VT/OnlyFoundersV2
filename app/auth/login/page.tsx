"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, ArrowRight, Loader2 } from 'lucide-react';
import { FeedbackButton } from '@/components/ui/FeedbackButton';
import { usePhotoUpload } from '@/app/components/PhotoUploadProvider';

export default function LoginPage() {
  const router = useRouter();
  const { setProfileFromLogin } = usePhotoUpload();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Login failed');
        return;
      }

      // Pass profile data to PhotoUploadProvider - shows modal IMMEDIATELY if no photo
      const user = data.user;
      if (user) {
        setProfileFromLogin({
          id: user.id,
          full_name: user.fullName || '',
          photo_url: user.photoUrl,
          role: user.role,
        });
      }

      // Redirect based on role
      const role = user?.role;
      if (role === 'super_admin') {
        router.push('/super-admin/dashboard');
      } else if (role === 'admin') {
        router.push('/cluster-admin/dashboard');
      } else if (role === 'gate_volunteer') {
        router.push('/gate/scanner');
      } else if (role === 'event_coordinator') {
        router.push('/coordinator/dashboard');
      } else if (role === 'cluster_monitor') {
        router.push('/cluster-admin/dashboard');
      } else {
        // Participant: check if onboarding is complete
        if (!user?.photoUrl || !user?.entityId) {
          router.push('/onboarding');
        } else {
          router.push('/dashboard');
        }
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
      console.error('Login error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div
          className="absolute top-0 right-0 w-full h-2/3 bg-cover bg-center opacity-10 mix-blend-color-dodge"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1516912481808-3406841bd33c?q=80&w=2444&auto=format&fit=crop')" }}
        />
        <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to from-[#0A0A0A] via-[#0A0A0A] to-transparent z-10" />
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to from-[#0A0A0A]/80 via-transparent to-[#0A0A0A] z-10" />
        <div className="absolute top-1/4 right-0 w-64 h-64 bg-red-900/20 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-20">
        {/* Login Card */}
        <div className="glass-panel rounded-sm border border-[#2A2A2A] p-8 shadow-2xl">
          {/* Gold accent line */}
          <div className="h-0.5 bg-primary mb-8 -mt-8 -mx-8" />

          {/* Logo */}
          <div className="text-center mb-8">
            <img src="/only-founders-logo.png" alt="OnlyFounders Logo" className="mx-auto h-20 w-auto" />
          </div>

          {/* Title */}
          <div className="text-center mb-8">
            <h2 className="text-2xl font-light text-white mb-2">
              Welcome Back
            </h2>
            <p className="text-gray-500 text-xs tracking-widest uppercase">
              The Exclusive Network
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Form */}
          <div className="space-y-5">
            {/* Email Input */}
            <div>
              <input
                type="email"
                placeholder="EMAIL ADDRESS"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-transparent border-b border-gray-700 text-white placeholder-gray-600 py-3 px-0 focus:outline-none focus:border-primary transition-colors text-sm tracking-wide"
              />
            </div>

            {/* Password Input */}
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="PASSWORD"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-transparent border-b border-gray-700 text-white placeholder-gray-600 py-3 px-0 pr-10 focus:outline-none focus:border-primary transition-colors text-sm tracking-wide"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-0 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-400"
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>

            {/* Submit Button */}
            <FeedbackButton
              type="button"
              onClick={handleSubmit}
              disabled={isLoading}
              className="group w-full bg-primary hover:bg-primary-hover text-black font-semibold py-4 mt-6 transition-all duration-300 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              feedbackType="process"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <span className="tracking-widest text-sm">ENTER</span>
                  <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </FeedbackButton>
          </div>

        </div>

        {/* Footer */}
        <div className="mt-12 text-center">
          <div className="flex items-center justify-center gap-4 text-xs text-gray-700">
            <span>© 2026 ONLYFOUNDERS</span>
          </div>
        </div>
      </div>
    </div>
  );
}