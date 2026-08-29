'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useRef } from 'react'

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
  /** Called when the participant hangs up via Jitsi's own in-call UI (not just our own Leave button). */
  onReadyToClose?: () => void
}

/**
 * Embeds a Jitsi room (public meet.jit.si by default, or the school's
 * configured self-hosted domain). No JWT — access control is app-side
 * (room_name is only ever handed to authorized callers, see
 * jitsi-room.service.ts). An optional password is applied Jitsi-side by the
 * owner once they join, via the external API's 'password' command.
 */
export function JitsiRoomEmbed({
  roomName, displayName, email, domain, password, startAudioOnly, isOwner, onReadyToClose,
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

  // Tear down the external API's own listeners/session on unmount (e.g.
  // switching to the Whiteboard/Polls tab, or navigating away) — removing
  // the iframe from the DOM alone generally stops media tracks but doesn't
  // clean up the JitsiMeetExternalAPI instance itself.
  useEffect(() => () => {
    apiRef.current?.dispose?.()
  }, [])

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
        // Fires when the participant hangs up via Jitsi's own UI — without
        // this they were previously stranded on Jitsi's default post-call
        // screen inside our tab, with no way back into the app.
        onReadyToClose={onReadyToClose}
        getIFrameRef={(node) => {
          node.style.height = '100%'
          node.style.width = '100%'
        }}
      />
    </div>
  )
}
