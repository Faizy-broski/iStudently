/**
 * Custom Fields Hook with SWR
 * Provides efficient data fetching for custom field definitions and orders
 * Data is cached and won't refetch on every navigation
 */

import { useMemo } from 'react'
import useSWR from 'swr'
import { useAuth } from '@/context/AuthContext'
import { getFieldDefinitions, CustomFieldDefinition, EntityType } from '@/lib/api/custom-fields'
import { getFieldOrders, DefaultFieldOrder } from '@/lib/utils/field-ordering'

// SWR cache configuration - custom fields rarely change
const CUSTOM_FIELDS_SWR_CONFIG = {
  keepPreviousData: true,
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
  dedupingInterval: 120000, // 2 minutes deduplication
  refreshInterval: 0, // Disable auto-refresh
  revalidateIfStale: false,
  errorRetryCount: 2,
}

// Re-export EntityType for convenience
export type { EntityType }

// Fetcher for field definitions
const fetchFieldDefinitions = async (entityType: EntityType): Promise<CustomFieldDefinition[]> => {
  const response = await getFieldDefinitions(entityType)
  return response.success ? response.data ?? [] : []
}

// Fetcher for field orders
const fetchFieldOrders = async (entityType: EntityType): Promise<DefaultFieldOrder[]> => {
  const response = await getFieldOrders(entityType)
  return response.success ? response.data ?? [] : []
}

/**
 * Hook for custom field definitions
 */
export const useFieldDefinitions = (entityType: EntityType) => {
  const { user, loading: authLoading, profile } = useAuth()

  // Only create SWR key when authenticated
  const swrKey = useMemo(() => {
    if (!user || authLoading || !profile) return null
    return ['field-definitions', entityType, profile.school_id]
  }, [user, authLoading, profile, entityType])

  const { data, error, isLoading, mutate } = useSWR(
    swrKey,
    () => fetchFieldDefinitions(entityType),
    CUSTOM_FIELDS_SWR_CONFIG
  )

  return {
    fieldDefinitions: data ?? [],
    loading: authLoading || (isLoading && !data),
    error: error?.message ?? null,
    refresh: mutate,
  }
}

/**
 * Hook for field orders
 */
export const useFieldOrders = (entityType: EntityType) => {
  const { user, loading: authLoading, profile } = useAuth()

  // Only create SWR key when authenticated
  const swrKey = useMemo(() => {
    if (!user || authLoading || !profile) return null
    return ['field-orders', entityType, profile.school_id]
  }, [user, authLoading, profile, entityType])

  const { data, error, isLoading, mutate } = useSWR(
    swrKey,
    () => fetchFieldOrders(entityType),
    CUSTOM_FIELDS_SWR_CONFIG
  )

  return {
    fieldOrders: data ?? [],
    loading: authLoading || (isLoading && !data),
    error: error?.message ?? null,
    refresh: mutate,
  }
}

/**
 * Combined hook for both field definitions and orders
 * Use this when you need both for a form
 */
export const useCustomFields = (entityType: EntityType) => {
  const definitions = useFieldDefinitions(entityType)
  const orders = useFieldOrders(entityType)

  const loading = definitions.loading || orders.loading

  return {
    fieldDefinitions: definitions.fieldDefinitions,
    fieldOrders: orders.fieldOrders,
    loading,
    refreshDefinitions: definitions.refresh,
    refreshOrders: orders.refresh,
    refreshAll: () => {
      definitions.refresh()
      orders.refresh()
    },
  }
}
