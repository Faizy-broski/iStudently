'use client'

import React, { useState, useRef, useCallback, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { getAuthToken } from '@/lib/api/schools'
import { uploadMediaRecording } from '@/lib/api/media-upload'
import {
  createReadingLog,
  attachReadingLogAudio,
  getMyReadingLogs,
  type ReadingLog,
} from '@/lib/api/reading-logs'
import { API_URL } from '@/config/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
  BookOpen, Mic, Square, RefreshCw, CheckCircle, Loader2,
  Clock, Calendar, FileText, ChevronDown, ChevronUp
} from 'lucide-react'
import { format, parseISO, differenceInDays } from 'date-fns'

// ── Audio recorder state ──────────────────────────────────────────────────────
type RecorderPhase = 'idle' | 'requesting' | 'ready' | 'recording' | 'preview'

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0')
  const s = (seconds % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

// ── Log history card ──────────────────────────────────────────────────────────
function LogCard({ log }: { log: ReadingLog }) {
  const [expanded, setExpanded] = useState(false)
  const ageInDays = differenceInDays(new Date(), parseISO(log.created_at))
  const audioExpired = ageInDays > 14
  const hasAudio = !!log.audio_url && !audioExpired

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-primary/10 shrink-0 mt-0.5">
            <BookOpen className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm leading-tight">{log.book_title}</p>
            {log.book_author && (
              <p className="text-xs text-muted-foreground">{log.book_author}</p>
            )}
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {format(parseISO(log.session_date), 'MMM d, yyyy')}
              </span>
              {log.pages_read != null && (
                <span className="flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  {log.pages_read} pages
                </span>
              )}
              {hasAudio && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-green-500 text-green-600">
                  🎙 Audio
                </Badge>
              )}
              {log.audio_file_path && audioExpired && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
                  Audio Expired
                </Badge>
              )}
            </div>

            {log.notes && (
              <button
                onClick={() => setExpanded(v => !v)}
                className="mt-2 flex items-center gap-1 text-xs text-primary hover:underline"
              >
                {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                {expanded ? 'Hide notes' : 'Show notes'}
              </button>
            )}
            {expanded && log.notes && (
              <p className="mt-1.5 text-xs text-muted-foreground whitespace-pre-wrap">{log.notes}</p>
            )}

            {hasAudio && log.audio_url && (
              <audio controls src={log.audio_url} className="mt-2 w-full h-8" />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function StudentReadingPage() {
  const { user, activeCampusId } = useAuth() as any

  // Form fields
  const [bookTitle, setBookTitle] = useState('')
  const [bookAuthor, setBookAuthor] = useState('')
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split('T')[0])
  const [pagesRead, setPagesRead] = useState('')
  const [notes, setNotes] = useState('')

  // Submission state
  const [submitting, setSubmitting] = useState(false)

  // History
  const [logs, setLogs] = useState<ReadingLog[]>([])
  const [logsLoading, setLogsLoading] = useState(true)

  // ── Audio recorder ──────────────────────────────────────────────────────────
  const [recorderPhase, setRecorderPhase] = useState<RecorderPhase>('idle')
  const [recorderError, setRecorderError] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [useRecording, setUseRecording] = useState(false)

  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const blobRef = useRef<Blob | null>(null)
  const mimeTypeRef = useRef<string>('')
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const previewRef = useRef<HTMLAudioElement | null>(null)

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
  }, [])

  const acquireStream = useCallback(async () => {
    setRecorderPhase('requesting')
    setRecorderError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      setRecorderPhase('ready')
    } catch (err: any) {
      const msg =
        err.name === 'NotAllowedError' ? 'Microphone permission denied.' :
        err.name === 'NotFoundError' ? 'No microphone found.' :
        'Could not access microphone: ' + (err.message || err.name)
      setRecorderError(msg)
      setRecorderPhase('idle')
    }
  }, [])

  const startRecording = useCallback(() => {
    const stream = streamRef.current
    if (!stream) return
    chunksRef.current = []
    blobRef.current = null
    const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/ogg']
    const mime = candidates.find(m => MediaRecorder.isTypeSupported(m)) ?? ''
    mimeTypeRef.current = mime
    const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
    recorderRef.current = recorder
    recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current || 'audio/webm' })
      blobRef.current = blob
      const url = URL.createObjectURL(blob)
      if (previewRef.current) {
        previewRef.current.src = url
        previewRef.current.load()
      }
      stopStream()
      setRecorderPhase('preview')
      setUseRecording(true)
    }
    recorder.start(1000)
    setRecorderPhase('recording')
    setElapsed(0)
    timerRef.current = setInterval(() => setElapsed(v => v + 1), 1000)
  }, [stopStream])

  const stopRecording = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    recorderRef.current?.stop()
  }, [])

  const discardRecording = useCallback(async () => {
    if (previewRef.current?.src) URL.revokeObjectURL(previewRef.current.src)
    blobRef.current = null
    setUseRecording(false)
    setElapsed(0)
    await acquireStream()
  }, [acquireStream])

  const resetRecorder = useCallback(() => {
    stopStream()
    if (previewRef.current?.src) URL.revokeObjectURL(previewRef.current.src)
    blobRef.current = null
    setRecorderPhase('idle')
    setRecorderError(null)
    setElapsed(0)
    setUseRecording(false)
  }, [stopStream])

  // Load history on mount
  useEffect(() => {
    getMyReadingLogs().then(res => {
      if (res.success) setLogs(res.data ?? [])
    }).finally(() => setLogsLoading(false))
  }, [])

  // Clean up stream on unmount
  useEffect(() => () => { stopStream() }, [stopStream])

  // ── Submit ──────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!bookTitle.trim()) {
      toast.error('Please enter a book title.')
      return
    }

    setSubmitting(true)
    try {
      // 1. Create the log (without audio first)
      const createRes = await createReadingLog({
        book_title: bookTitle.trim(),
        book_author: bookAuthor.trim() || null,
        session_date: sessionDate || null,
        pages_read: pagesRead ? parseInt(pagesRead, 10) : null,
        notes: notes.trim() || null,
      })

      if (!createRes.success || !createRes.data) {
        toast.error(createRes.error ?? 'Failed to save reading log.')
        return
      }

      const logId = createRes.data.id
      let finalLog: ReadingLog = createRes.data

      // 2. Upload audio if recorded and user opted to use it
      if (useRecording && blobRef.current) {
        const blob = blobRef.current
        const mime = mimeTypeRef.current || 'audio/webm'
        const uploadRes = await uploadMediaRecording(blob, mime, activeCampusId)

        if (uploadRes.success && uploadRes.data?.path) {
          const patchRes = await attachReadingLogAudio(logId, uploadRes.data.path)
          if (!patchRes.success) {
            toast.warning('Log saved but audio could not be attached.')
          } else {
            finalLog = { ...finalLog, audio_file_path: uploadRes.data.path, audio_url: uploadRes.data.url }
          }
        } else {
          toast.warning('Log saved but audio upload failed: ' + (uploadRes.error ?? 'Unknown error'))
        }
      }

      toast.success('Reading session saved!')

      // Reset form
      setBookTitle('')
      setBookAuthor('')
      setSessionDate(new Date().toISOString().split('T')[0])
      setPagesRead('')
      setNotes('')
      resetRecorder()

      // Prepend to history
      setLogs(prev => [finalLog, ...prev])
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="container max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-primary" />
          Log a Reading Session
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Record what you read and optionally attach an audio reading.
        </p>
      </div>

      {/* ── Log form ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Session Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="book_title">Book Title *</Label>
                <Input
                  id="book_title"
                  value={bookTitle}
                  onChange={e => setBookTitle(e.target.value)}
                  placeholder="Enter book title"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="book_author">Author</Label>
                <Input
                  id="book_author"
                  value={bookAuthor}
                  onChange={e => setBookAuthor(e.target.value)}
                  placeholder="Author name"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="session_date">Session Date</Label>
                <Input
                  id="session_date"
                  type="date"
                  value={sessionDate}
                  onChange={e => setSessionDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pages_read">Pages Read</Label>
                <Input
                  id="pages_read"
                  type="number"
                  min={1}
                  value={pagesRead}
                  onChange={e => setPagesRead(e.target.value)}
                  placeholder="e.g. 25"
                />
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="What did you read about? Any thoughts or vocabulary?"
                  rows={3}
                />
              </div>
            </div>

            {/* ── Inline audio recorder ── */}
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Mic className="h-4 w-4 text-primary" />
                <span className="font-medium text-sm">Audio Recording</span>
                <span className="text-xs text-muted-foreground">(optional — up to 60 min)</span>
              </div>

              {recorderError && (
                <p className="text-xs text-destructive">{recorderError}</p>
              )}

              {/* Idle: offer to enable mic */}
              {recorderPhase === 'idle' && (
                <Button type="button" variant="outline" size="sm" onClick={acquireStream}>
                  <Mic className="mr-2 h-3.5 w-3.5" />
                  Enable Microphone
                </Button>
              )}

              {/* Requesting */}
              {recorderPhase === 'requesting' && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Requesting microphone access…
                </div>
              )}

              {/* Ready */}
              {recorderPhase === 'ready' && (
                <Button type="button" size="sm" onClick={startRecording}>
                  <span className="inline-block h-2 w-2 rounded-full bg-white mr-2" />
                  Start Recording
                </Button>
              )}

              {/* Recording */}
              {recorderPhase === 'recording' && (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="inline-block h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-mono">{formatTime(elapsed)}</span>
                  </div>
                  <Button type="button" size="sm" variant="destructive" onClick={stopRecording}>
                    <Square className="mr-1.5 h-3 w-3 fill-current" />
                    Stop
                  </Button>
                </div>
              )}

              {/* Preview */}
              {recorderPhase === 'preview' && (
                <div className="space-y-2">
                  <audio ref={previewRef} controls className="w-full h-9" />
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        checked={useRecording}
                        onChange={e => setUseRecording(e.target.checked)}
                        className="accent-primary"
                      />
                      Attach this recording to the log
                    </label>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={discardRecording}
                      className="ml-auto text-xs"
                    >
                      <RefreshCw className="mr-1 h-3 w-3" />
                      Record again
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</>
              ) : (
                <><CheckCircle className="mr-2 h-4 w-4" />Save Session</>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* ── Past sessions ── */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Past Sessions</h2>
        {logsLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground text-sm">
            No reading sessions yet. Log your first one above!
          </div>
        ) : (
          <div className="space-y-3">
            {logs.map(log => <LogCard key={log.id} log={log} />)}
          </div>
        )}
      </div>
    </div>
  )
}
