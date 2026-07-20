'use client'

import useSWR from 'swr'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/context/AuthContext'
import { listMyRooms } from '@/lib/api/jitsi'
import { RoomCard } from '@/components/jitsi/RoomCard'

interface MeetListProps {
  /** e.g. '/teacher/jitsi-meet' or '/admin/jitsi-meet' — used to build the room join link */
  basePath: string
}

export function MeetList({ basePath }: MeetListProps) {
  const t = useTranslations('live_class')
  const { profile } = useAuth()

  const { data: roomsRes, isLoading } = useSWR(
    profile ? ['jitsi-my-rooms', profile.id] : null,
    () => listMyRooms(),
    { revalidateOnFocus: false }
  )

  const rooms = roomsRes?.data || []

  return (
    <div className="p-6 space-y-4 max-w-3xl mx-auto">
      <h1 className="text-xl font-semibold">{t('heading')}</h1>

      {isLoading && <p className="text-sm text-muted-foreground">{t('loading')}</p>}

      {!isLoading && rooms.length === 0 && (
        <p className="text-sm text-muted-foreground">{t('no_rooms_yet')}</p>
      )}

      <div className="space-y-3">
        {rooms.map((r) => (
          <RoomCard key={r.id} room={r} href={`${basePath}/rooms/${r.id}`} />
        ))}
      </div>
    </div>
  )
}
