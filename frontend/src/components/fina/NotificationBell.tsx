'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Bell, Check } from 'lucide-react'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import {
  listMyNotifications, countUnreadNotifications, markNotificationRead, markAllNotificationsRead,
  type FinaNotification,
} from '@/lib/api/fina-notifications'

function formatBody(t: ReturnType<typeof useTranslations>, n: FinaNotification): string {
  switch (n.type) {
    case 'absence':
      return t('body_absence', { name: n.payload?.studentName ?? '', date: n.payload?.date ?? '' })
    case 'new_post':
      return t('body_new_post')
    case 'consent_withdrawn':
      return t('body_consent_withdrawn')
    case 'publish_blocked':
      return t('body_publish_blocked')
    default:
      return t('body_generic')
  }
}

/** Al-Fina' notification bell — spec §14, "the simplest feature in the
 * module and the one that retains guardians". Polls every 30s for a fresh
 * unread count rather than a live push-driven badge, a reasonable
 * simplification at pilot scale. */
export function NotificationBell() {
  const t = useTranslations('fina.notifications')
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const [items, setItems] = useState<FinaNotification[] | null>(null)

  const refreshCount = useCallback(() => {
    countUnreadNotifications().then((res) => setUnread(res.data?.count ?? 0))
  }, [])

  useEffect(() => {
    refreshCount()
    const interval = setInterval(refreshCount, 30000)
    return () => clearInterval(interval)
  }, [refreshCount])

  useEffect(() => {
    if (open) listMyNotifications().then((res) => setItems(res.data ?? []))
  }, [open])

  const handleMarkRead = async (id: string) => {
    await markNotificationRead(id)
    setItems((prev) => prev?.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)) ?? null)
    refreshCount()
  }

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead()
    setItems((prev) => prev?.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })) ?? null)
    setUnread(0)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="relative p-2 rounded-full hover:bg-gray-100">
          <Bell className="h-5 w-5 text-gray-600" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-red-600 text-white text-[10px] font-semibold">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
          <span className="text-sm font-semibold text-gray-900">{t('title')}</span>
          {unread > 0 && (
            <button onClick={handleMarkAllRead} className="text-xs text-[#022172] hover:underline">
              {t('mark_all_read')}
            </button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {items === null ? (
            <div className="p-4 text-center text-sm text-gray-400">{t('loading')}</div>
          ) : items.length === 0 ? (
            <div className="p-4 text-center text-sm text-gray-400">{t('empty')}</div>
          ) : (
            items.map((n) => (
              <button
                key={n.id}
                onClick={() => !n.read_at && handleMarkRead(n.id)}
                className={`w-full text-left px-3 py-2.5 border-b border-gray-50 hover:bg-gray-50 flex items-start gap-2 ${n.read_at ? 'opacity-60' : ''}`}
              >
                <div className="flex-1 text-sm text-gray-700">{formatBody(t, n)}</div>
                {n.read_at ? <Check className="h-3.5 w-3.5 text-gray-300 shrink-0 mt-0.5" /> : <span className="h-2 w-2 rounded-full bg-[#022172] shrink-0 mt-1.5" />}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
