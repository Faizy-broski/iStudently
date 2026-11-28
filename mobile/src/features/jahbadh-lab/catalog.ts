import type { ApiResponse } from '@studently/api-client'

import { useApi } from '@/lib/data'
import { env } from '@/lib/env'

import { parseCatalog, type LabCatalog } from './model'

/** Where the lab files live (catalog.json and <code>.html), from EXPO_PUBLIC_LAB_BASE_URL or the API host + /lab. */
export const LAB_BASE = env.labUrl

/** Error code for "the lab folder isn't on this server" (404, or a reply that isn't the catalog). */
export const LAB_NOT_INSTALLED = 'LAB_NOT_INSTALLED'

/** Downloads and validates `${LAB_BASE}/catalog.json`, shaped like an API response so `useApi` can use it. */
export async function fetchLabCatalog(): Promise<ApiResponse<LabCatalog>> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 25_000)
  try {
    const res = await fetch(`${LAB_BASE}/catalog.json`, { signal: ctrl.signal, headers: { Accept: 'application/json' } })
    if (res.status === 404 || res.status === 403) return { success: false, error: 'not_installed', code: LAB_NOT_INSTALLED, status: res.status }
    if (!res.ok) return { success: false, error: `HTTP ${res.status}`, status: res.status, retryable: res.status >= 500 }
    let body: unknown
    try {
      body = await res.json()
    } catch {
      return { success: false, error: 'not_installed', code: LAB_NOT_INSTALLED, status: res.status }
    }
    const catalog = parseCatalog(body)
    if (!catalog || catalog.experiments.length === 0) return { success: false, error: 'not_installed', code: LAB_NOT_INSTALLED, status: res.status }
    return { success: true, data: catalog }
  } catch (e) {
    const timeout = e instanceof Error && e.name === 'AbortError'
    return { success: false, error: timeout ? 'Request timed out' : 'Network request failed', code: timeout ? 'TIMEOUT' : 'NETWORK_ERROR', retryable: true }
  } finally {
    clearTimeout(timer)
  }
}

/** The lab catalog, cached for the session (it only changes when the server's files do). */
export function useLabCatalog() {
  return useApi(['jahbadh-lab', 'catalog', LAB_BASE], () => fetchLabCatalog(), { revalidateOnFocus: false, revalidateIfStale: false, dedupingInterval: 60_000 })
}
