/**
 * Billing Hook with SWR
 * Provides efficient data fetching with automatic revalidation and caching
 */

import { useCallback, useMemo } from 'react'
import useSWR from 'swr'
import { billingRecordsApi, billingPlansApi, BillingRecord, BillingPlan } from '@/lib/api/billing'
import { useAuth } from '@/context/AuthContext'

interface BillingData {
  records: BillingRecord[]
  plans: BillingPlan[]
}

// Combined fetcher for billing data
const fetchBillingData = async (): Promise<BillingData> => {
  console.log('💰 Fetching billing data with SWR...')
  
  // Fetch both in parallel
  const [records, plans] = await Promise.all([
    billingRecordsApi.getAll(),
    billingPlansApi.getAll()
  ])
  
  console.log('💰 Billing data fetched:', {
    records: records.length,
    plans: plans.length
  })

  return {
    records,
    plans
  }
}

export const useBilling = () => {
  const { user, loading: authLoading } = useAuth()

  // SWR key - only fetch when authenticated
  const swrKey = user && !authLoading ? ['billing', user.id] : null

  // Use SWR - relies on global config for most settings
  const { data, error, isLoading, isValidating, mutate } = useSWR(
    swrKey,
    fetchBillingData
  )

  // Manual refresh function
  const refreshBilling = useCallback(() => {
    console.log('🔄 Manual billing refresh triggered')
    mutate()
  }, [mutate])

  // Memoized billing data with defaults
  const billingData = useMemo(() => {
    return {
      records: data?.records ?? [],
      plans: data?.plans ?? []
    }
  }, [data])

  // Calculate stats
  const stats = useMemo(() => {
    const records = billingData.records
    return {
      total: records.length,
      paid: records.filter(r => r.payment_status === 'paid').length,
      unpaid: records.filter(r => r.payment_status === 'unpaid').length,
      overdue: records.filter(r => r.payment_status === 'overdue').length,
      pending: records.filter(r => r.payment_status === 'pending').length,
    }
  }, [billingData.records])

  // Loading state - only true on initial load when no data exists
  const loading = authLoading || (isLoading && !data)

  return {
    ...billingData,
    stats,
    loading,
    error: error?.message ?? null,
    refreshBilling,
    mutate,
    isValidating,
  }
}
