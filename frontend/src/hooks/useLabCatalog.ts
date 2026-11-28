'use client'

import useSWR from 'swr'
import { fetchLabCatalog, LabNotInstalledError } from '@/lib/jahbadh-lab'

/** The lab catalog (~450 KB), fetched once per session; the server answers 304 on revalidation. */
export function useLabCatalog() {
  const { data, error, isLoading, mutate } = useSWR('jahbadh-lab-catalog', fetchLabCatalog, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
    dedupingInterval: 5 * 60 * 1000,
  })
  return {
    catalog: data ?? null,
    isLoading,
    notInstalled: error instanceof LabNotInstalledError,
    error: error && !(error instanceof LabNotInstalledError) ? (error as Error) : null,
    retry: () => mutate(),
  }
}
