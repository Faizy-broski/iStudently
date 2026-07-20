'use client'

import { useTranslations } from 'next-intl'
import type { JitsiRoom } from '@/lib/api/jitsi'

interface RoomHeaderProps {
  room: JitsiRoom
}

export function RoomHeader({ room }: RoomHeaderProps) {
  const t = useTranslations('live_class')

  return (
    <div className="border-b pb-3">
      <h1 className="text-lg font-semibold">{room.title || t('default_title')}</h1>
      {room.description && <p className="text-sm text-muted-foreground">{room.description}</p>}
    </div>
  )
}
