'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Lock, Mic } from 'lucide-react'
import type { JitsiRoom } from '@/lib/api/jitsi'

interface RoomCardProps {
  room: JitsiRoom
  href: string
  onEdit?: () => void
  onDelete?: () => void
}

export function RoomCard({ room, href, onEdit, onDelete }: RoomCardProps) {
  const t = useTranslations('live_class')

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            {room.title || t('default_title')}
            {room.password && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
            {room.start_audio_only && <Mic className="h-3.5 w-3.5 text-muted-foreground" />}
          </CardTitle>
          {room.description && <p className="text-xs text-muted-foreground mt-0.5">{room.description}</p>}
        </div>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-2">
        <div className="flex gap-2">
          {onEdit && <Button size="sm" variant="outline" onClick={onEdit}>{t('edit')}</Button>}
          {onDelete && <Button size="sm" variant="outline" onClick={onDelete}>{t('delete')}</Button>}
        </div>
        <Button size="sm" asChild>
          <Link href={href}>{t('join')}</Link>
        </Button>
      </CardContent>
    </Card>
  )
}
