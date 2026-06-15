import { useCallback, useMemo } from 'react'
import useSWR from 'swr'
import { dashboardApi } from '@/lib/api/dashboard'
import { useAuth } from '@/context/AuthContext'

export interface PlatformSettings {
  currency: string
  support_email: string
  max_schools: number
}

const DEFAULT_SETTINGS: PlatformSettings = {
  currency: 'USD',
  support_email: 'support@studently.com',
  max_schools: 1000,
}

const fetchPlatformSettings = async (): Promise<PlatformSettings> => {
  const res = await dashboardApi.getPlatformSettings()
  if (res.success && res.data) {
    return { ...DEFAULT_SETTINGS, ...(res.data as PlatformSettings) }
  }
  return DEFAULT_SETTINGS
}

export const usePlatformSettings = () => {
  const { user, loading: authLoading } = useAuth()
  const swrKey = user && !authLoading ? ['platform-settings', user.id] : null

  const { data, error, isLoading, mutate } = useSWR(swrKey, fetchPlatformSettings)

  const settings: PlatformSettings = data ?? DEFAULT_SETTINGS

  const currencySymbol = settings.currency

  const formatCurrency = useCallback((amount: number): string => {
    const code = settings.currency
    if (amount >= 1_000_000) return `${code} ${(amount / 1_000_000).toFixed(1)}M`
    if (amount >= 1_000) return `${code} ${(amount / 1_000).toFixed(0)}K`
    return `${code} ${amount}`
  }, [settings.currency])

  const updateSettings = useCallback(async (updates: Partial<PlatformSettings>) => {
    const res = await dashboardApi.updatePlatformSettings(updates)
    if (res.success) {
      await mutate()
    }
    return res
  }, [mutate])

  return {
    settings,
    currencySymbol,
    formatCurrency,
    updateSettings,
    loading: authLoading || (isLoading && !data),
    error: error?.message ?? null,
    mutate,
  }
}
