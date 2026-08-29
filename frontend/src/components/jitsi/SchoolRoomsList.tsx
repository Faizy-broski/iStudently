'use client'

import useSWR from 'swr'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/context/AuthContext'
import { listSchoolRooms } from '@/lib/api/jitsi'
import { RoomCard } from '@/components/jitsi/RoomCard'

interface SchoolRoomsListProps {
  /** e.g. '/student/jitsi-meet' or '/parent/jitsi-meet' — used to build the room join link */
  basePath: string
}

/**
 * Join-only room list for roles with no "My Rooms" of their own (students,
 * parents) — ad-hoc rooms created by a teacher/admin at the same school.
 * Access is already the same-school check every join goes through
 * (jitsi-room.service.ts assertCanAccessRoom); this just makes those rooms
 * discoverable instead of requiring someone to hand a raw room link.
 */
export function SchoolRoomsList({ basePath }: SchoolRoomsListProps) {
  const t = useTranslations('live_class')
  const { profile } = useAuth()

  const { data: roomsRes, isLoading } = useSWR(
    profile ? ['jitsi-school-rooms', profile.id] : null,
    () => listSchoolRooms(),
    { revalidateOnFocus: false, refreshInterval: 15000 }
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
