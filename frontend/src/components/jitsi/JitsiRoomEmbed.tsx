'use client'

import dynamic from 'next/dynamic'
import { useCallback, useRef } from 'react'

const JitsiMeeting = dynamic(
  () => import('@jitsi/react-sdk').then((m) => m.JitsiMeeting),
  { ssr: false }
)

interface JitsiRoomEmbedProps {
  roomName: string
  displayName: string
  email?: string
  /** Custom self-hosted domain from school settings; falls back to meet.jit.si */
  domain?: string | null
  password?: string | null
  startAudioOnly?: boolean
  /** Only the room owner locks the room with the configured password on join. */
  isOwner: boolean
}

/**
 * Embeds a Jitsi room (public meet.jit.si by default, or the school's
 * configured self-hosted domain). No JWT — access control is app-side
 * (room_name is only ever handed to authorized callers, see
 * jitsi-room.service.ts). An optional password is applied Jitsi-side by the
 * owner once they join, via the external API's 'password' command.
 */
export function JitsiRoomEmbed({
  roomName, displayName, email, domain, password, startAudioOnly, isOwner,
}: JitsiRoomEmbedProps) {
  const apiRef = useRef<any>(null)

  const handleApiReady = useCallback((api: any) => {
    apiRef.current = api
    if (isOwner && password) {
      api.on('videoConferenceJoined', () => {
        api.executeCommand('password', password)
      })
    }
  }, [isOwner, password])

  return (
    <div className="h-full w-full overflow-hidden rounded-lg border">
      <JitsiMeeting
        domain={domain || 'meet.jit.si'}
        roomName={roomName}
        userInfo={{ displayName, email: email || '' }}
        configOverwrite={{
          startWithAudioMuted: true,
          startWithVideoMuted: false,
          startAudioOnly: !!startAudioOnly,
          prejoinPageEnabled: false,
          disableDeepLinking: true,
        }}
        interfaceConfigOverwrite={{
          TOOLBAR_ALWAYS_VISIBLE: true,
        }}
        onApiReady={handleApiReady}
        getIFrameRef={(node) => {
          node.style.height = '100%'
          node.style.width = '100%'
        }}
      />
    </div>
  )
}
