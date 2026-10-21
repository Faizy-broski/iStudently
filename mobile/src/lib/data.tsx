import NetInfo from '@react-native-community/netinfo'
import type { ApiResponse } from '@studently/api-client'
import type { ReactNode } from 'react'
import { AppState } from 'react-native'
import useSWR, { SWRConfig, type Key, type SWRConfiguration } from 'swr'
import useSWRInfinite from 'swr/infinite'

/** Thrown by data hooks when an API envelope is not successful. */
export class ApiError extends Error {
  code?: string
  status?: number
  retryable: boolean
  offline: boolean
  constructor(res: ApiResponse<unknown>) {
    super(res.error || 'Request failed')
    this.code = res.code
    this.status = res.status
    this.retryable = !!res.retryable
    this.offline = res.code === 'NETWORK_ERROR' || res.code === 'TIMEOUT'
  }
}

export function unwrap<T>(res: ApiResponse<T>): T {
  if (!res.success) throw new ApiError(res)
  return res.data as T
}

// One cache for the app. Cleared on sign-out / user change so the next account on a shared device
// never sees the previous user's data (SWR keys don't include the user id).
const cache = new Map()

/** Drops every cached response (call on sign-out and when the signed-in user changes). */
export function clearDataCache() {
  cache.clear()
}

/** SWR revalidation on app foreground and on reconnect (instead of the browser focus/online events). */
export function DataProvider({ children }: { children: ReactNode }) {
  return (
    <SWRConfig
      value={{
        provider: () => cache,
        dedupingInterval: 2000,
        errorRetryCount: 2,
        shouldRetryOnError: (err) => !(err instanceof ApiError) || err.retryable,
        isVisible: () => AppState.currentState === 'active',
        initFocus(callback) {
          let state = AppState.currentState
          const sub = AppState.addEventListener('change', (next) => {
            if (state.match(/inactive|background/) && next === 'active') callback()
            state = next
          })
          return () => sub.remove()
        },
        initReconnect(callback) {
          let online = true
          return NetInfo.addEventListener((s) => {
            const now = !!s.isConnected && s.isInternetReachable !== false
            if (!online && now) callback()
            online = now
          })
        },
      }}>
      {children}
    </SWRConfig>
  )
}

/**
 * `const { data, error, isLoading, mutate } = useApi(['schools'], () => schools.list())`
 * The fetcher receives the key: read ids from it (`([, , id]) => api.get(id)`) when the key
 * depends on other loaded data, instead of from the render's variables, which can be stale when
 * SWR calls the fetcher.
 */
export function useApi<T, K extends Key = Key>(key: K, fetcher: (key: Exclude<K, null | undefined | false>) => Promise<ApiResponse<T>>, config?: SWRConfiguration<T, ApiError>) {
  return useSWR<T, ApiError>(key, async (k: Exclude<K, null | undefined | false>) => unwrap(await fetcher(k)), config)
}

/**
 * Paged lists for endpoints returning `pagination` ({ total, page, limit, totalPages }).
 * `items` is the flattened list; call `loadMore()` from FlatList onEndReached.
 */
export function usePagedApi<T>(
  baseKey: string | null,
  fetchPage: (page: number) => Promise<ApiResponse<T[]>>,
) {
  const swr = useSWRInfinite<ApiResponse<T[]>, ApiError>(
    (index, previous) => {
      if (!baseKey) return null
      if (previous?.pagination && index + 1 > previous.pagination.totalPages) return null
      if (previous && !previous.pagination && (previous.data?.length ?? 0) === 0) return null
      return [baseKey, index + 1]
    },
    async ([, page]: [string, number]) => {
      const res = await fetchPage(page)
      if (!res.success) throw new ApiError(res)
      return res
    },
  )
  const pages = swr.data ?? []
  const last = pages[pages.length - 1]
  const hasMore = last?.pagination ? pages.length < last.pagination.totalPages : false
  return {
    ...swr,
    items: pages.flatMap((p) => p.data ?? []),
    total: last?.pagination?.total,
    hasMore,
    loadMore: () => {
      if (hasMore && !swr.isValidating) swr.setSize(swr.size + 1)
    },
  }
}
