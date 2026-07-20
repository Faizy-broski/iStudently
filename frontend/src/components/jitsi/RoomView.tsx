'use client'

import { useTranslations } from 'next-intl'
import useSWR from 'swr'
import { useAuth } from '@/context/AuthContext'
import { getRoom } from '@/lib/api/jitsi'
import { JitsiRoomEmbed } from '@/components/jitsi/JitsiRoomEmbed'
import { WhiteboardPanel } from '@/components/jitsi/WhiteboardPanel'
import { PollLauncher } from '@/components/jitsi/PollLauncher'
import { PollResponder } from '@/components/jitsi/PollResponder'
import { RoomHeader } from '@/components/jitsi/RoomHeader'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface RoomViewProps {
  roomId: string
}

/**
 * Shared room-call view used by every role's [roomId] page. Access control
 * (same-school tenant check) is enforced server-side in getRoom(); the only
 * client-side branch here is whether the current profile owns the room
 * (owner gets whiteboard-save + poll-launch controls, everyone else is a
 * plain participant/responder) — matches the backend's assertOwner logic.
 */
export function RoomView({ roomId }: RoomViewProps) {
  const t = useTranslations('live_class')
  const { profile } = useAuth()

  const { data: roomRes, isLoading } = useSWR(
    roomId ? ['jitsi-room', roomId] : null,
    () => getRoom(roomId),
    { revalidateOnFocus: false }
  )

  const room = roomRes?.data
  const isPrivileged = profile?.role === 'admin' || profile?.role === 'super_admin'
  const isOwner = !!room && (isPrivileged || room.owner_profile_id === profile?.id)

  if (isLoading) return <div className="p-6">{t('loading')}</div>
  if (roomRes?.error) return <div className="p-6 text-destructive">{roomRes.error}</div>
  if (!room) return <div className="p-6 text-muted-foreground">{t('room_not_found')}</div>

  return (
    <div className="p-6 space-y-4 h-[calc(100vh-2rem)] flex flex-col">
      <RoomHeader room={room} />

      <Tabs defaultValue="video" className="flex-1 flex flex-col min-h-0">
        <TabsList>
          <TabsTrigger value="video">{t('tab_video')}</TabsTrigger>
          <TabsTrigger value="whiteboard">{t('tab_whiteboard')}</TabsTrigger>
          <TabsTrigger value="polls">{t('tab_polls')}</TabsTrigger>
        </TabsList>
        <TabsContent value="video" className="flex-1 min-h-0">
          <JitsiRoomEmbed
            roomName={room.room_name}
            displayName={`${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || 'User'}
            email={profile?.email || undefined}
            domain={room.jitsi_domain}
            password={room.password}
            startAudioOnly={room.start_audio_only}
            isOwner={isOwner}
          />
        </TabsContent>
        <TabsContent value="whiteboard" className="flex-1 min-h-0">
          <WhiteboardPanel roomId={room.id} isOwner={isOwner} />
        </TabsContent>
        <TabsContent value="polls" className="flex-1 min-h-0 overflow-auto">
          {isOwner ? <PollLauncher roomId={room.id} /> : <PollResponder roomId={room.id} />}
        </TabsContent>
      </Tabs>
    </div>
  )
}
