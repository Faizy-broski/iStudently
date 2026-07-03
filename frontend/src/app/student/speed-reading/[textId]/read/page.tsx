'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Maximize2, Minimize2, Mic, MicOff, Play, Square, CheckCircle2, Pause, Headphones } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { getAuthToken } from '@/lib/api/schools'
import { getText, submitLog, getBadge, type ReadingText, type QuizQuestion, type WordResult as ApiWordResult } from '@/lib/api/speed-reading'
import { uploadMediaRecording } from '@/lib/api/media-upload'

type Phase = 'setup' | 'reading' | 'manual-grade' | 'quiz' | 'result'
type WordResult = 'correct' | 'incorrect' | 'unread'

declare global {
  interface Window {
    SpeechRecognition: any
    webkitSpeechRecognition: any
  }
}

export default function TeleprompterPage() {
  const t = useTranslations('speedReading')
  const router = useRouter()
  const { textId } = useParams<{ textId: string }>()

  const [text, setText] = useState<ReadingText | null>(null)
  const [loading, setLoading] = useState(true)
  const [phase, setPhase] = useState<Phase>('setup')
  const [wpm, setWpm] = useState(80)
  const [gradingMode, setGradingMode] = useState<'voice' | 'manual'>('voice')
  const [voiceSupported, setVoiceSupported] = useState(true)
  const [insecureContext, setInsecureContext] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Voice state
  const [spokenWords, setSpokenWords] = useState<string[]>([])
  const [isListening, setIsListening] = useState(false)
  const recognitionRef = useRef<any>(null)

  // Audio recording
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const audioBlobRef = useRef<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)

  // Word review (populated after session ends)
  const [wordResults, setWordResults] = useState<WordResult[]>([])

  // Manual mode
  const [manualErrors, setManualErrors] = useState(0)

  // Quiz state
  const [quizAnswers, setQuizAnswers] = useState<Record<number, string>>({})
  const [comprehensionBonus, setComprehensionBonus] = useState(false)

  // Result state
  const [correctWords, setCorrectWords] = useState(0)
  const [incorrectWords, setIncorrectWords] = useState(0)
  const [accuracyPct, setAccuracyPct] = useState(0)
  const [pointsEarned, setPointsEarned] = useState(0)

  // Animation refs
  const animationRef = useRef<Animation | null>(null)
  const teleprompterRef = useRef<HTMLDivElement>(null)
  const scrollWrapRef = useRef<HTMLDivElement>(null)
  const [isPaused, setIsPaused] = useState(false)

  useEffect(() => {
    const isInsecure =
      typeof window !== 'undefined' &&
      window.location.protocol !== 'https:' &&
      window.location.hostname !== 'localhost'
    if (isInsecure) {
      setInsecureContext(true)
      setVoiceSupported(false)
      setGradingMode('manual')
      return
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) setVoiceSupported(false)
  }, [])

  useEffect(() => {
    const load = async () => {
      const token = await getAuthToken()
      const res = await getText(textId, token)
      if (res.success && res.data) setText(res.data)
      setLoading(false)
    }
    load()
  }, [textId])

  // Cleanup audio blob URL on unmount
  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl)
    }
  }, [audioUrl])

  const words = text?.content.trim().split(/\s+/).filter(Boolean) ?? []
  const durationMs = text ? Math.round((text.word_count / wpm) * 60 * 1000) : 0

  // Normalise a word for comparison (lowercase, strip punctuation)
  const normalise = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')

  // ── AUDIO RECORDING ──────────────────────────────────────────────────────

  const startRecordingAudio = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      audioChunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        audioBlobRef.current = blob
        setAudioUrl(URL.createObjectURL(blob))
        stream.getTracks().forEach((t) => t.stop())
      }
      recorder.start(100) // collect data every 100 ms
      mediaRecorderRef.current = recorder
    } catch (err) {
      // Microphone permission denied, no mic hardware, or insecure context
      console.error('Audio recording unavailable:', err)
    }
  }, [])

  const stopRecordingAudio = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    mediaRecorderRef.current = null
  }, [])

  // Keep a stable ref so the animation onfinish closure can call it
  const stopRecordingAudioRef = useRef(stopRecordingAudio)
  useEffect(() => { stopRecordingAudioRef.current = stopRecordingAudio }, [stopRecordingAudio])

  // ── SPEECH RECOGNITION ───────────────────────────────────────────────────

  const startRecognition = useCallback(() => {
    if (!voiceSupported || !text) return
    try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      const recognition = new SpeechRecognition()
      recognition.lang = text.language === 'ar' ? 'ar-SA' : 'en-US'
      recognition.continuous = true
      recognition.interimResults = true

      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results as SpeechRecognitionResultList)
          .map((r: SpeechRecognitionResult) => r[0].transcript)
          .join(' ')
        setSpokenWords(transcript.trim().split(/\s+/).filter(Boolean))
      }
      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event?.error)
        setGradingMode('manual')
        setVoiceSupported(false)
      }
      recognition.start()
      recognitionRef.current = recognition
      setIsListening(true)
    } catch (err) {
      console.error('Speech recognition unavailable:', err)
      setGradingMode('manual')
      setVoiceSupported(false)
    }
  }, [text, voiceSupported])

  const stopRecognition = useCallback(() => {
    recognitionRef.current?.stop()
    recognitionRef.current = null
    setIsListening(false)
  }, [])

  // ── SESSION CONTROL ───────────────────────────────────────────────────────

  const startReading = useCallback(() => {
    if (!text) return
    if (gradingMode === 'voice') {
      startRecognition()
      startRecordingAudio()
    }
    setPhase('reading')
  }, [text, gradingMode, startRecognition, startRecordingAudio])

  useEffect(() => {
    if (phase !== 'reading' || !scrollWrapRef.current || !text) return
    const el = scrollWrapRef.current
    const duration = Math.round((text.word_count / wpm) * 60 * 1000)
    const anim = el.animate(
      [{ transform: 'translateY(100%)' }, { transform: 'translateY(-100%)' }],
      { duration: duration * 2, easing: 'linear', fill: 'forwards' }
    )
    animationRef.current = anim
    anim.onfinish = () => {
      stopRecognition()
      stopRecordingAudioRef.current()
      handleScrollEndRef.current()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  const togglePause = useCallback(() => {
    const anim = animationRef.current
    if (!anim) return
    if (anim.playState === 'paused') {
      anim.play()
      if (gradingMode === 'voice') startRecognition()
      setIsPaused(false)
    } else {
      anim.pause()
      if (gradingMode === 'voice') stopRecognition()
      setIsPaused(true)
    }
  }, [gradingMode, startRecognition, stopRecognition])

  const finalise = useCallback(async (bonus: boolean) => {
    if (!text) return
    const total = text.word_count
    let correct: number
    let computedWordResults: WordResult[] = []

    if (gradingMode === 'voice') {
      // Compute word-level results for the review panel
      computedWordResults = words.map((word, i) => {
        if (i >= spokenWords.length) return 'unread'
        return normalise(spokenWords[i]) === normalise(word) ? 'correct' : 'incorrect'
      })
      setWordResults(computedWordResults)
      correct = computedWordResults.filter((r) => r === 'correct').length
    } else {
      correct = Math.max(0, total - manualErrors)
      setWordResults([])
    }

    const incorrect = total - correct
    const accuracy = total > 0 ? Math.round((correct / total) * 100 * 100) / 100 : 0
    const multiplier = wpm < 80 ? 1 : wpm < 120 ? 1.5 : 2
    const base = Math.round(correct * multiplier)
    const points = bonus ? base * 2 : base

    setCorrectWords(correct)
    setIncorrectWords(incorrect)
    setAccuracyPct(accuracy)
    setPointsEarned(points)
    setComprehensionBonus(bonus)
    setPhase('result')

    try {
      const token = await getAuthToken()

      // Upload audio blob if available (voice mode only)
      let uploadedAudioUrl: string | undefined
      const blob = audioBlobRef.current
      if (gradingMode === 'voice' && blob && blob.size > 0) {
        const uploadRes = await uploadMediaRecording(blob, 'audio/webm')
        if (uploadRes.success && uploadRes.data?.url) {
          uploadedAudioUrl = uploadRes.data.url
        }
      }

      // Map local word result strings to API shape
      const apiWordResults: ApiWordResult[] | undefined =
        gradingMode === 'voice' && computedWordResults.length > 0
          ? words.map((word, i) => ({ word, status: computedWordResults[i] ?? 'unread' }))
          : undefined

      await submitLog({
        text_id: text.id,
        target_wpm: wpm,
        correct_words: correct,
        incorrect_words: incorrect,
        accuracy_percentage: accuracy,
        comprehension_bonus: bonus,
        grading_mode: gradingMode,
        audio_url: uploadedAudioUrl,
        word_results: apiWordResults,
      }, token)
    } catch (err) {
      console.error('Failed to submit reading session results:', err)
    }
  }, [text, gradingMode, spokenWords, words, manualErrors, wpm])

  const handleScrollEnd = useCallback(() => {
    if (!text) return
    if (gradingMode === 'manual') {
      setPhase('manual-grade')
    } else if (text.quiz_questions && text.quiz_questions.length > 0) {
      setPhase('quiz')
    } else {
      finalise(false)
    }
  }, [text, gradingMode, finalise])

  // Keep a stable ref so the animation onfinish closure always sees the latest spokenWords
  const handleScrollEndRef = useRef(handleScrollEnd)
  useEffect(() => { handleScrollEndRef.current = handleScrollEnd }, [handleScrollEnd])

  const stopEarly = useCallback(() => {
    animationRef.current?.cancel()
    stopRecognition()
    stopRecordingAudio()
    setIsPaused(false)
    handleScrollEnd()
  }, [stopRecognition, stopRecordingAudio, handleScrollEnd])

  const handleQuizSubmit = useCallback(() => {
    if (!text?.quiz_questions) { finalise(false); return }
    const allCorrect = text.quiz_questions.every((q, i) => quizAnswers[i] === q.correct_ans)
    finalise(allCorrect)
  }, [text, quizAnswers, finalise])

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen?.()
      setIsFullscreen(false)
    }
  }

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  if (loading) return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-64 w-full" />
    </div>
  )

  if (!text) return (
    <div className="py-16 text-center text-muted-foreground">Text not found.</div>
  )

  // ── SETUP PHASE ──────────────────────────────────────────
  if (phase === 'setup') {
    return (
      <div className="max-w-lg mx-auto space-y-6">
        <h1 className="text-2xl font-bold">{text.title}</h1>
        <p className="text-sm text-muted-foreground">{text.word_count} words · {text.language === 'ar' ? 'Arabic' : 'English'}</p>

        <div className="space-y-3">
          <Label>{t('wpmLabel')}: <span className="font-semibold text-primary">{wpm}</span></Label>
          <input
            type="range"
            min={40} max={200} step={5}
            value={wpm}
            onChange={e => setWpm(Number(e.target.value))}
            className="w-full h-2 accent-primary cursor-pointer"
          />
          <p className="text-xs text-muted-foreground">{t('wpmHint')}</p>
          <p className="text-xs text-muted-foreground">
            Est. duration: {Math.round(durationMs / 1000)}s
          </p>
        </div>

        <div className="space-y-3">
          <Label>{t('readingMode')}</Label>
          <div className="flex gap-3">
            <Button
              variant={gradingMode === 'voice' ? 'default' : 'outline'}
              size="sm"
              disabled={!voiceSupported}
              onClick={() => setGradingMode('voice')}
            >
              <Mic className="h-4 w-4 mr-2 rtl:ml-2 rtl:mr-0" />
              {t('voiceMode')}
            </Button>
            <Button
              variant={gradingMode === 'manual' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setGradingMode('manual')}
            >
              <MicOff className="h-4 w-4 mr-2 rtl:ml-2 rtl:mr-0" />
              {t('manualMode')}
            </Button>
          </div>
          {insecureContext && (
            <div className="rounded-md border border-yellow-400/40 bg-yellow-50 dark:bg-yellow-950/30 px-3 py-2 text-sm text-yellow-700 dark:text-yellow-400">
              Insecure connection! Recording requires HTTPS or localhost.
            </div>
          )}
          {!voiceSupported && !insecureContext && (
            <p className="text-xs text-amber-600">{t('voiceNotSupported')}</p>
          )}
          {gradingMode === 'voice' && (
            <p className="text-xs text-blue-600 bg-blue-50 dark:bg-blue-950/30 rounded px-3 py-2">
              Your reading will be recorded so you can listen back after the session.
            </p>
          )}
          {gradingMode === 'manual' && (
            <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 rounded px-3 py-2">
              After the reading ends, you will be asked to enter the number of incorrect words.
            </p>
          )}
        </div>

        <div className="flex gap-3">
          <Button onClick={startReading}>
            <Play className="h-4 w-4 mr-2 rtl:ml-2 rtl:mr-0" />
            {t('startSession')}
          </Button>
          <Button variant="outline" onClick={() => toggleFullscreen()}>
            <Maximize2 className="h-4 w-4 mr-2 rtl:ml-2 rtl:mr-0" />
            {t('smartboardMode')}
          </Button>
          <Button variant="ghost" onClick={() => router.push('/student/speed-reading')}>
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  // ── READING PHASE ─────────────────────────────────────────
  if (phase === 'reading') {
    return (
      <div
        className={`relative flex flex-col overflow-hidden select-none ${
          isFullscreen
            ? 'fixed inset-0 bg-neutral-950 text-white z-50'
            : 'h-[70vh] bg-neutral-950 text-white rounded-xl'
        }`}
        ref={teleprompterRef}
      >
        {/* Controls bar */}
        <div className="absolute top-0 inset-x-0 z-10 flex items-center justify-between px-6 py-3 bg-neutral-950/80 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium opacity-70">{text.title}</span>
            <Badge variant="outline" className="text-white border-white/30">
              {wpm} WPM
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            {isListening && !isPaused && (
              <span className="flex items-center gap-1 text-green-400 text-xs animate-pulse">
                <Mic className="h-3 w-3" /> {t('listeningActive')}
              </span>
            )}
            {isPaused && (
              <span className="flex items-center gap-1 text-yellow-400 text-xs">
                <Pause className="h-3 w-3" /> Paused
              </span>
            )}
            <button
              onClick={togglePause}
              className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-md border border-yellow-400 text-yellow-400 hover:bg-yellow-400/10 transition-colors"
            >
              {isPaused
                ? <><Play className="h-4 w-4" /> Resume</>
                : <><Pause className="h-4 w-4" /> Pause</>
              }
            </button>
            <button
              onClick={stopEarly}
              className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-md border border-red-400 text-red-400 hover:bg-red-400/10 transition-colors"
            >
              <Square className="h-4 w-4" />
              {t('stopSession')}
            </button>
            <Button size="sm" variant="ghost" className="text-white hover:bg-white/10" onClick={toggleFullscreen}>
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Scrolling text */}
        <div className="flex-1 overflow-hidden px-8 sm:px-16 pt-16">
          <div ref={scrollWrapRef} className="will-change-transform">
            <p
              className={`text-2xl sm:text-3xl leading-relaxed ${
                text.language === 'ar' ? 'text-right font-arabic' : ''
              }`}
              dir={text.language === 'ar' ? 'rtl' : 'ltr'}
            >
              {words.map((word, i) => {
                let color = 'text-white/70'
                if (gradingMode === 'voice' && i < spokenWords.length) {
                  color = normalise(spokenWords[i]) === normalise(word)
                    ? 'text-green-400 font-semibold'
                    : 'text-red-400'
                } else if (gradingMode === 'voice' && i === spokenWords.length) {
                  color = 'text-yellow-300 underline'
                }
                return (
                  <span key={i} className={color}>
                    {word}{' '}
                  </span>
                )
              })}
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ── MANUAL GRADE PHASE ───────────────────────────────────
  if (phase === 'manual-grade') {
    const handleManualSubmit = () => {
      if (text.quiz_questions && text.quiz_questions.length > 0) {
        setPhase('quiz')
      } else {
        finalise(false)
      }
    }
    return (
      <div className="max-w-sm mx-auto space-y-6 py-8">
        <div className="text-center space-y-2">
          <div className="text-4xl">✅</div>
          <h2 className="text-xl font-bold">Reading Complete</h2>
          <p className="text-sm text-muted-foreground">
            How many words did the student mispronounce or skip?
          </p>
        </div>
        <div className="space-y-3">
          <Label className="text-base">{t('incorrectWords')}</Label>
          <div className="flex items-center gap-3">
            <button
              className="w-10 h-10 rounded-full border text-xl font-bold flex items-center justify-center hover:bg-muted"
              onClick={() => setManualErrors(e => Math.max(0, e - 1))}
            >−</button>
            <Input
              type="number"
              min={0}
              max={text.word_count}
              value={manualErrors}
              onChange={e => setManualErrors(Math.max(0, Math.min(text.word_count, Number(e.target.value))))}
              className="w-24 text-center text-2xl font-bold h-12"
            />
            <button
              className="w-10 h-10 rounded-full border text-xl font-bold flex items-center justify-center hover:bg-muted"
              onClick={() => setManualErrors(e => Math.min(text.word_count, e + 1))}
            >+</button>
          </div>
          <p className="text-xs text-muted-foreground">
            Total words: {text.word_count} · Correct: {Math.max(0, text.word_count - manualErrors)}
          </p>
        </div>
        <Button className="w-full" onClick={handleManualSubmit}>
          Submit Score
        </Button>
      </div>
    )
  }

  // ── QUIZ PHASE ────────────────────────────────────────────
  if (phase === 'quiz' && text.quiz_questions) {
    return (
      <div className="max-w-lg mx-auto space-y-6">
        <h2 className="text-xl font-bold">{t('comprehensionQuiz')}</h2>
        <p className="text-sm text-muted-foreground">{t('comprehensionInstructions')}</p>

        {text.quiz_questions.map((q, idx) => (
          <QuizCard
            key={idx}
            q={q}
            idx={idx}
            selected={quizAnswers[idx]}
            onSelect={ans => setQuizAnswers(prev => ({ ...prev, [idx]: ans }))}
          />
        ))}

        <Button
          onClick={handleQuizSubmit}
          disabled={Object.keys(quizAnswers).length < (text.quiz_questions?.length ?? 0)}
        >
          {t('submitQuiz')}
        </Button>
      </div>
    )
  }

  // ── RESULT PHASE ──────────────────────────────────────────
  const { emoji, label } = getBadge(wpm)

  return (
    <div className="max-w-lg mx-auto space-y-6 text-center">
      <div className="text-5xl">{comprehensionBonus ? '🎉' : '✅'}</div>
      <h2 className="text-2xl font-bold">{t('sessionComplete')}</h2>

      <div className="grid grid-cols-2 gap-4">
        <ResultCard label={t('pointsEarned')} value={`${pointsEarned} pts`} highlight />
        <ResultCard label={t('accuracy')} value={`${accuracyPct}%`} />
        <ResultCard label={t('wordsReadCorrectly')} value={String(correctWords)} />
        <ResultCard label="WPM" value={String(wpm)} />
      </div>

      {comprehensionBonus && (
        <div className="flex items-center justify-center gap-2 text-green-600 bg-green-50 dark:bg-green-950/30 rounded-lg p-3">
          <CheckCircle2 className="h-5 w-5" />
          <span className="font-medium">{t('comprehensionBonus')} ×2!</span>
        </div>
      )}

      <div className="text-center py-2">
        <p className="text-4xl mb-1">{emoji}</p>
        <Badge variant="outline" className="text-sm">{label}</Badge>
      </div>

      {/* ── Listen to recording ── */}
      {audioUrl && (
        <div className="text-left bg-muted/40 border rounded-lg p-4 space-y-2">
          <p className="text-sm font-semibold flex items-center gap-2">
            <Headphones className="h-4 w-4 text-primary" />
            Listen to your recording
          </p>
          <audio controls src={audioUrl} className="w-full h-10" />
        </div>
      )}

      {/* ── Word-by-word review ── */}
      {gradingMode === 'voice' && wordResults.length > 0 && (
        <div className="text-left bg-muted/40 border rounded-lg p-4 space-y-3">
          <p className="text-sm font-semibold">Word Review</p>
          <p
            className="text-sm leading-loose"
            dir={text.language === 'ar' ? 'rtl' : 'ltr'}
          >
            {words.map((word, i) => {
              const result = wordResults[i] ?? 'unread'
              const cls =
                result === 'correct'
                  ? 'text-green-600 dark:text-green-400 font-medium'
                  : result === 'incorrect'
                  ? 'text-red-500 dark:text-red-400 font-medium'
                  : 'text-muted-foreground'
              return (
                <span
                  key={i}
                  className={cls}
                  title={
                    result === 'correct' ? 'Correct' :
                    result === 'incorrect' ? 'Mispronounced / incorrect' :
                    'Not reached'
                  }
                >
                  {word}{' '}
                </span>
              )
            })}
          </p>
          {/* Legend */}
          <div className="flex gap-4 text-xs pt-1 flex-wrap">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0" />
              Correct ({wordResults.filter(r => r === 'correct').length})
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
              Incorrect ({wordResults.filter(r => r === 'incorrect').length})
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-gray-400 shrink-0" />
              Not reached ({wordResults.filter(r => r === 'unread').length})
            </span>
          </div>
        </div>
      )}

      <div className="flex gap-3 justify-center flex-wrap">
        <Button onClick={() => router.push('/student/speed-reading')}>
          {t('viewLeaderboard')}
        </Button>
        <Button variant="outline" onClick={() => {
          setPhase('setup')
          setSpokenWords([])
          setQuizAnswers({})
          setManualErrors(0)
          setWordResults([])
          if (audioUrl) {
            URL.revokeObjectURL(audioUrl)
            setAudioUrl(null)
          }
          audioChunksRef.current = []
          audioBlobRef.current = null
        }}>
          {t('readAnother')}
        </Button>
      </div>
    </div>
  )
}

function QuizCard({
  q, idx, selected, onSelect,
}: {
  q: QuizQuestion
  idx: number
  selected?: string
  onSelect: (ans: string) => void
}) {
  const options: { key: 'a' | 'b' | 'c' | 'd'; text: string }[] = [
    { key: 'a', text: q.option_a },
    { key: 'b', text: q.option_b },
    ...(q.option_c ? [{ key: 'c' as const, text: q.option_c }] : []),
    ...(q.option_d ? [{ key: 'd' as const, text: q.option_d }] : []),
  ]
  return (
    <div className="border rounded-lg p-4 space-y-3">
      <p className="font-medium">{idx + 1}. {q.question}</p>
      <div className="space-y-2">
        {options.map(opt => (
          <button
            key={opt.key}
            onClick={() => onSelect(opt.key)}
            className={`w-full text-left rtl:text-right px-3 py-2 rounded-md border text-sm transition-colors ${
              selected === opt.key
                ? 'bg-primary text-primary-foreground border-primary'
                : 'hover:bg-muted/50 border-border'
            }`}
          >
            <span className="font-semibold uppercase mr-2 rtl:ml-2 rtl:mr-0">{opt.key}.</span>
            {opt.text}
          </button>
        ))}
      </div>
    </div>
  )
}

function ResultCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg p-4 text-center ${highlight ? 'bg-primary/10 border border-primary/20' : 'bg-muted/50'}`}>
      <p className={`text-2xl font-bold ${highlight ? 'text-primary' : ''}`}>{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  )
}
