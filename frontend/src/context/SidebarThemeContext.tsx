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

      // For all other roles: try campus config first, fall back to school/default
      const campusId = selectedCampus?.id ?? null
      if (campusId) {
        const campusResult = await getCampusSidebarConfig(campusId)
        if (campusResult.success && campusResult.data) {
          setConfig(campusResult.data)
          return
        }
      }

      // No campus config — fall back to the school-wide config directly.
      // Using getSchoolSidebarConfig(schoolId) instead of getMySidebarConfig() avoids
      // a bug where the backend resolves the campus from the user's *profile* (not the
      // currently selected campus in the UI), which could return a different campus's
      // theme when the selected campus has no custom config.
      const schoolId = profile.school_id
      if (schoolId) {
        const result = await getSchoolSidebarConfig(schoolId)
        if (result.success) setConfig(result.data ?? null)
      } else {
        const result = await getMySidebarConfig()
        if (result.success) setConfig(result.data ?? null)
      }
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
    const cached = readCache(configCacheKey(profile.id, campusId))
    if (cached !== null) setConfigState(cached)
  }, [profile?.id, selectedCampus?.id])

  useEffect(() => {
    if (authLoading || !profile) return
    fetchConfig()
  }, [authLoading, profile, fetchConfig])

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
