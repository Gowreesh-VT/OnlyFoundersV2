"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, ChevronLeft } from 'lucide-react';
import StudentBottomNav from '../components/StudentBottomNav';

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const response = await fetch('/api/auth/me');
      if (!response.ok) {
        router.push('/auth/login');
        return;
      }

      const data = await response.json();
      setUser(data.user);
    } catch (error) {
      console.error('Failed to fetch user:', error);
      router.push('/auth/login');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/auth/login');
    } catch (error) {
      console.error('Logout failed:', error);
      setLoggingOut(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="text-primary tech-text">LOADING...</div>
      </div>
    );
  }

  const profile = user;

  return (
    <div className="min-h-screen bg-[#3a3a2e] text-white pb-24">
      {/* Header */}
      <div className="bg-[#2a2a20] border-b border-primary/20 px-4 py-4 sticky top-0 z-40">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-300">
            <ChevronLeft size={24} />
          </button>
          <h1 className="tech-text text-white tracking-widest text-sm">ONLYFOUNDERS</h1>
          <div className="w-6"></div>
        </div>
      </div>

      {/* Profile Content */}
      <div className="max-w-lg mx-auto px-6 py-8">
        {/* Photo Section */}
        <div className="flex justify-center mb-8">
          <div className="relative">
            <div className="w-48 h-48 border-2 border-primary border-dashed p-2">
              {profile?.photoUrl ? (
                <img 
                  src={profile.photoUrl} 
                  alt={profile.fullName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-[#4a4a3e] flex items-center justify-center">
                  <span className="text-gray-500 text-4xl">{profile?.fullName?.[0] || '?'}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Profile Info */}
        <div className="space-y-6 mb-6">
          {/* Full Name */}
          <div className="border-l-4 border-primary pl-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 bg-primary rounded-full"></div>
              <span className="tech-text text-primary text-xs tracking-wider">FULL NAME</span>
            </div>
            <p className="text-white text-2xl font-serif">{profile?.fullName || 'Unknown'}</p>
          </div>

          {/* Email */}
          <div className="border-l-4 border-transparent pl-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 bg-primary rounded-full"></div>
              <span className="tech-text text-primary text-xs tracking-wider">EMAIL ADDRESS</span>
            </div>
            <p className="text-gray-300 text-base">{user?.email || 'N/A'}</p>
          </div>

          {/* Entity ID and Access Level */}
          <div className="grid grid-cols-2 gap-6">
            <div className="border-l-4 border-transparent pl-4">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 bg-primary rounded-full"></div>
                <span className="tech-text text-primary text-xs tracking-wider">ENTITY ID</span>
              </div>
              <p className="text-white tech-text text-sm">{profile?.entityId || '8X-992-ALPHA'}</p>
            </div>
            <div className="pl-4">
              <span className="tech-text text-primary text-xs tracking-wider mb-1 block">ACCESS LEVEL</span>
              <div className="mt-2">
                <span className="border border-primary bg-primary/10 text-green px-3 py-1.5 text-xs tech-text tracking-wider inline-block">
                  {profile?.role?.toUpperCase() || 'PARTICIPANT'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Disconnect Button */}
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full border-2 border-primary bg-transparent hover:bg-primary/5 text-primary py-4 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-8 text-center"
        >
          {loggingOut ? (
            <span className="tech-text text-md tracking-wider">DISCONNECTING...</span>
          ) : (
            <span className="tech-text text-md tracking-wider">DISCONNECT SESSION</span>
          )}
        </button>

        {/* Footer Info */}
        <div className="mt-12 text-center">
          <p className="tech-text text-gray-600 text-[10px] tracking-widest">
            SYS_VER 4.2 // NODE_ID 09A // ENCRYPTED
          </p>
        </div>
      </div>

      <StudentBottomNav />
    </div>
  );
}
