import { useCallback } from 'react'
import useSWR from 'swr'
import { dashboardApi, PlatformBranding } from '@/lib/api/dashboard'
import { useAuth } from '@/context/AuthContext'

const DEFAULT_BRANDING: PlatformBranding = {
  logo_shape: 'circle',
  logo_border_width: 0,
  logo_border_color: '#000000',
}

const fetchBranding = async (): Promise<PlatformBranding> => {
  const res = await dashboardApi.getBranding()
  if (res.success && res.data) {
    return { ...DEFAULT_BRANDING, ...(res.data as PlatformBranding) }
  }
  return DEFAULT_BRANDING
}

/**
 * The super admin's own sidebar logo shape/border (platform-wide, not tied
 * to any school). Only fetched for super_admin profiles - every other role
 * renders a school-scoped logo instead (see AppSidebar).
 */
export const usePlatformBranding = () => {
  const { user, profile, loading: authLoading } = useAuth()
  const isSuperAdmin = profile?.role === 'super_admin'
  const swrKey = user && !authLoading && isSuperAdmin ? ['platform-branding', user.id] : null

  const { data, error, isLoading, mutate } = useSWR(swrKey, fetchBranding)

  const branding: PlatformBranding = data ?? DEFAULT_BRANDING

  const updateBranding = useCallback(async (updates: Partial<PlatformBranding>) => {
    const res = await dashboardApi.updateBranding(updates)
    if (res.success) {
      await mutate()
    }
    return res
  }, [mutate])

  return {
    branding,
    updateBranding,
    loading: authLoading || (isSuperAdmin && isLoading && !data),
    error: error?.message ?? null,
    mutate,
  }
}
