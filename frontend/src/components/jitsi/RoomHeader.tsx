'use client'

import { useTranslations } from 'next-intl'
import { Loader2, LogOut, StopCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { JitsiRoom } from '@/lib/api/jitsi'

interface RoomHeaderProps {
  room: JitsiRoom
  onLeave: () => void
  /** Only passed for the owning teacher/admin of a course-bound (online_class_id set) room. */
  onEndSession?: () => void
  ending?: boolean
}

export function RoomHeader({ room, onLeave, onEndSession, ending }: RoomHeaderProps) {
  const t = useTranslations('live_class')

  return (
    <div className="border-b pb-3 flex items-start justify-between gap-3">
      <div>
        <h1 className="text-lg font-semibold">{room.title || t('default_title')}</h1>
        {room.description && <p className="text-sm text-muted-foreground">{room.description}</p>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {onEndSession && (
          <Button size="sm" variant="destructive" className="gap-1.5" disabled={ending} onClick={onEndSession}>
            {ending ? <Loader2 className="h-4 w-4 animate-spin" /> : <StopCircle className="h-4 w-4" />}
            {t('end_session')}
          </Button>
        )}
        <Button size="sm" variant="outline" className="gap-1.5" onClick={onLeave}>
          <LogOut className="h-4 w-4" /> {t('leave')}
        </Button>
      </div>
    </div>
  )
}
