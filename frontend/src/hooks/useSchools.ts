/**
 * Schools Hook with SWR
 * Provides efficient data fetching with automatic revalidation and caching
 */

import { useCallback, useMemo } from 'react'
import useSWR from 'swr'
import { schoolApi } from '@/lib/api/schools'
import { useAuth } from '@/context/AuthContext'

export interface School {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  // Merged in from school_settings by the backend — see logo-appearance.service.ts
  logo_shape?: 'circle' | 'rounded' | 'square' | 'rectangle';
  logo_border_width?: number;
  logo_border_color?: string;
  website: string | null;
  contact_email: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  phone: string | null;
  principal_name: string | null;
  short_name: string | null;
  school_number: string | null;
  parent_school_id: string | null;
  status: "active" | "suspended";
  is_trial: boolean;
  trial_ends_at: string | null;
  created_at: string;
  updated_at: string;
}

// Fetcher for schools data
const fetchSchools = async (): Promise<School[]> => {
  console.log('🏫 Fetching schools with SWR...')

  const response = await schoolApi.getAll()

  if (response.success && response.data) {
    const schools = response.data as School[]
    console.log('🏫 Schools fetched:', schools.length)
    return schools
  }

  throw new Error(response.error || 'Failed to fetch schools')
}

export const useSchools = () => {
  const { user, loading: authLoading } = useAuth()

  // SWR key - only fetch when authenticated
  const swrKey = user && !authLoading ? ['schools', user.id] : null

  // Use SWR - relies on global config for most settings
  const { data, error, isLoading, isValidating, mutate } = useSWR(
    swrKey,
    fetchSchools
  )

  // Manual refresh function
  const refreshSchools = useCallback(() => {
    console.log('🔄 Manual schools refresh triggered')
    mutate()
  }, [mutate])

  // Memoized schools data with defaults
  const schools = useMemo(() => {
    return data ?? []
  }, [data])

  // Calculate stats (root schools only, excluding campuses)
  const rootSchools = useMemo(() => schools.filter(s => !s.parent_school_id), [schools])

  const stats = useMemo(() => ({
    total: rootSchools.length,
    active: rootSchools.filter(s => s.status === 'active').length,
    suspended: rootSchools.filter(s => s.status === 'suspended').length,
  }), [rootSchools])

  // Loading state - only true on initial load when no data exists
  const loading = authLoading || (isLoading && !data)

  return {
    schools,
    stats,
    loading,
    error: error?.message ?? null,
    refreshSchools,
    mutate,
    isValidating,
  }
}
