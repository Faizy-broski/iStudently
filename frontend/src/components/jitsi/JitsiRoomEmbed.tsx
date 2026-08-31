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
 * Returns a valid Jitsi domain to embed against.
 *
 * The value stored in school_settings.jitsi_domain may be a placeholder
 * (e.g. "test", an empty string, or a hostname with no TLD) entered by an
 * admin who hasn't set up a self-hosted server yet.  Passing such a value
 * to the @jitsi/react-sdk causes it to try loading
 *   https://test/external_api.js
 * which fails — and because the SDK caches the resulting Promise as a module-
 * level singleton, every subsequent attempt on the page also fails even after
 * the domain is corrected.
 *
 * We treat a domain as valid only when it contains at least one dot AND each
 * segment is non-empty.  Anything else falls back to the public meet.jit.si.
 */
function resolveDomain(domain?: string | null): string {
  // meet.jit.si now requires an authenticated moderator before anyone can join —
  // the old "first joiner becomes moderator" behaviour was removed.
  // app.8x8.vc is the official Jitsi-hosted public instance that still allows
  // direct anonymous join without a moderator login prompt.
  const FALLBACK = 'meet.jit.si'
  if (!domain) return FALLBACK
  const trimmed = domain.trim()
  // Must have at least one dot and no empty segments (e.g. "test" → invalid,
  // ".example.com" → invalid, "jitsi.example.com" → valid).
  if (!trimmed.includes('.')) return FALLBACK
  if (trimmed.split('.').some((seg) => seg.length === 0)) return FALLBACK
  return trimmed
}

/**
 * The @jitsi/react-sdk caches the external_api.js script Promise as a module-
 * level singleton (see init.js: `let scriptPromise`).  If a previous page load
 * tried to load the script from an invalid domain (e.g. "test") and the
 * Promise rejected, the cached rejected Promise is returned on every subsequent
 * call — even after a navigation that would now use meet.jit.si.
 *
 * Resetting the singleton on mount lets the SDK retry cleanly.  We reach into
 * the module internals deliberately; this is safe because the SDK is a thin
 * wrapper and the variable name has been stable across all published versions.
 */
async function resetJitsiScriptCache() {
  try {
    const mod = await import('@jitsi/react-sdk/lib/init' as any)
    if ('scriptPromise' in mod) {
      // The export is a `let` binding re-exported — reset via the module object.
      ;(mod as any).scriptPromise = undefined
    }
  } catch {
    // Non-fatal: worst case the singleton stays stale and we see the same error.
  }
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
  const resolvedDomain = resolveDomain(domain)

  // On mount, clear any stale cached script-load promise from a previous
  // failed attempt (e.g. a bad custom domain stored in school_settings).
  useEffect(() => {
    resetJitsiScriptCache()
  }, [])

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
        domain={resolvedDomain}
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

