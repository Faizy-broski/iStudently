'use client'

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useCampus } from '@/context/CampusContext'
import { getSchoolSettings } from '@/lib/api/school-settings'
import type { SchoolSettings } from '@/lib/api/school-settings'

// ─────────────────────────────────────────────────────────────────────────────
// Context type
// ─────────────────────────────────────────────────────────────────────────────

interface SchoolSettingsContextType {
  settings: SchoolSettings | null
  loading: boolean
  /** Returns true when the given plugin id is activated for this school/campus */
  isPluginActive: (pluginId: string) => boolean
  /** Re-fetch settings (call after toggling a plugin) */
  refreshSettings: () => Promise<void>
}

const SchoolSettingsContext = createContext<SchoolSettingsContextType | undefined>(undefined)

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────

export function SchoolSettingsProvider({ children }: { children: React.ReactNode }) {
  const { profile, loading: authLoading } = useAuth()
  const campusContext = useCampus()
  // For non-admin roles, fall back when CampusProvider hasn't resolved selectedCampus yet.
  // Priority: selectedCampus > profile.campus_id (from section) > profile.school_id (last resort).
  const isAdminRole = profile?.role === 'admin' || profile?.role === 'super_admin'
  const campusId =
    campusContext?.selectedCampus?.id ??
    (!isAdminRole ? ((profile as any)?.campus_id ?? profile?.school_id ?? null) : null)
  const [settings, setSettings] = useState<SchoolSettings | null>(null)
  const [loading, setLoading] = useState(true)
  // Track which campusId we last fetched for so we can re-fetch on switch
  const lastFetchedCampusRef = useRef<string | null | undefined>(undefined)

  const fetchSettings = useCallback(async (cId: string | null) => {
    try {
      const result = await getSchoolSettings(cId)
      if (result.success && result.data) {
        setSettings(result.data)
      }
    } catch {
      // Silently fail — sidebar falls back to base items
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (authLoading || !profile) return
    // Re-fetch when campus changes (or on first load)
    if (lastFetchedCampusRef.current === campusId) return
    lastFetchedCampusRef.current = campusId
    setLoading(true)
    void fetchSettings(campusId)
  }, [authLoading, profile, campusId, fetchSettings])

  const refreshSettings = useCallback(async () => {
    setLoading(true)
    lastFetchedCampusRef.current = undefined // force re-fetch
    await fetchSettings(campusId)
  }, [fetchSettings, campusId])

  const isPluginActive = useCallback(
    (pluginId: string): boolean => {
      return settings?.active_plugins?.[pluginId] === true
    },
    [settings]
  )

  return (
    <SchoolSettingsContext.Provider value={{ settings, loading, isPluginActive, refreshSettings }}>
      {children}
    </SchoolSettingsContext.Provider>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useSchoolSettings(): SchoolSettingsContextType {
  const ctx = useContext(SchoolSettingsContext)
  if (!ctx) {
    throw new Error('useSchoolSettings must be used inside <SchoolSettingsProvider>')
  }
  return ctx
}
