'use client'

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useAuth } from './AuthContext'
import { getMyPermissions, ProfilePermission } from '@/lib/api/user-profiles'

const CACHE_KEY = 'studently_permissions_cache'
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

interface CachedPermissions {
  userId: string
  permissions: ProfilePermission[] | null
  ts: number
}

interface PermissionsContextType {
  permissions: ProfilePermission[] | null
  canUse: (href: string) => boolean
  canEdit: (href: string) => boolean
  loading: boolean
  refresh: () => Promise<void>
  clearCache: () => void
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined)

function readCache(userId: string): ProfilePermission[] | null | undefined {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    if (!raw) return undefined
    const parsed: CachedPermissions = JSON.parse(raw)
    if (parsed.userId !== userId) return undefined
    if (Date.now() - parsed.ts > CACHE_TTL_MS) return undefined
    return parsed.permissions
  } catch {
    return undefined
  }
}

function writeCache(userId: string, permissions: ProfilePermission[] | null) {
  try {
    const entry: CachedPermissions = { userId, permissions, ts: Date.now() }
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(entry))
  } catch {}
}

export function clearPermissionsCache() {
  try {
    sessionStorage.removeItem(CACHE_KEY)
  } catch {}
}

export function PermissionsProvider({ children }: { children: React.ReactNode }) {
  const { profile, loading: authLoading } = useAuth()
  const [permissions, setPermissions] = useState<ProfilePermission[] | null>(null)
  const [loading, setLoading] = useState(true)
  const fetchedForRef = useRef<string | null>(null)

  const fetchPermissions = useCallback(async (userId: string) => {
    const cached = readCache(userId)
    if (cached !== undefined) {
      setPermissions(cached)
      setLoading(false)
      return
    }

    try {
      const data = await getMyPermissions()
      setPermissions(data)
      writeCache(userId, data)
    } catch {
      setPermissions(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (authLoading) return
    if (!profile) {
      setPermissions(null)
      setLoading(false)
      fetchedForRef.current = null
      return
    }
    if (fetchedForRef.current === profile.id) return
    fetchedForRef.current = profile.id
    void fetchPermissions(profile.id)
  }, [authLoading, profile, fetchPermissions])

  const refresh = useCallback(async () => {
    if (!profile) return
    clearPermissionsCache()
    fetchedForRef.current = null
    await fetchPermissions(profile.id)
    fetchedForRef.current = profile.id
  }, [profile, fetchPermissions])

  const clearCache = useCallback(() => {
    clearPermissionsCache()
    fetchedForRef.current = null
  }, [])

  const canUse = useCallback(
    (href: string): boolean => {
      // null = no profile assigned → full access
      if (permissions === null) return true
      return permissions.some((p) => p.module_key === href && p.can_use)
    },
    [permissions]
  )

  const canEdit = useCallback(
    (href: string): boolean => {
      if (permissions === null) return true
      return permissions.some((p) => p.module_key === href && p.can_edit)
    },
    [permissions]
  )

  return (
    <PermissionsContext.Provider value={{ permissions, canUse, canEdit, loading, refresh, clearCache }}>
      {children}
    </PermissionsContext.Provider>
  )
}

export function usePermissions(): PermissionsContextType {
  const ctx = useContext(PermissionsContext)
  if (!ctx) throw new Error('usePermissions must be used inside PermissionsProvider')
  return ctx
}
