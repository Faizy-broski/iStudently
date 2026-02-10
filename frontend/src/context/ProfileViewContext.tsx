"use client";

import React, { createContext, useContext, useState, useCallback } from 'react';

export interface ViewedProfile {
  id: string;
  name: string;
  type: 'student' | 'teacher' | 'parent' | 'staff';
  backUrl: string;
}

interface ProfileViewContextType {
  viewedProfile: ViewedProfile | null;
  setViewedProfile: (profile: ViewedProfile | null) => void;
  clearViewedProfile: () => void;
}

// Export context for direct access in sidebar
export const ProfileViewContext = createContext<ProfileViewContextType | null>(null);

export function ProfileViewProvider({ children }: { children: React.ReactNode }) {
  const [viewedProfile, setViewedProfile] = useState<ViewedProfile | null>(null);

  const clearViewedProfile = useCallback(() => {
    setViewedProfile(null);
  }, []);

  return (
    <ProfileViewContext.Provider
      value={{
        viewedProfile,
        setViewedProfile,
        clearViewedProfile,
      }}
    >
      {children}
    </ProfileViewContext.Provider>
  );
}

export function useProfileView() {
  const context = useContext(ProfileViewContext);
  // Return a no-op version if not in provider (for safety)
  if (!context) {
    return {
      viewedProfile: null,
      setViewedProfile: () => {},
      clearViewedProfile: () => {},
    };
  }
  return context;
}
