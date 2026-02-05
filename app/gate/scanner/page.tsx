"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Fingerprint, Zap, Check, X, Keyboard, LogOut } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { getOptimizedImageUrl } from '@/lib/utils/imageCompression';

interface ScanRecord {
  id: string;
  participant: any;
  timestamp: string;
  success: boolean;
  error?: string;
}

export default function GateScannerPage() {
  const router = useRouter();
  const qrRegionRef = useRef<HTMLDivElement>(null);
  const qrScannerRef = useRef<Html5Qrcode | null>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(true);
  const [verified, setVerified] = useState(false);
  const [participant, setParticipant] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<string>('');
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [recentScans, setRecentScans] = useState<ScanRecord[]>([]);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);

  useEffect(() => {
    checkAuth();
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!loading && scanning && !verified && !error && !showManualEntry && qrRegionRef.current) {
      setIsCameraReady(true);
      const timer = setTimeout(() => {
        startCamera();
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setIsCameraReady(false);
      stopCamera();
    }
  }, [loading, scanning, verified, error, showManualEntry]);

  const updateTime = () => {
    const now = new Date();
    setCurrentTime(now.toISOString().split('T')[1].split('.')[0] + ' UTC');
  };

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/me');
      if (!response.ok) {
        router.push('/auth/login');
        return;
      }

      const data = await response.json();
      if (data.user?.role !== 'gate_volunteer' && data.user?.role !== 'super_admin') {
        router.push('/dashboard');
        return;
      }

      setUser(data.user);
    } catch (error) {
      console.error('Auth check failed:', error);
      router.push('/auth/login');
    } finally {
      setLoading(false);
    }
  };

  const startCamera = async () => {
    try {
      console.log('Starting camera...');
      setCameraError(null);

      // Camera requires secure context on mobile
      if (typeof window !== 'undefined') {
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        if (window.location.protocol !== 'https:' && !isLocalhost) {
          setCameraError('Camera requires HTTPS. Please use a secure connection.');
          return;
        }
      }
      
      if (!qrRegionRef.current) {
        console.error('QR region not ready');
        return;
      }

      if (!qrScannerRef.current) {
        qrScannerRef.current = new Html5Qrcode('qr-reader', { verbose: false });
      }

      const config = { fps: 10, qrbox: { width: 250, height: 250 } };

      try {
        await qrScannerRef.current.start(
          { facingMode: 'environment' },
          config,
          (decodedText) => {
            if (decodedText) {
              console.log('QR Code detected:', decodedText);
              handleScan(decodedText);
            }
          },
          () => {}
        );
      } catch {
        await qrScannerRef.current.start(
          { facingMode: 'user' },
          config,
          (decodedText) => {
            if (decodedText) {
              console.log('QR Code detected:', decodedText);
              handleScan(decodedText);
            }
          },
          () => {}
        );
      }
      
      console.log('Camera started successfully');
    } catch (err: any) {
      console.error('Camera error:', err);
      setCameraError(err.message || 'Camera access denied. Please enable camera permissions.');
    }
  };

  const stopCamera = () => {
    if (qrScannerRef.current) {
      qrScannerRef.current.stop().catch(() => {});
      try {
        qrScannerRef.current.clear();
      } catch {
        // ignore clear errors
      }
    }
  };

  const handleScan = async (qrData: string) => {
    if (!qrData.trim()) return;

    setScanning(true);
    setVerified(false);
    setError(null);
    setParticipant(null);
    setShowManualEntry(false);

    try {
      const response = await fetch('/api/gate/verify-qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qrToken: qrData.trim(),
          scanType: 'entry',
          location: 'GATE1'
        }),
      });

      const data = await response.json();

      if (response.ok && data.valid) {
        setParticipant(data.participant);
        setVerified(true);
        setScanning(false);
        
        // Add to recent scans
        addToRecentScans({
          id: Date.now().toString(),
          participant: data.participant,
          timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
          success: true,
        });
      } else {
        setError(data.error || 'Verification failed');
        setScanning(false);
        
        // Add failed scan to recent scans
        addToRecentScans({
          id: Date.now().toString(),
          participant: null,
          timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
          success: false,
          error: data.error || 'Invalid Signature',
        });
      }
    } catch (error) {
      console.error('QR scan error:', error);
      setError('Connection error');
      setScanning(false);
      
      addToRecentScans({
        id: Date.now().toString(),
        participant: null,
        timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
        success: false,
        error: 'Connection error',
      });
    }
  };

  const addToRecentScans = (scan: ScanRecord) => {
    setRecentScans(prev => [scan, ...prev].slice(0, 10)); // Keep last 10 scans
  };

  const resetScanner = () => {
    setScanning(true);
    setVerified(false);
    setParticipant(null);
    setError(null);
    setShowManualEntry(false);
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/auth/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-primary">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white pb-safe">
      {/* Header */}
      <div className="border-b border-gray-900 px-4 sm:px-6 py-3 sm:py-4 sticky top-0 bg-black z-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-primary flex items-center justify-center shrink-0">
              <div className="text-black text-xs font-bold">OF</div>
            </div>
            <div className="min-w-0">
              <h1 className="text-white text-sm sm:text-xl font-bold truncate">ONLYFOUNDERS</h1>
              <p className="tech-text text-gray-500 text-xs sm:text-sm hidden sm:block">GATE ACCESS CONTROL</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <span className="tech-text text-white text-xs sm:text-lg hidden sm:inline">| GATE1</span>
            <Zap className="text-primary" size={20} />
            <button
              onClick={handleLogout}
              className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded transition-colors"
              title="Logout"
            >
              <LogOut size={16} className="text-gray-400" />
              <span className="text-gray-400 text-xs sm:text-sm hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-4 sm:px-6 py-4 sm:py-8 max-w-2xl mx-auto">
        {/* Scanning State */}
        {scanning && !verified && !error && (
          <div>
            {/* Scanner Frame */}
            <div className="relative w-full aspect-square sm:aspect-4/3 mb-4 sm:mb-6 bg-black rounded-lg overflow-hidden">
              {/* Camera Video */}
              <div
                id="qr-reader"
                ref={qrRegionRef}
                className="w-full h-full object-cover"
              />
              
              {/* Camera Error Overlay */}
              {cameraError && (
                <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
                  <div className="text-center p-4">
                    <X className="text-red-500 mx-auto mb-2" size={32} />
                    <p className="text-white text-sm mb-2">{cameraError}</p>
                    <p className="text-gray-500 text-xs">Use manual entry below</p>
                  </div>
                </div>
              )}
              
              {/* Corner Brackets */}
              <div className="absolute top-0 left-0 w-20 h-20 sm:w-32 sm:h-32 border-t-4 border-l-4 border-primary pointer-events-none"></div>
              <div className="absolute top-0 right-0 w-20 h-20 sm:w-32 sm:h-32 border-t-4 border-r-4 border-primary pointer-events-none"></div>
              <div className="absolute bottom-0 left-0 w-20 h-20 sm:w-32 sm:h-32 border-b-4 border-l-4 border-primary pointer-events-none"></div>
              <div className="absolute bottom-0 right-0 w-20 h-20 sm:w-32 sm:h-32 border-b-4 border-r-4 border-primary pointer-events-none"></div>
              
              {/* Scanning Line Animation */}
              <div className="absolute top-0 left-0 w-full h-1 bg-primary animate-pulse pointer-events-none"></div>
              
              {/* Center Crosshair */}
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none">
                <div className="w-12 h-12">
                  <div className="absolute w-12 h-0.5 bg-primary/50 top-1/2 left-0"></div>
                  <div className="absolute w-0.5 h-12 bg-primary/50 left-1/2 top-0"></div>
                </div>
              </div>

              {/* Instruction Text */}
              <div className="absolute bottom-4 sm:bottom-8 left-0 right-0 text-center pointer-events-none">
                <p className="text-white text-xs sm:text-sm bg-black/60 px-3 py-1.5 rounded-full inline-block">
                  Align QR code within frame
                </p>
              </div>
            </div>

            {/* Manual Entry Button */}
            <button
              onClick={() => setShowManualEntry(!showManualEntry)}
              className="w-full bg-gray-800/50 hover:bg-gray-700/50 active:bg-gray-600/50 text-white py-3 sm:py-4 rounded-lg flex items-center justify-center gap-2 mb-4 sm:mb-6 transition-colors text-sm sm:text-base"
            >
              <Keyboard size={18} className="sm:w-5 sm:h-5" />
              <span>Enter Code Manually</span>
            </button>

            {/* Manual Input Modal */}
            {showManualEntry && (
              <div className="bg-[#1A1A1A] border border-gray-800 p-4 sm:p-6 mb-4 sm:mb-6 rounded-lg">
                <p className="tech-text text-gray-500 text-xs mb-3">MANUAL QR CODE ENTRY</p>
                <input
                  type="text"
                  placeholder="Paste or type QR token here..."
                  className="w-full bg-black border border-gray-700 text-white p-3 sm:p-4 tech-text text-sm focus:outline-none focus:border-primary rounded"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleScan(e.currentTarget.value);
                      e.currentTarget.value = '';
                    }
                  }}
                />
                <p className="text-xs text-gray-600 mt-2">Press Enter to verify</p>
              </div>
            )}

            {/* Recent Scans */}
            {recentScans.length > 0 && (
              <div className="border-t border-gray-800 pt-4 sm:pt-6 mt-4 sm:mt-0">
                <div className="flex items-center gap-2 mb-3 sm:mb-4">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h3 className="text-white text-base sm:text-lg font-semibold">Recent Scans</h3>
                </div>
                
                <div className="space-y-2 sm:space-y-3">
                  {recentScans.map((scan) => (
                    <div
                      key={scan.id}
                      className={`flex items-center gap-2 sm:gap-4 p-3 sm:p-4 rounded-lg ${
                        scan.success ? 'bg-green-500/5 border border-green-500/20' : 'bg-red-500/5 border border-red-500/20'
                      }`}
                    >
                      {/* Photo/Icon */}
                      <div className="relative shrink-0">
                        {scan.success && scan.participant?.photoUrl ? (
                          <img
                            src={getOptimizedImageUrl(scan.participant.photoUrl, 'thumbnail') || scan.participant.photoUrl}
                            alt={scan.participant.fullName}
                            className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center ${
                            scan.success ? 'bg-gray-700' : 'bg-red-900/30'
                          }`}>
                            {scan.success ? (
                              <span className="text-lg sm:text-xl text-gray-400">
                                {scan.participant?.fullName?.[0]?.toUpperCase() || '?'}
                              </span>
                            ) : (
                              <X className="text-red-500" size={20} />
                            )}
                          </div>
                        )}
                        {/* Success/Error Badge */}
                        <div className={`absolute -bottom-0.5 -right-0.5 sm:-bottom-1 sm:-right-1 w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center ${
                          scan.success ? 'bg-green-500' : 'bg-red-500'
                        }`}>
                          {scan.success ? (
                            <Check className="text-black" size={10} />
                          ) : (
                            <X className="text-white" size={10} />
                          )}
                        </div>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        {scan.success ? (
                          <>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2 mb-1">
                              <p className="font-semibold text-white text-sm sm:text-base truncate">{scan.participant.fullName}</p>
                              <span className="tech-text text-primary text-xs">ACCESS GRANTED</span>
                            </div>
                            <p className="text-xs sm:text-sm text-gray-400 truncate">
                              {scan.participant.role || 'Participant'}
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="font-semibold text-white text-sm sm:text-base">Unknown Ticket</p>
                            <p className="text-xs sm:text-sm text-red-400 truncate">{scan.error}</p>
                          </>
                        )}
                      </div>

                      {/* Timestamp */}
                      <div className="text-gray-500 text-xs sm:text-sm shrink-0 hidden sm:block">
                        {scan.timestamp}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Verified State */}
        {verified && participant && (
          <div>
            {/* Verified Header */}
            <div className="mb-4 sm:mb-8">
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 sm:gap-0 mb-3 sm:mb-4">
                <h2 className="text-4xl sm:text-7xl font-bold italic text-primary">VERIFIED</h2>
                <div className="text-left sm:text-right">
                  <p className="tech-text text-gray-500 text-xs mb-1">TIMESTAMP</p>
                  <p className="tech-text text-white text-xs sm:text-sm">{currentTime}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="tech-text text-green-500 text-sm">ACCESS GRANTED</p>
              </div>
            </div>

            {/* Participant Info */}
            <div className="bg-[#0A0A0A] border border-gray-900 p-4 sm:p-8 mb-4 sm:mb-6 rounded-lg">
              <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 mb-6 sm:mb-8">
                {/* Photo */}
                <div className="shrink-0 mx-auto sm:mx-0">
                  {participant.photoUrl ? (
                    <img
                      src={getOptimizedImageUrl(participant.photoUrl, 'medium') || participant.photoUrl}
                      alt={participant.fullName}
                      className="w-32 h-32 sm:w-40 sm:h-40 object-cover border-2 border-gray-700 rounded"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-32 h-32 sm:w-40 sm:h-40 bg-gray-800 border-2 border-gray-700 rounded flex items-center justify-center">
                      <span className="text-4xl sm:text-5xl text-gray-600">
                        {participant.fullName?.[0]?.toUpperCase() || '?'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Name */}
                <div className="flex-1 text-center sm:text-left">
                  <p className="tech-text text-gray-500 text-xs mb-2">FULL LEGAL NAME</p>
                  <h3 className="text-2xl sm:text-4xl font-bold text-white mb-2 wrap-break-word">
                    {participant.fullName?.toUpperCase() || 'UNKNOWN'}
                  </h3>
                </div>
              </div>

              {/* Team and Cluster */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
                <div>
                  <p className="tech-text text-gray-500 text-xs mb-2">TEAM NAME</p>
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-6 bg-primary"></div>
                    <p className="text-white text-base sm:text-lg truncate">{participant.team?.name || 'No Team'}</p>
                  </div>
                </div>
                <div>
                  <p className="tech-text text-gray-500 text-xs mb-2">CLUSTER</p>
                  <p className="text-gray-400 text-base sm:text-lg truncate">
                    Not Assigned
                  </p>
                </div>
              </div>

              {/* College and Contact */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
                <div>
                  <p className="tech-text text-gray-500 text-xs mb-2">COLLEGE</p>
                  <p className="text-white text-base sm:text-lg truncate">{participant.college?.name || 'Not Specified'}</p>
                </div>
                <div>
                  <p className="tech-text text-gray-500 text-xs mb-2">PHONE</p>
                  <p className="text-white text-base sm:text-lg">{participant.phoneNumber || 'N/A'}</p>
                </div>
              </div>

              {/* Scan History */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
                <div>
                  <p className="tech-text text-gray-500 text-xs mb-2">LAST SCANNED</p>
                  <p className="text-white text-base sm:text-lg">
                    {'First Entry'}
                  </p>
                </div>
                <div>
                  <p className="tech-text text-gray-500 text-xs mb-2">TOTAL SCANS</p>
                  <div className="flex items-center gap-2">
                    <p className="text-primary text-xl sm:text-2xl font-bold">{participant.total_scans || 1}</p>
                    <span className="text-gray-500 text-xs sm:text-sm">entries</span>
                  </div>
                </div>
              </div>

              {/* Entity ID */}
              <div className="border-t border-gray-800 pt-4 sm:pt-6">
                <p className="tech-text text-gray-500 text-xs mb-2">ENTITY ID</p>
                <div className="flex items-center justify-between gap-2">
                  <p className="tech-text text-white text-lg sm:text-2xl tracking-wider truncate">
                    {participant.entityId || 'N/A'}
                  </p>
                  <Fingerprint className="text-gray-600 shrink-0" size={24} />
                </div>
              </div>
            </div>

            {/* Scan Next Button */}
            <button
              onClick={resetScanner}
              className="w-full bg-black border-2 border-primary text-primary py-3 sm:py-4 tech-text text-sm active:bg-primary active:text-black hover:bg-primary hover:text-black transition-colors touch-manipulation"
            >
              [ SCAN NEXT ]
            </button>
          </div>
        )}

        {/* Error State */}
        {error && !scanning && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-red-500/10 border-2 border-red-500 p-8 mb-6">
              <div className="text-center mb-6">
                <h2 className="text-6xl font-bold italic text-red-500 mb-4">DENIED</h2>
                <div className="flex items-center justify-center gap-2">
                  <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <p className="tech-text text-red-500">ACCESS DENIED</p>
                </div>
              </div>
              <div className="text-center">
                <p className="tech-text text-red-400 text-sm mb-2">ERROR</p>
                <p className="text-white">{error}</p>
              </div>
            </div>

            <button
              onClick={resetScanner}
              className="w-full bg-black border-2 border-primary text-primary py-4 tech-text text-sm hover:bg-primary hover:text-black transition-colors"
            >
              [ SCAN AGAIN ]
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
