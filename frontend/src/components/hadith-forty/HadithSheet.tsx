'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import useSWR from 'swr'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Star, Repeat, Check, X, GraduationCap, ChevronLeft } from 'lucide-react'
import { getAuthToken } from '@/lib/api/schools'
import {
  getContent,
  recordRepetition,
  recordReview,
  updateFlags,
  startQuiz,
  submitQuiz,
  type HadithProgress,
  type ClientQuizQuestion,
  type QuizGrade,
} from '@/lib/api/hadith-forty'

interface Props {
  hadithNumber: number | null
  today: string
  progressOf: (n: number) => HadithProgress
  session: readonly number[] | null
  campusId?: string
  onOpenChange: (open: boolean) => void
  onNavigate: (n: number) => void
  onAdvanceSession: () => boolean
  onChanged: () => void
}

const makeContentFetcher = (campusId?: string) => async (): Promise<import('@/lib/api/hadith-forty').ContentPayload | null> => {
  const token = await getAuthToken()
  if (!token) return null
  const res = await getContent(token, campusId)
  return res.success && res.data ? res.data : null
}

type QuizPhase = 'idle' | 'active' | 'graded';

export function HadithSheet({ hadithNumber, today, progressOf, session, campusId, onOpenChange, onNavigate, onAdvanceSession, onChanged }: Props) {
  const t = useTranslations('hadithForty')
  const { data: content } = useSWR(['hadith-forty-content', campusId], makeContentFetcher(campusId), { revalidateOnFocus: false })

  const [note, setNote] = useState('')
  const [savingNote, setSavingNote] = useState(false);
  const [quizPhase, setQuizPhase] = useState<QuizPhase>('idle')
  const [attemptId, setAttemptId] = useState<string | null>(null)
  const [questions, setQuestions] = useState<ClientQuizQuestion[]>([])
  const [answers, setAnswers] = useState<number[]>([])
  const [grade, setGrade] = useState<QuizGrade | null>(null)
  const [starting, setStarting] = useState(false)

  const hadith = hadithNumber ? content?.hadiths.find((h) => h.number === hadithNumber) : undefined;
  const narrator = hadith ? content?.narrators[hadith.narratorId] : undefined;
  const progress = hadithNumber ? progressOf(hadithNumber) : null;

  useEffect(() => {
    setNote(progress?.note ?? '')
    setQuizPhase('idle')
    setAttemptId(null)
    setQuestions([])
    setAnswers([])
    setGrade(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hadithNumber])

  if (hadithNumber === null) return null;

  const handleRepeat = async () => {
    const token = await getAuthToken()
    if (!token) return
    const res = await recordRepetition(hadithNumber, token, undefined, campusId)
    if (res.success) onChanged()
    else toast.error(res.error || t('errors.generic'))
  }

  const handleReview = async (outcome: 'pass' | 'fail') => {
    const token = await getAuthToken()
    if (!token) return
    const res = await recordReview(hadithNumber, outcome, token, campusId)
    if (res.success) {
      toast.success(outcome === 'pass' ? t('review.passedToast') : t('review.failedToast'))
      onChanged()
    } else {
      toast.error(res.error || t('errors.generic'))
    }
  }

  const handleToggleFavorite = async () => {
    const token = await getAuthToken()
    if (!token || !progress) return
    const res = await updateFlags({ hadithNumber, isFavorite: !progress.isFavorite }, token, campusId)
    if (res.success) onChanged()
  }

  const handleSaveNote = async () => {
    const token = await getAuthToken()
    if (!token) return
    setSavingNote(true)
    const res = await updateFlags({ hadithNumber, note }, token, campusId)
    setSavingNote(false)
    if (res.success) onChanged()
    else toast.error(res.error || t('errors.generic'))
  }

  const handleStartQuiz = async () => {
    const token = await getAuthToken()
    if (!token) return
    setStarting(true)
    const res = await startQuiz(hadithNumber, token, campusId)
    setStarting(false)
    if (res.success && res.data) {
      setAttemptId(res.data.attemptId)
      setQuestions(res.data.questions)
      setAnswers(new Array(res.data.questions.length).fill(-1))
      setQuizPhase('active')
    } else {
      toast.error(res.error || t('errors.generic'))
    }
  }

  const handleSubmitQuiz = async () => {
    const token = await getAuthToken()
    if (!token || !attemptId) return
    const res = await submitQuiz(attemptId, answers, token, campusId)
    if (res.success && res.data) {
      setGrade(res.data.grade)
      setQuizPhase('graded')
      onChanged()
    } else {
      toast.error(res.error || t('errors.generic'))
    }
  }

  const handleNext = () => {
    const advanced = onAdvanceSession()
    if (!advanced) onOpenChange(false)
  }

  const renderBody = () => {
    if (!hadith) {
      return (
        <div className="space-y-3">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      )
    }

    if (quizPhase === 'active') {
      return (
        <div className="space-y-4">
          {questions.map((q, i) => (
            <div key={i} className="space-y-2">
              <p className="text-sm font-medium leading-relaxed">{q.body}</p>
              <div className="grid gap-2">
                {q.options.map((opt, oi) => (
                  <button
                    key={oi}
                    type="button"
                    onClick={() => setAnswers((prev) => prev.map((a, ai) => (ai === i ? oi : a)))}
                    className={[
                      'rounded-lg border p-2 text-start text-sm transition-colors',
                      answers[i] === oi ? 'border-primary bg-primary/10' : 'hover:bg-muted/50',
                    ].join(' ')}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )
    }

    if (quizPhase === 'graded' && grade) {
      return (
        <div className="space-y-3 text-center">
          <p className={grade.passed ? 'text-3xl font-extrabold text-primary' : 'text-3xl font-extrabold text-destructive'}>
            {grade.score} / {grade.total}
          </p>
          <p>{grade.passed ? t('quiz.passed') : t('quiz.failed')}</p>
        </div>
      )
    }

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{t(`categories.${hadith.category}`)}</Badge>
          {progress?.isFavorite && <Star className="size-4 fill-primary text-primary" />}
        </div>
        <p className="text-lg leading-loose" dir="rtl">{hadith.text}</p>
        <div className="text-muted-foreground text-sm">
          <p>{narrator?.name}</p>
          {narrator?.bio && <p className="text-xs mt-0.5">{narrator.bio}</p>}
          <p className="mt-1 font-medium">{hadith.source}</p>
        </div>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={handleSaveNote}
          placeholder={t('sheet.notePlaceholder')}
          rows={2}
          disabled={savingNote}
        />
      </div>
    )
  }

  return (
    <Dialog open={hadithNumber !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>{hadith ? `${hadith.number}. ${hadith.title}` : '…'}</DialogTitle>
            {hadith && (
              <Button variant="ghost" size="icon" onClick={handleToggleFavorite}>
                <Star className={progress?.isFavorite ? 'size-4 fill-primary text-primary' : 'size-4'} />
              </Button>
            )}
          </div>
        </DialogHeader>

        {renderBody()}

        <DialogFooter className="flex-wrap gap-2 sm:justify-between">
          {quizPhase === 'idle' && hadith && (
            <>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleRepeat}>
                  <Repeat className="size-4 me-1" />
                  {t('card.repetitionCount', { count: progress?.repetitions ?? 0 })}
                </Button>
                <Button variant="outline" size="sm" onClick={handleStartQuiz} disabled={starting}>
                  <GraduationCap className="size-4 me-1" />
                  {t('sheet.startQuiz')}
                </Button>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => handleReview('fail')}>
                  <X className="size-4 me-1 text-destructive" />
                  {t('review.fail')}
                </Button>
                <Button size="sm" onClick={() => handleReview('pass')}>
                  <Check className="size-4 me-1" />
                  {t('review.pass')}
                </Button>
              </div>
            </>
          )}
          {quizPhase === 'active' && (
            <Button className="w-full" onClick={handleSubmitQuiz} disabled={answers.includes(-1)}>
              {t('quiz.submit')}
            </Button>
          )}
          {quizPhase === 'graded' && (
            <Button className="w-full" onClick={() => setQuizPhase('idle')}>
              {t('quiz.done')}
            </Button>
          )}
          {session && quizPhase === 'idle' && (
            <Button variant="secondary" size="sm" onClick={handleNext}>
              <ChevronLeft className="size-4 me-1 rtl:rotate-180" />
              {t('sheet.next')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
