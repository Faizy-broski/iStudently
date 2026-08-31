'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, Newspaper, Search, WifiOff, X } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { listWall, type FinaPost } from '@/lib/api/fina-posts'
import { PostCard } from './PostCard'
import { NotificationBell } from './NotificationBell'
import { StoriesBar } from './StoriesBar'

/**
 * The wall (spec §16.2): strictly reverse-chronological, pinned first, no
 * ranking. A "Load more" button rather than true infinite scroll — a
 * pragmatic simplification for this build; the cursor-pagination contract
 * with the backend is identical either way.
 */
export function FinaWall() {
  const t = useTranslations('fina.wall')
  const [posts, setPosts] = useState<FinaPost[] | null>(null)
  const [cursor, setCursor] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [isOffline, setIsOffline] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebouncedValue(searchInput, 400)
  const wentOffline = useRef(false)

  const loadFirstPage = useCallback((q: string) => {
    setPosts(null)
    setCursor(null)
    listWall({ q: q || undefined }).then((res) => {
      setPosts(res.data?.posts ?? [])
      setCursor(res.data?.nextCursor ?? null)
    })
  }, [])

  useEffect(() => { loadFirstPage(debouncedSearch) }, [debouncedSearch, loadFirstPage])

  // AT-12 ("disconnect then reconnect -> clean sync, no duplication") and
  // spec §21's offline copy verbatim. The wall is read-only for every role
  // that renders it (composing happens on separate teacher/admin/media-
  // officer screens), so there's no local write queue to reconcile on
  // reconnect — a full clean refetch (loadFirstPage replaces the array
  // outright, it never appends) is sufficient to guarantee no duplication.
  useEffect(() => {
    const handleOffline = () => { setIsOffline(true); wentOffline.current = true }
    const handleOnline = () => {
      setIsOffline(false)
      if (wentOffline.current) {
        wentOffline.current = false
        loadFirstPage(debouncedSearch)
      }
    }
    setIsOffline(!navigator.onLine)
    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)
    return () => {
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
    }
  }, [loadFirstPage, debouncedSearch])

  const loadMore = async () => {
    if (!cursor) return
    setLoadingMore(true)
    try {
      const res = await listWall({ cursor, q: debouncedSearch || undefined })
      setPosts((prev) => [...(prev ?? []), ...(res.data?.posts ?? [])])
      setCursor(res.data?.nextCursor ?? null)
    } finally {
      setLoadingMore(false)
    }
  }

  return (
    <div className="max-w-2xl p-4 sm:p-6 space-y-3">
      {isOffline && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <WifiOff className="h-4 w-4 shrink-0" />
          {t('offline_banner')}
        </div>
      )}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t('search_placeholder')}
            aria-label={t('search_placeholder')}
            className="ps-10 pe-9"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => setSearchInput('')}
              aria-label={t('clear_search')}
              className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <NotificationBell />
      </div>
      <StoriesBar />
      {posts === null ? (
        <div className="space-y-3">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : posts.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center text-sm text-gray-500 flex flex-col items-center gap-2">
            <Newspaper className="h-6 w-6 text-gray-300" />
            {debouncedSearch ? t('no_search_results') : t('empty_wall')}
          </CardContent>
        </Card>
      ) : (
        <>
          {posts.map((post) => <PostCard key={post.id} post={post} />)}
          {cursor && (
            <div className="flex justify-center pt-2">
              <Button variant="outline" onClick={loadMore} disabled={loadingMore} className="gap-2">
                {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
                {t('load_more')}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
