'use client'

import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
  useCallback,
} from 'react'
import { useAuth } from '@/context/AuthContext'
import { useCampus } from '@/context/CampusContext'
import {
  getMySidebarConfig,
  getSuperadminSidebarConfig,
  getCampusSidebarConfig,
  getSchoolSidebarConfig,
  type SidebarConfig,
} from '@/lib/api/sidebar-config'

interface SidebarThemeContextType {
  config: SidebarConfig | null
  loading: boolean
  refresh: () => Promise<void>
  setConfig: (config: SidebarConfig | null) => void
}

const SidebarThemeContext = createContext<SidebarThemeContextType | undefined>(
  undefined
)

const LAST_USER_KEY = 'sidebar_last_user'
const LAST_CAMPUS_KEY = 'sidebar_last_campus'

function configCacheKey(userId: string, campusId: string | null) {
  return `sidebar_config:${userId}:${campusId ?? 'none'}`
}

function readCache(key: string): SidebarConfig | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as SidebarConfig) : null
  } catch {
    return null
  }
}

function writeCache(key: string, cfg: SidebarConfig | null) {
  try {
    if (cfg) localStorage.setItem(key, JSON.stringify(cfg))
    else localStorage.removeItem(key)
  } catch {}
}

// Read the last-session config synchronously so the very first render already
// has the correct theme — eliminates the default-gradient flash on repeat visits.
function readCachedConfigSync(): SidebarConfig | null {
  if (typeof window === 'undefined') return null
  try {
    const userId = localStorage.getItem(LAST_USER_KEY)
    const campusId = localStorage.getItem(LAST_CAMPUS_KEY) || null
    if (!userId) return null
    return readCache(configCacheKey(userId, campusId))
  } catch {
    return null
  }
}

export function SidebarThemeProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const { profile, loading: authLoading } = useAuth()
  const campusCtx = useCampus()
  const selectedCampus = campusCtx?.selectedCampus ?? null

  // Initialised synchronously from localStorage — no flash on repeat visits.
  const [config, setConfigState] = useState<SidebarConfig | null>(readCachedConfigSync)
  const [loading, setLoading] = useState(true)

  const setConfig = useCallback((cfg: SidebarConfig | null) => {
    setConfigState(cfg)
    if (profile) {
      writeCache(configCacheKey(profile.id, selectedCampus?.id ?? null), cfg)
      // Campus-agnostic "last known good" entry for this exact account — lets
      // the useLayoutEffect below show a real (if possibly stale) color on
      // cold start instead of the default gradient, before campus resolves.
      if (cfg) writeCache(`sidebar_config:${profile.id}:last`, cfg)
    }
  }, [profile?.id, selectedCampus?.id])

  const fetchConfig = useCallback(async () => {
    if (!profile) return
    try {
      setLoading(true)

      // Persist user/campus pointer so next session can read the cache key.
      try {
        localStorage.setItem(LAST_USER_KEY, profile.id)
        localStorage.setItem(LAST_CAMPUS_KEY, selectedCampus?.id ?? '')
      } catch {}

      if (profile.role === 'super_admin') {
        // When impersonating a school, load that school's theme instead of the superadmin's own theme
        const impersonatedSchoolId =
          typeof window !== 'undefined'
            ? sessionStorage.getItem('impersonatedSchoolId')
            : null

        if (impersonatedSchoolId) {
          const result = await getSchoolSidebarConfig(impersonatedSchoolId)
          if (result.success) setConfig(result.data ?? null)
        } else {
          const result = await getSuperadminSidebarConfig()
          if (result.success) setConfig(result.data ?? null)
        }
        return
      }

      // For all other roles: campus config wins if it has a custom theme,
      // else the main school-wide theme, else personal fallback. The campus
      // and school lookups don't depend on each other's result (schoolId is
      // already known from `profile`/`selectedCampus`), so fire them together
      // instead of awaiting one before starting the next.
      const campusId = selectedCampus?.id ?? profile.campus_id ?? null
      const schoolId = profile.school_id ?? selectedCampus?.school_id ?? null

      const [campusResult, schoolResult] = await Promise.allSettled([
        campusId ? getCampusSidebarConfig(campusId) : Promise.resolve(null),
        schoolId ? getSchoolSidebarConfig(schoolId) : Promise.resolve(null),
      ])

      const campusData =
        campusResult.status === 'fulfilled' && campusResult.value?.success && campusResult.value.data &&
        (campusResult.value.data.bg_color || campusResult.value.data.bg_image_url)
          ? campusResult.value.data
          : null
      if (campusData) { setConfig(campusData); return }

      const schoolData =
        schoolResult.status === 'fulfilled' && schoolResult.value?.success && schoolResult.value.data &&
        (schoolResult.value.data.bg_color || schoolResult.value.data.bg_image_url)
          ? schoolResult.value.data
          : null
      if (schoolData) { setConfig(schoolData); return }

      // Neither campus nor school has a custom theme — fall back to getMySidebarConfig()
      const result = await getMySidebarConfig()
      if (result.success) setConfig(result.data ?? null)
    } catch {
      // Silent fail — sidebar keeps cached/default gradient
    } finally {
      setLoading(false)
    }
  }, [profile, selectedCampus?.id, setConfig])

  // Apply the cached config for the current campus synchronously before the
  // browser paints — eliminates the ~1 s flash when switching campuses.
  useLayoutEffect(() => {
    if (!profile?.id) return
    const campusId = selectedCampus?.id ?? null
    // Exact per-campus match first; if that's not cached yet (e.g. campus
    // hasn't resolved on cold start), fall back to this account's last-known
    // color rather than nulling out to the default gradient. Both lookups are
    // keyed strictly off the live profile.id (never off the LAST_USER/
    // LAST_CAMPUS pointers used by readCachedConfigSync), so a genuine
    // account switch still correctly falls through to null below — no
    // cross-account theme leak.
    const cached = readCache(configCacheKey(profile.id, campusId))
      ?? readCache(`sidebar_config:${profile.id}:last`)
    setConfigState(cached)
  }, [profile?.id, selectedCampus?.id])

  useEffect(() => {
    if (authLoading || !profile) return
    // Wait for CampusContext to finish resolving selectedCampus before firing
    // the fetch, so it runs once with the final campusId instead of once with
    // null and again after campus resolves (which produced a second visible
    // color swap). Superadmin's own theme never depends on campus, so don't
    // make that role wait unnecessarily.
    if (campusCtx?.loading && profile.role !== 'super_admin') return
    fetchConfig()
  }, [authLoading, profile, campusCtx?.loading, fetchConfig])

  const refresh = useCallback(async () => {
    await fetchConfig()
  }, [fetchConfig])

  return (
    <SidebarThemeContext.Provider value={{ config, loading, refresh, setConfig }}>
      {children}
    </SidebarThemeContext.Provider>
  )
}

export function useSidebarTheme(): SidebarThemeContextType {
  const ctx = useContext(SidebarThemeContext)
  if (!ctx) {
    throw new Error('useSidebarTheme must be used inside <SidebarThemeProvider>')
  }
  return ctx
}
