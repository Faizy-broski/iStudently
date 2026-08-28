'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Bell, Check } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { listMyNotifications, markNotificationRead, markAllNotificationsRead, type FinaNotification } from '@/lib/api/fina-notifications'

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

export function NotificationsPage() {
  const t = useTranslations('fina.notifications')
  const [items, setItems] = useState<FinaNotification[] | null>(null)

  const load = () => listMyNotifications().then((res) => setItems(res.data ?? []))
  useEffect(() => { load() }, [])

  const handleMarkRead = async (id: string) => {
    await markNotificationRead(id)
    load()
  }

  const unreadCount = items?.filter((n) => !n.read_at).length ?? 0

  return (
    <div className="p-4 sm:p-6 max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">{t('title')}</h1>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={async () => { await markAllNotificationsRead(); load() }}>
            {t('mark_all_read')}
          </Button>
        )}
      </div>

      {items === null ? (
        <Skeleton className="h-24 w-full" />
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-gray-500 flex flex-col items-center gap-2">
            <Bell className="h-6 w-6 text-gray-300" />
            {t('empty')}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map((n) => (
            <Card key={n.id} className={n.read_at ? 'opacity-60' : ''}>
              <CardContent className="py-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-gray-700">{formatBody(t, n)}</p>
                  <p className="text-xs text-gray-400 mt-1">{new Date(n.sent_at).toLocaleString()}</p>
                </div>
                {!n.read_at && (
                  <button onClick={() => handleMarkRead(n.id)} className="text-gray-400 hover:text-[#022172] shrink-0">
                    <Check className="h-4 w-4" />
                  </button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
