"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, RefreshCw, Loader2, X, ZoomIn } from 'lucide-react';
import StudentBottomNav from '../components/StudentBottomNav';
import QRCode from 'qrcode';

export default function EIDPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [largeQrDataUrl, setLargeQrDataUrl] = useState<string>('');
  const [refreshing, setRefreshing] = useState(false);
  const [showEnlargedQR, setShowEnlargedQR] = useState(false);

  useEffect(() => {
    fetchUserData();
  }, []);

  useEffect(() => {
    if (user?.qrToken) {
      generateQRCode(user.qrToken);
    }
  }, [user]);

  const fetchUserData = async () => {
    try {
      const response = await fetch('/api/auth/me');
      if (!response.ok) {
        router.push('/auth/login');
        return;
      }

      const data = await response.json();
      setUser(data.user);
      
      // If no photo, redirect to onboarding
      if (!data.user?.photoUrl) {
        router.push('/onboarding');
        return;
      }
    } catch (error) {
      console.error('Failed to fetch user:', error);
      router.push('/auth/login');
    } finally {
      setLoading(false);
    }
  };

  const generateQRCode = async (token: string) => {
    try {
      // Generate normal size QR code
      const url = await QRCode.toDataURL(token, {
        width: 280,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
        errorCorrectionLevel: 'H',
      });
      setQrDataUrl(url);

      // Generate larger QR code for modal
      const largeUrl = await QRCode.toDataURL(token, {
        width: 500,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
        errorCorrectionLevel: 'H',
      });
      setLargeQrDataUrl(largeUrl);
    } catch (error) {
      console.error('QR generation error:', error);
    }
  };

  const handleRefreshQR = async () => {
    setRefreshing(true);
    try {
      const response = await fetch('/api/eid/qr', { method: 'POST' });
      if (response.ok) {
        const data = await response.json();
        generateQRCode(data.qrToken);
      }
    } catch (error) {
      console.error('QR refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  const profile = user;
  const team = user?.team;
  const currentDate = new Date();
  // Convert to IST (UTC+5:30)
  const istDate = new Date(currentDate.getTime() + (5.5 * 60 * 60 * 1000));
  const formattedDate = `${istDate.getDate().toString().padStart(2, '0')} ${istDate.toLocaleString('en', { month: 'short' }).toUpperCase()} ${istDate.getFullYear()} // ${istDate.toISOString().split('T')[1].split('.')[0]} UTC`;

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white pb-24">
      {/* Corner Dots */}
      <div className="fixed top-4 left-4 w-2 h-2 rounded-full bg-primary/50 z-50" />
      <div className="fixed top-4 right-4 w-2 h-2 rounded-full bg-primary/50 z-50" />
      
      {/* Header */}
      <div className="bg-[#0A0A0A] border-b border-[#262626] px-4 py-4 sticky top-0 z-40">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-white transition-colors">
            <ChevronLeft size={24} />
          </button>
          <h1 className="tech-text text-white tracking-widest text-sm">ONLYFOUNDERS</h1>
          <button 
            onClick={handleRefreshQR}
            disabled={refreshing}
            className="text-gray-400 hover:text-primary transition-colors disabled:opacity-50"
          >
            <RefreshCw size={20} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Scan Line Animation at Top */}
      <div className="h-0.5 bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

      {/* E-ID Content */}
      <div className="max-w-lg mx-auto px-6 py-8">
        {/* Main Card with Golden Corner Brackets */}
        <div className="relative bg-[#0A0A0A] p-1">
          {/* Corner Brackets */}
          <div className="absolute top-0 left-0 w-6 h-6 border-l-2 border-t-2 border-primary" />
          <div className="absolute top-0 right-0 w-6 h-6 border-r-2 border-t-2 border-primary" />
          <div className="absolute bottom-0 left-0 w-6 h-6 border-l-2 border-b-2 border-primary" />
          <div className="absolute bottom-0 right-0 w-6 h-6 border-r-2 border-b-2 border-primary" />

          <div className="border border-[#262626] bg-black p-6">
            {/* Photo Section with Status Badge */}
            <div className="flex justify-center mb-6">
              <div className="relative">
                <div className="w-36 h-36 bg-gray-800 border border-[#262626]">
                  {profile?.photoUrl ? (
                    <img 
                      src={profile.photoUrl} 
                      alt={profile.fullName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-gray-600 text-4xl font-serif">{profile?.fullName?.[0] || '?'}</span>
                    </div>
                  )}
                </div>
                {/* Active Badge */}
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2">
                  <span className="tech-text text-[10px] bg-black border border-green-500 text-green-500 px-3 py-1 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    ACTIVE
                  </span>
                </div>
              </div>
            </div>

            {/* Name and Title */}
            <div className="text-center mb-8">
              <h2 className="text-3xl font-serif mb-2 text-white">{profile?.fullName || 'Unknown'}</h2>
              <p className="text-primary text-sm italic font-serif">
                {team?.domain ? `${team.domain.charAt(0).toUpperCase() + team.domain.slice(1)}` : 'Venture Capital'} / Tier 1
              </p>
            </div>

            {/* QR Code with Golden Border */}
            <div className="flex justify-center mb-8">
              <div 
                className="relative p-1 bg-gradient-to-br from-primary/50 via-primary to-primary/50 cursor-pointer group"
                onClick={() => setShowEnlargedQR(true)}
              >
                <div className="bg-white p-3 relative">
                  {qrDataUrl ? (
                    <>
                      <img src={qrDataUrl} alt="QR Code" className="w-56 h-56" />
                      {/* Tap to enlarge hint */}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <div className="bg-black/70 px-3 py-1.5 rounded flex items-center gap-2">
                          <ZoomIn size={16} className="text-primary" />
                          <span className="text-white text-xs">Tap to enlarge</span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="w-56 h-56 bg-gray-100 flex items-center justify-center">
                      <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
                    </div>
                  )}
                </div>
                {/* Small hint below QR */}
                {qrDataUrl && (
                  <p className="text-center tech-text text-primary/70 text-[10px] mt-1 tracking-wider">
                    TAP TO ENLARGE
                  </p>
                )}
              </div>
            </div>

            {/* Info Section */}
            <div className="space-y-3">
              <div className="flex justify-between items-center border-b border-[#262626] pb-3">
                <span className="tech-text text-gray-500 text-xs">ENTITY_ID</span>
                <span className="tech-text text-white text-sm">{profile?.entityId || 'PENDING'}</span>
              </div>
              <div className="flex justify-between items-center border-b border-[#262626] pb-3">
                <span className="tech-text text-gray-500 text-xs">ACCESS_LEVEL</span>
                <span className="tech-text text-green-500 text-sm">GRANTED</span>
              </div>
              <div className="border-b border-dashed border-[#262626] pb-3">
                <span className="tech-text text-gray-500 text-xs block mb-1">TIMESTAMP</span>
                <span className="tech-text text-primary text-xs">{formattedDate}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <div className="mt-6 text-center">
          <p className="tech-text text-gray-600 text-xs tracking-wider">
            BRIGHTNESS INCREASED FOR SCANNING
          </p>
        </div>
      </div>

      <StudentBottomNav />

      {/* Enlarged QR Modal */}
      {showEnlargedQR && (
        <div 
          className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4"
          onClick={() => setShowEnlargedQR(false)}
        >
          {/* Close button */}
          <button 
            className="absolute top-4 right-4 text-gray-400 hover:text-white p-2"
            onClick={() => setShowEnlargedQR(false)}
          >
            <X size={28} />
          </button>

          {/* Enlarged QR */}
          <div className="flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            {/* Entity ID */}
            <div className="mb-4 text-center">
              <p className="tech-text text-gray-500 text-xs mb-1">ENTITY ID</p>
              <p className="tech-text text-primary text-xl tracking-wider">{profile?.entityId || 'PENDING'}</p>
            </div>

            {/* Large QR with golden border */}
            <div className="p-2 bg-gradient-to-br from-primary/50 via-primary to-primary/50">
              <div className="bg-white p-4">
                {largeQrDataUrl ? (
                  <img 
                    src={largeQrDataUrl} 
                    alt="QR Code Enlarged" 
                    className="w-72 h-72 sm:w-80 sm:h-80"
                  />
                ) : (
                  <div className="w-72 h-72 sm:w-80 sm:h-80 bg-gray-100 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
                  </div>
                )}
              </div>
            </div>

            {/* Name */}
            <div className="mt-4 text-center">
              <p className="text-white text-xl font-serif">{profile?.fullName}</p>
              <p className="tech-text text-gray-500 text-xs mt-1">{team?.name || 'No Team'}</p>
            </div>

            {/* Tap anywhere hint */}
            <p className="mt-6 tech-text text-gray-600 text-xs">TAP ANYWHERE TO CLOSE</p>
          </div>
        </div>
      )}
    </div>
  );
}
