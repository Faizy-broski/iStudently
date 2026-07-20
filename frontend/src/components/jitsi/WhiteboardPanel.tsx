'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { getWhiteboardSnapshot, saveWhiteboardSnapshot } from '@/lib/api/jitsi'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import '@excalidraw/excalidraw/index.css'

const Excalidraw = dynamic(
  () => import('@excalidraw/excalidraw').then((m) => m.Excalidraw),
  { ssr: false }
)

const PERSIST_DEBOUNCE_MS = 7000

/**
 * Strip appState fields that are per-user local UI state, not shared canvas
 * state, before broadcasting/persisting/replaying:
 * - collaborators must be a Map at runtime (Excalidraw calls .forEach/.get
 *   on it); once it round-trips through JSON it becomes a plain object and
 *   crashes updateScene(). Excalidraw tracks each client's own collaborators
 *   locally, so we never need to sync it.
 * - activeTool carries the current tool selection and the "keep tool active
 *   after drawing" lock toggle — pushing this from one client to another
 *   would fight over (or disable) each participant's own drawing tool.
 */
function sanitizeAppState(appState: any): any {
  if (!appState) return appState
  const { collaborators, activeTool, ...rest } = appState
  return rest
}

interface WhiteboardPanelProps {
  roomId: string
  isOwner: boolean
}

/**
 * Co-editable Excalidraw whiteboard. Every local edit is broadcast live over
 * a Supabase Realtime Broadcast channel; only the room owner debounce-persists
 * the full scene to the backend so refreshes/late joiners can rehydrate.
 */
export function WhiteboardPanel({ roomId, isOwner }: WhiteboardPanelProps) {
  const supabase = useRef(createClient()).current
  const excalidrawApiRef = useRef<ExcalidrawImperativeAPI | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const isApplyingRemote = useRef(false)
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [ready, setReady] = useState(false)

  // Hydrate initial scene from the last persisted snapshot.
  useEffect(() => {
    let cancelled = false
    getWhiteboardSnapshot(roomId).then((res) => {
      if (cancelled || !res.data || !excalidrawApiRef.current) return
      const sceneData = res.data.scene_data as any
      if (sceneData?.elements) {
        isApplyingRemote.current = true
        excalidrawApiRef.current.updateScene({ elements: sceneData.elements, appState: sanitizeAppState(sceneData.appState) })
        isApplyingRemote.current = false
      }
    })
    return () => { cancelled = true }
  }, [roomId, ready])

  // Subscribe to live broadcast deltas from other participants. The same
  // channel instance is reused for sending (see handleChange) — broadcast
  // sends require a joined/subscribed channel.
  useEffect(() => {
    const channel = supabase
      .channel(`whiteboard-${roomId}`)
      .on('broadcast', { event: 'scene-update' }, (payload) => {
        if (!excalidrawApiRef.current) return
        const { elements, appState } = payload.payload as any
        isApplyingRemote.current = true
        excalidrawApiRef.current.updateScene({ elements, appState: sanitizeAppState(appState) })
        isApplyingRemote.current = false
      })
      .subscribe()

    channelRef.current = channel

    return () => {
      channelRef.current = null
      supabase.removeChannel(channel)
    }
  }, [roomId, supabase])

  const persistSnapshot = useCallback((elements: readonly unknown[], appState: unknown) => {
    if (!isOwner) return
    if (persistTimer.current) clearTimeout(persistTimer.current)
    persistTimer.current = setTimeout(() => {
      saveWhiteboardSnapshot(roomId, { elements, appState })
    }, PERSIST_DEBOUNCE_MS)
  }, [isOwner, roomId])

  // Flush a final save on unmount (e.g. owner leaving the room).
  useEffect(() => () => {
    if (persistTimer.current) clearTimeout(persistTimer.current)
  }, [])

  const handleChange = useCallback((elements: readonly unknown[], appState: unknown) => {
    // Guard against the echo loop: updateScene() called from an incoming
    // broadcast also fires onChange, which would otherwise re-broadcast the
    // same remote change back out indefinitely.
    if (isApplyingRemote.current) return

    const cleanAppState = sanitizeAppState(appState)

    channelRef.current?.send({
      type: 'broadcast',
      event: 'scene-update',
      payload: { elements, appState: cleanAppState },
    })

    persistSnapshot(elements, cleanAppState)
  }, [persistSnapshot])

  return (
    <div className="h-full w-full overflow-hidden rounded-lg border">
      <Excalidraw
        excalidrawAPI={(api) => {
          excalidrawApiRef.current = api
          setReady(true)
        }}
        onChange={handleChange as any}
        UIOptions={{ tools: { image: false } }}
      />
    </div>
  )
}
