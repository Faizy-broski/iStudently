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
// sessionStorage cache helpers (5-minute TTL, campus-scoped)
// ─────────────────────────────────────────────────────────────────────────────

const SETTINGS_CACHE_KEY = 'studently_settings_cache'
const SETTINGS_CACHE_TTL = 5 * 60 * 1000

function getSettingsCache(campusId: string | null): SchoolSettings | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(SETTINGS_CACHE_KEY)
    if (!raw) return null
    const c = JSON.parse(raw)
    if (c.campusId !== campusId) return null
    if (Date.now() - c.timestamp > SETTINGS_CACHE_TTL) return null
    return c.settings
  } catch { return null }
}

function setSettingsCache(settings: SchoolSettings, campusId: string | null): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify({ settings, campusId, timestamp: Date.now() }))
  } catch { /**/ }
}

function clearSettingsCache(): void {
  if (typeof window === 'undefined') return
  try { sessionStorage.removeItem(SETTINGS_CACHE_KEY) } catch { /**/ }
}

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
  // Synchronously warm state from cache on first render (avoids loading flash)
  const [settings, setSettings] = useState<SchoolSettings | null>(() => {
    const id = typeof window !== 'undefined' ? localStorage.getItem('selectedCampusId') : null
    return getSettingsCache(id)
  })
  const [loading, setLoading] = useState(() => {
    const id = typeof window !== 'undefined' ? localStorage.getItem('selectedCampusId') : null
    return getSettingsCache(id) === null
  })
  // Track which campusId we last fetched for so we can re-fetch on switch
  const lastFetchedCampusRef = useRef<string | null | undefined>(undefined)

  const fetchSettings = useCallback(async (cId: string | null) => {
    try {
      const result = await getSchoolSettings(cId)
      if (result.success && result.data) {
        setSettings(result.data)
        setSettingsCache(result.data, cId)
      }
    } catch {
      // Silently fail — sidebar falls back to base items
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (authLoading || !profile) return
    if (lastFetchedCampusRef.current === campusId) return
    const prev = lastFetchedCampusRef.current
    lastFetchedCampusRef.current = campusId

    // Invalidate cache when user explicitly switches campus
    if (prev !== undefined && prev !== campusId) clearSettingsCache()

    // Cache hit — skip network fetch
    const cached = getSettingsCache(campusId)
    if (cached) {
      setSettings(cached)
      setLoading(false)
      return
    }

    setLoading(true)
    void fetchSettings(campusId)
  }, [authLoading, profile, campusId, fetchSettings])

  const refreshSettings = useCallback(async () => {
    clearSettingsCache()
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
