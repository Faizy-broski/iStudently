'use client'

/**
 * AudioVideoRecorderDialog
 *
 * Mirrors the RosarioSIS TinyMCE Record Audio Video plugin adapted for
 * Studently's Tiptap rich-text editor.
 *
 * Flow (matches RosarioSIS exactly):
 *  1. Click 🎙️ (audio) or 📹 (video) toolbar button → dialog opens
 *  2. Browser asks for microphone / camera permission
 *  3. "Start Recording" → records using the MediaRecorder API (WebRTC, no deps)
 *  4. "Stop Recording" → shows preview player + "Record Again" / "Attach Recording"
 *  5. "Attach Recording as Annotation" → uploads Blob to POST /api/media/upload
 *     → gets public URL → onInsert(url, mimeType) called
 *     → parent inserts <audio> or <video> node in Tiptap
 *
 * Campus-specific: campus_id is forwarded so files are stored under
 *   media-recordings/{campus_school_id}/{uuid}.webm
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Loader2, Mic, Video, RefreshCw, Paperclip, Square } from 'lucide-react'
import { toast } from 'sonner'
import { uploadMediaRecording } from '@/lib/api/media-upload'

// ── Types ─────────────────────────────────────────────────────────────────────

export type RecordingType = 'audio' | 'video'

type Phase =
  | 'idle'        // waiting for permission / initial
  | 'requesting'  // asking getUserMedia
  | 'ready'       // stream acquired, not yet recording
  | 'recording'   // actively recording
  | 'preview'     // recording done, showing preview
  | 'uploading'   // uploading to server

interface AudioVideoRecorderDialogProps {
  open: boolean
  type: RecordingType
  campusId?: string
  onClose: () => void
  /** Called with the public URL and MIME type after successful upload */
  onInsert: (url: string, mimeType: string) => void
}

// ── Time limit (matches RosarioSIS default of 120 s) ─────────────────────────

const TIME_LIMIT_SECONDS = 120

// ── Component ─────────────────────────────────────────────────────────────────

export default function AudioVideoRecorderDialog({
  open,
  type,
  campusId,
  onClose,
  onInsert,
}: AudioVideoRecorderDialogProps) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)

  // Refs — these never cause re-renders
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const blobRef = useRef<Blob | null>(null)
  const mimeTypeRef = useRef<string>('')
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // DOM refs for live preview (video only during recording) and playback
  const liveVideoRef = useRef<HTMLVideoElement>(null)
  const previewRef = useRef<HTMLAudioElement | HTMLVideoElement | null>(null)

  // ── Clean up on close ────────────────────────────────────────────────────

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
  }, [])

  useEffect(() => {
    if (!open) {
      stopStream()
      recorderRef.current = null
      chunksRef.current = []
      blobRef.current = null
      mimeTypeRef.current = ''
      setPhase('idle')
      setErrorMsg(null)
      setElapsed(0)
    }
  }, [open, stopStream])

  // ── Acquire media stream ─────────────────────────────────────────────────

  const acquireStream = useCallback(async () => {
    setPhase('requesting')
    setErrorMsg(null)
    try {
      const constraints: MediaStreamConstraints =
        type === 'audio'
          ? { audio: true }
          : { audio: true, video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream
      setPhase('ready')
    } catch (err: any) {
      const msg =
        err.name === 'NotAllowedError'
          ? 'Permission denied. Please allow microphone/camera access in your browser.'
          : err.name === 'NotFoundError'
          ? 'No microphone/camera found. Please connect a device and try again.'
          : err.name === 'NotReadableError'
          ? 'Your microphone/camera is already in use by another application.'
          : 'Could not access your microphone/camera: ' + (err.message || err.name)
      setErrorMsg(msg)
      setPhase('idle')
    }
  }, [type])

  // Auto-acquire when dialog opens
  useEffect(() => {
    if (open) {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        setErrorMsg('Your browser does not support WebRTC recording. Please use a modern browser over HTTPS.')
        return
      }
      acquireStream()
    }
  }, [open, acquireStream])

  // Show live camera feed during video recording
  useEffect(() => {
    if (phase === 'ready' && type === 'video' && streamRef.current && liveVideoRef.current) {
      liveVideoRef.current.srcObject = streamRef.current
      liveVideoRef.current.play().catch(() => null)
    }
  }, [phase, type])

  // ── Start recording ──────────────────────────────────────────────────────

  const startRecording = useCallback(() => {
    const stream = streamRef.current
    if (!stream) return

    chunksRef.current = []
    blobRef.current = null

    // Pick the best supported MIME type
    const candidates =
      type === 'video'
        ? ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4']
        : ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/ogg']
    const mimeType = candidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? ''
    mimeTypeRef.current = mimeType

    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
    recorderRef.current = recorder

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current || 'application/octet-stream' })
      blobRef.current = blob
      // Create object URL for the preview player
      const url = URL.createObjectURL(blob)
      if (previewRef.current) {
        previewRef.current.src = url
        previewRef.current.load()
      }
      stopStream()
      setPhase('preview')
    }

    recorder.start(1000) // collect data every second
    setPhase('recording')
    setElapsed(0)

    // Countdown timer — auto-stop at TIME_LIMIT_SECONDS
    timerRef.current = setInterval(() => {
      setElapsed((prev) => {
        if (prev + 1 >= TIME_LIMIT_SECONDS) {
          stopRecording()
          return TIME_LIMIT_SECONDS
        }
        return prev + 1
      })
    }, 1000)
  }, [type, stopStream]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Stop recording ───────────────────────────────────────────────────────

  const stopRecording = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    recorderRef.current?.stop()
  }, [])

  // ── Record Again ─────────────────────────────────────────────────────────

  const recordAgain = useCallback(async () => {
    if (previewRef.current?.src) URL.revokeObjectURL(previewRef.current.src)
    blobRef.current = null
    setElapsed(0)
    await acquireStream()
  }, [acquireStream])

  // ── Attach (upload + insert) ─────────────────────────────────────────────

  const attachRecording = useCallback(async () => {
    const blob = blobRef.current
    if (!blob) return

    setPhase('uploading')
    const mime = mimeTypeRef.current || blob.type || (type === 'video' ? 'video/webm' : 'audio/webm')

    const res = await uploadMediaRecording(blob, mime, campusId)

    if (!res.success || !res.data) {
      toast.error(res.error ?? 'Upload failed')
      setPhase('preview')
      return
    }

    onInsert(res.data.url, mime)
    onClose()
    toast.success(`${type === 'audio' ? 'Audio' : 'Video'} annotation attached`)
  }, [type, campusId, onInsert, onClose])

  // ── Format helpers ───────────────────────────────────────────────────────

  const formatTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  const remaining = TIME_LIMIT_SECONDS - elapsed

  // ── Render ───────────────────────────────────────────────────────────────

  const title = type === 'audio' ? 'Insert audio recording' : 'Insert video recording'

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {type === 'audio'
              ? <Mic className="h-5 w-5 text-primary" />
              : <Video className="h-5 w-5 text-primary" />
            }
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">

          {/* ── Error ── */}
          {errorMsg && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {errorMsg}
            </div>
          )}

          {/* ── Insecure connection warning ── */}
          {typeof window !== 'undefined' &&
            window.location.protocol !== 'https:' &&
            window.location.hostname !== 'localhost' && (
            <div className="rounded-md border border-yellow-400/40 bg-yellow-50 dark:bg-yellow-950/30 px-3 py-2 text-sm text-yellow-700 dark:text-yellow-400">
              Insecure connection! Recording requires HTTPS or localhost.
            </div>
          )}

          {/* ── Live camera preview (video mode, ready/recording phases) ── */}
          {type === 'video' && (phase === 'ready' || phase === 'recording') && (
            <video
              ref={liveVideoRef}
              muted
              playsInline
              autoPlay
              className="w-full rounded-md bg-black aspect-video"
            />
          )}

          {/* ── Playback preview (after recording) ── */}
          {phase === 'preview' && (
            type === 'audio' ? (
              <audio
                ref={previewRef as React.RefObject<HTMLAudioElement>}
                controls
                className="w-full"
              />
            ) : (
              <video
                ref={previewRef as React.RefObject<HTMLVideoElement>}
                controls
                className="w-full rounded-md bg-black aspect-video"
              />
            )
          )}

          {/* ── Requesting permission ── */}
          {phase === 'requesting' && (
            <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Requesting {type === 'audio' ? 'microphone' : 'camera'} permission…
            </div>
          )}

          {/* ── Recording timer ── */}
          {phase === 'recording' && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <span className="inline-block h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              Recording — {formatTime(elapsed)} / {formatTime(TIME_LIMIT_SECONDS)}
              {remaining <= 15 && (
                <span className="text-destructive font-medium">({remaining}s left)</span>
              )}
            </div>
          )}

          {/* ── Action buttons ── */}
          <div className="flex flex-col gap-2">
            {/* Start Recording */}
            {(phase === 'ready') && (
              <Button onClick={startRecording} className="w-full" size="lg">
                <span className="inline-block h-2 w-2 rounded-full bg-white mr-2" />
                Start Recording
              </Button>
            )}

            {/* Stop Recording */}
            {phase === 'recording' && (
              <Button onClick={stopRecording} variant="destructive" className="w-full" size="lg">
                <Square className="mr-2 h-4 w-4 fill-current" />
                Stop Recording
              </Button>
            )}

            {/* Preview actions */}
            {phase === 'preview' && (
              <>
                <Button
                  onClick={attachRecording}
                  className="w-full"
                  size="lg"
                >
                  <Paperclip className="mr-2 h-4 w-4" />
                  Attach Recording as Annotation
                </Button>
                <Button
                  onClick={recordAgain}
                  variant="outline"
                  className="w-full"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Record Again
                </Button>
              </>
            )}

            {/* Uploading */}
            {phase === 'uploading' && (
              <Button disabled className="w-full" size="lg">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading…
              </Button>
            )}
          </div>

        </div>
      </DialogContent>
    </Dialog>
  )
}
