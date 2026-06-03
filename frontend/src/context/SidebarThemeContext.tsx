'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react'
import { useAuth } from '@/context/AuthContext'
import {
  getMySidebarConfig,
  getSuperadminSidebarConfig,
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

export function SidebarThemeProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const { profile, loading: authLoading } = useAuth()
  const [config, setConfig] = useState<SidebarConfig | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchConfig = useCallback(async () => {
    if (!profile) return
    try {
      setLoading(true)
      const result =
        profile.role === 'super_admin'
          ? await getSuperadminSidebarConfig()
          : await getMySidebarConfig()
      if (result.success) {
        setConfig(result.data ?? null)
      }
    } catch {
      // Silent fail — sidebar falls back to default gradient
    } finally {
      setLoading(false)
    }
  }, [profile])

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
