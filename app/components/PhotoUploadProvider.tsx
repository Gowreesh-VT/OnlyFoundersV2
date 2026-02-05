"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import PhotoUploadModal from './PhotoUploadModal';

interface UserProfile {
    id: string;
    full_name: string;
    photo_url: string | null;
    role: string;
}

interface PhotoUploadContextType {
    showUploadModal: boolean;
    setShowUploadModal: (show: boolean) => void;
    setProfileFromLogin: (profile: UserProfile) => void;
}

const PhotoUploadContext = createContext<PhotoUploadContextType>({
    showUploadModal: false,
    setShowUploadModal: () => {},
    setProfileFromLogin: () => {},
});

export const usePhotoUpload = () => useContext(PhotoUploadContext);

export default function PhotoUploadProvider({ children }: { children: React.ReactNode }) {
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const hasInitializedRef = useRef(false);

    // Called by login page with profile data - NO API CALLS NEEDED
    const setProfileFromLogin = useCallback((profile: UserProfile) => {
        setUserProfile(profile);
        
        // Show modal immediately if no photo and user is participant/team_lead
        const shouldShowModal = !profile.photo_url && ['participant', 'team_lead'].includes(profile.role);
        setShowUploadModal(shouldShowModal);
        setLoading(false);
        hasInitializedRef.current = true;
    }, []);

    // Only fetch profile on initial load (page refresh) when user is already logged in
    useEffect(() => {
        if (hasInitializedRef.current) return;

        const initializeFromSession = async () => {
            try {
                const response = await fetch('/api/auth/me');
                
                if (!response.ok) {
                    setLoading(false);
                    hasInitializedRef.current = true;
                    return;
                }

                const data = await response.json();
                const user = data.user;

                if (user) {
                    setUserProfile({
                        id: user.id || user._id,
                        full_name: user.fullName || '',
                        photo_url: user.photoUrl || null,
                        role: user.role
                    });
                    const shouldShowModal = !user.photoUrl && ['participant', 'team_lead'].includes(user.role);
                    setShowUploadModal(shouldShowModal);
                }
            } catch (error) {
                console.error('Session init error:', error);
            }
            
            setLoading(false);
            hasInitializedRef.current = true;
        };

        initializeFromSession();
    }, []);

    const handleModalClose = useCallback(() => {
        setShowUploadModal(false);
    }, []);

    return (
        <PhotoUploadContext.Provider value={{ showUploadModal, setShowUploadModal, setProfileFromLogin }}>
            {children}
            
            {!loading && userProfile && (
                <PhotoUploadModal
                    isOpen={showUploadModal}
                    onClose={handleModalClose}
                    userId={userProfile.id}
                    userName={userProfile.full_name}
                />
            )}
        </PhotoUploadContext.Provider>
    );
}
