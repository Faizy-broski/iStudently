'use client'

import { useEffect, useMemo, useState } from 'react'
import useSWR from 'swr'
import { DndContext, useDraggable, useDroppable, useSensor, useSensors, PointerSensor, type DragEndEvent } from '@dnd-kit/core'
import { useAuth } from '@/context/AuthContext'
import { getAuthToken } from '@/lib/api/schools'
import { API_URL } from '@/config/api'
import { submitQuiz, getStudentSubmission, getStudentQuizForm, getStudentQuizStatus, type QuizQuestionMap } from '@/lib/api/quiz'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog'
import { Loader2, HelpCircle, CheckCircle2, XCircle, Clock, BookOpen, AlertCircle, ChevronRight } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { toast } from 'sonner'

// ── Matching (Drag & Drop) question ─────────────────────────────────────────

function parseMatchingPairs(answer?: string | null): { left: string; right: string }[] {
  return (answer || '')
    .split('\n')
    .map(line => line.split('::'))
    .filter((parts): parts is [string, string] => parts.length === 2)
    .map(([left, right]) => ({ left: left.trim(), right: right.trim() }))
}

function shuffledIndices(length: number): number[] {
  const arr = Array.from({ length }, (_, i) => i)
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function MatchingChip({ canonicalIndex, label, disabled }: { canonicalIndex: number; label: string; disabled?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `right-${canonicalIndex}`,
    disabled,
  })
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={[
        'px-3 py-2 rounded-md border bg-background text-sm select-none',
        disabled ? 'cursor-default' : 'cursor-grab hover:border-primary/50',
        isDragging ? 'opacity-50 shadow-lg z-10 relative' : '',
      ].join(' ')}
    >
      {label}
    </div>
  )
}

function MatchingSlot({
  leftIndex, leftLabel, assigned, correctness, disabled,
}: {
  leftIndex: number
  leftLabel: string
  assigned?: { canonicalIndex: number; label: string } | null
  correctness?: 'correct' | 'incorrect' | null
  disabled?: boolean
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `slot-${leftIndex}`, disabled })
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 text-sm p-2 rounded-md border bg-muted/40">{leftLabel}</div>
      <div
        ref={setNodeRef}
        className={[
          'flex-1 min-h-[2.5rem] p-1 rounded-md border-2 border-dashed flex items-center gap-1 transition-colors',
          isOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/30',
          correctness === 'correct' ? 'border-green-400 bg-green-50' : '',
          correctness === 'incorrect' ? 'border-red-400 bg-red-50' : '',
        ].join(' ')}
      >
        {assigned ? (
          <MatchingChip canonicalIndex={assigned.canonicalIndex} label={assigned.label} disabled={disabled} />
        ) : (
          <span className="text-muted-foreground italic text-sm px-2">Drop here</span>
        )}
        {correctness === 'correct' && <CheckCircle2 className="h-4 w-4 text-green-600 ml-auto mr-1 shrink-0" />}
        {correctness === 'incorrect' && <XCircle className="h-4 w-4 text-red-600 ml-auto mr-1 shrink-0" />}
      </div>
    </div>
  )
}

function MatchingQuestionInput({
  pairs, value, onChange, disabled, showCorrect,
}: {
  pairs: { left: string; right: string }[]
  value: string
  onChange: (value: string) => void
  disabled: boolean
  showCorrect: boolean
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))
  const rightOrder = useMemo(() => shuffledIndices(pairs.length), [pairs.length])

  const assignment: Record<number, number> = {}
  value.split('||').forEach((v, i) => {
    const n = parseInt(v, 10)
    if (!isNaN(n)) assignment[i] = n
  })
  const assignedCanonicalIndices = new Set(Object.values(assignment))

  const handleDragEnd = (evt: DragEndEvent) => {
    const { active, over } = evt
    if (!over) return
    const canonicalIndex = parseInt(String(active.id).replace('right-', ''), 10)
    if (isNaN(canonicalIndex)) return

    const next: Record<number, number> = {}
    for (const [k, v] of Object.entries(assignment)) {
      if (v !== canonicalIndex) next[Number(k)] = v
    }
    if (String(over.id).startsWith('slot-')) {
      const leftIndex = parseInt(String(over.id).replace('slot-', ''), 10)
      next[leftIndex] = canonicalIndex
    }
    onChange(pairs.map((_, i) => (next[i] !== undefined ? String(next[i]) : '')).join('||'))
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="space-y-3">
        <div className="space-y-2">
          {pairs.map((p, i) => {
            const assignedIndex = assignment[i]
            const correctness = disabled && showCorrect
              ? (assignedIndex === undefined ? null : assignedIndex === i ? 'correct' : 'incorrect')
              : null
            return (
              <MatchingSlot
                key={i}
                leftIndex={i}
                leftLabel={p.left}
                assigned={assignedIndex !== undefined ? { canonicalIndex: assignedIndex, label: pairs[assignedIndex]?.right ?? '' } : null}
                correctness={correctness}
                disabled={disabled}
              />
            )
          })}
        </div>
        {!disabled && (
          <div className="flex flex-wrap gap-2 p-2 rounded-md border border-dashed">
            {rightOrder
              .filter(canonicalIndex => !assignedCanonicalIndices.has(canonicalIndex))
              .map(canonicalIndex => (
                <MatchingChip key={canonicalIndex} canonicalIndex={canonicalIndex} label={pairs[canonicalIndex].right} />
              ))}
          </div>
        )}
      </div>
    </DndContext>
  )
}

// Fetch student's quizzes
async function fetchStudentQuizzes() {
  const token = await getAuthToken()
  const res = await fetch(`${API_URL}/quiz/student/quizzes`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  const json = await res.json()
  if (json.error) throw new Error(json.error)
  return json.data || []
}

// Fetch the student's form (multi-form aware). Throws with a coded message
// ('locked_out' / 'not_unlocked') that the caller can branch on.
async function fetchQuizQuestions(quizId: string) {
  const res = await getStudentQuizForm(quizId)
  if (res.error) throw new Error(res.error)
  return (res.data || []) as QuizQuestionMap[]
}

function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

function QuizCard({ quiz, onStart }: { quiz: any; onStart: (q: any) => void }) {
  const dueDate = quiz.assignment?.due_date
  const isOverdue = dueDate && new Date(dueDate) < new Date()

  const hasSchedule = !!quiz.start_time
  const [now, setNow] = useState(() => Date.now())

  // Poll authoritative lock state (cheap cached endpoint) only while scheduled
  // and not yet started; stop once the student has submitted.
  const { data: statusRes } = useSWR(
    hasSchedule && !quiz.submitted ? ['quiz-status', quiz.id] : null,
    () => getStudentQuizStatus(quiz.id),
    { refreshInterval: 5000, revalidateOnFocus: false }
  )
  const status = statusRes?.data

  // Local 1s tick for a smooth countdown display.
  useEffect(() => {
    if (!hasSchedule || quiz.submitted) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [hasSchedule, quiz.submitted])

  const startMs = quiz.start_time ? new Date(quiz.start_time).getTime() : 0
  const unlocked = status ? status.unlocked : (!hasSchedule || now >= startMs)
  const lockedOut = status?.locked_out ?? false
  const beforeStart = hasSchedule && !unlocked && !lockedOut
  const clickable = !lockedOut && unlocked

  return (
    <Card
      className={`transition-shadow ${clickable ? 'hover:shadow-md cursor-pointer' : 'opacity-90'}`}
      onClick={() => { if (clickable) onStart(quiz) }}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className={`p-2 rounded-lg shrink-0 ${quiz.submitted ? 'bg-green-100' : lockedOut ? 'bg-red-100' : 'bg-primary/10'}`}>
              {quiz.submitted
                ? <CheckCircle2 className="h-5 w-5 text-green-600" />
                : lockedOut
                  ? <XCircle className="h-5 w-5 text-red-600" />
                  : <HelpCircle className="h-5 w-5 text-primary" />
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">{quiz.title}</p>
              {quiz.description && (
                <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{quiz.description}</p>
              )}
              <div className="flex flex-wrap gap-2 mt-2 items-center">
                {quiz.submitted
                  ? <Badge className="bg-green-100 text-green-700">Submitted</Badge>
                  : lockedOut
                    ? <Badge className="bg-red-100 text-red-700">Locked — Absent</Badge>
                    : beforeStart
                      ? <Badge className="bg-amber-100 text-amber-700"><Clock className="h-3 w-3 mr-1" />Starts in {formatCountdown(startMs - now)}</Badge>
                      : <Badge className="bg-blue-100 text-blue-700">Not Started</Badge>
                }
                {dueDate && (
                  <Badge variant="outline" className={isOverdue ? 'text-red-600 border-red-200' : ''}>
                    <Clock className="h-3 w-3 mr-1" />
                    {isOverdue ? 'Overdue' : 'Due'}: {format(parseISO(dueDate), 'MMM d, yyyy')}
                  </Badge>
                )}
                {quiz.assignment?.points && (
                  <Badge variant="outline">{quiz.assignment.points} pts</Badge>
                )}
              </div>
              {beforeStart && (
                <p className="text-xs text-muted-foreground mt-2">
                  Unlocks {format(parseISO(quiz.start_time), 'MMM d, yyyy • h:mm a')}
                </p>
              )}
            </div>
          </div>
          {clickable && <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0 mt-1" />}
        </div>
      </CardContent>
    </Card>
  )
}

function QuizTaker({
  quiz, studentId, onClose, onSubmitted
}: {
  quiz: any; studentId: string; onClose: () => void; onSubmitted: () => void
}) {
  const { data: maps, isLoading, error: loadError } = useSWR(
    ['quiz-questions', quiz.id],
    () => fetchQuizQuestions(quiz.id),
    { revalidateOnFocus: false, shouldRetryOnError: false }
  )

  // Check existing submission
  const { data: existing } = useSWR(
    ['quiz-submission', quiz.id, studentId],
    () => getStudentSubmission(quiz.id, studentId),
    { revalidateOnFocus: false }
  )

  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  const existingAnswerMap = existing?.data?.answerMap || {}

  const getAnswer = (mapId: string) => {
    if (mapId in answers) return answers[mapId]
    return existingAnswerMap[mapId]?.answer || ''
  }

  const handleAnswerChange = (mapId: string, value: string) => {
    setAnswers(prev => ({ ...prev, [mapId]: value }))
  }

  const handleToggleMultiple = (mapId: string, idx: number) => {
    const current = getAnswer(mapId)
    const chosen = current ? current.split('||').filter(Boolean).map(Number) : []
    const next = chosen.includes(idx)
      ? chosen.filter(i => i !== idx)
      : [...chosen, idx]
    handleAnswerChange(mapId, next.join('||'))
  }

  const handleSubmit = async () => {
    if (!maps) return
    setSubmitting(true)
    try {
      const answerList = maps.map(m => ({
        quiz_question_map_id: m.id,
        answer: getAnswer(m.id) || ''
      }))
      const res = await submitQuiz(quiz.id, studentId, answerList)
      if (res.data) {
        toast.success('Quiz submitted successfully!')
        onSubmitted()
      } else {
        toast.error(res.error || 'Failed to submit quiz')
      }
    } catch {
      toast.error('Failed to submit quiz')
    } finally {
      setSubmitting(false)
    }
  }

  const renderQuestion = (map: QuizQuestionMap, idx: number) => {
    const q = map.question
    if (!q) return null
    const mapId = map.id
    const isSubmitted = quiz.submitted

    return (
      <div key={map.id} className="p-4 rounded-lg border bg-card space-y-3">
        <div className="flex items-start gap-2">
          <span className="font-semibold text-primary shrink-0">{idx + 1}.</span>
          <div className="flex-1">
            <p className="font-medium">{q.title}</p>
            {q.description && <p className="text-sm text-muted-foreground mt-1">{q.description}</p>}
            <Badge variant="outline" className="mt-1 text-xs">{map.points} pts</Badge>
          </div>
        </div>

        {/* Answer input based on type */}
        <div className="pl-5">
          {(q.type === 'select') && (() => {
            const options = (q.answer || '').split('\n').filter(Boolean)
            const selected = parseInt(getAnswer(mapId))
            return (
              <div className="space-y-2">
                {options.map((opt, i) => {
                  const label = opt.replace(/^\*/, '')
                  const isCorrect = quiz.submitted && quiz.show_correct_answers && opt.startsWith('*')
                  return (
                    <label
                      key={i}
                      className={[
                        'flex items-center gap-2 p-2 rounded cursor-pointer transition-colors',
                        selected === i ? 'bg-primary/10 border border-primary/30' : 'hover:bg-muted/50',
                        isCorrect ? 'border-green-300 bg-green-50' : ''
                      ].join(' ')}
                    >
                      <input
                        type="radio"
                        name={mapId}
                        value={i}
                        checked={selected === i}
                        onChange={() => !isSubmitted && handleAnswerChange(mapId, String(i))}
                        disabled={isSubmitted}
                        className="accent-primary"
                      />
                      <span className="text-sm">{label}</span>
                      {isCorrect && <CheckCircle2 className="h-3.5 w-3.5 text-green-600 ml-auto" />}
                    </label>
                  )
                })}
              </div>
            )
          })()}

          {(q.type === 'multiple') && (() => {
            const options = (q.answer || '').split('\n').filter(Boolean)
            const chosen = getAnswer(mapId)
              ? getAnswer(mapId).split('||').filter(Boolean).map(Number)
              : []
            return (
              <div className="space-y-2">
                {options.map((opt, i) => {
                  const label = opt.replace(/^\*/, '')
                  const isSelected = chosen.includes(i)
                  return (
                    <label
                      key={i}
                      className={[
                        'flex items-center gap-2 p-2 rounded cursor-pointer transition-colors',
                        isSelected ? 'bg-primary/10 border border-primary/30' : 'hover:bg-muted/50',
                      ].join(' ')}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => !isSubmitted && handleToggleMultiple(mapId, i)}
                        disabled={isSubmitted}
                        className="accent-primary"
                      />
                      <span className="text-sm">{label}</span>
                    </label>
                  )
                })}
              </div>
            )
          })()}

          {(q.type === 'text') && (
            <Input
              value={getAnswer(mapId)}
              onChange={e => !isSubmitted && handleAnswerChange(mapId, e.target.value)}
              disabled={isSubmitted}
              placeholder="Type your answer..."
              className="max-w-sm"
            />
          )}

          {(q.type === 'textarea') && (
            <Textarea
              value={getAnswer(mapId)}
              onChange={e => !isSubmitted && handleAnswerChange(mapId, e.target.value)}
              disabled={isSubmitted}
              placeholder="Write your answer..."
              rows={4}
            />
          )}

          {(q.type === 'matching') && (() => {
            const pairs = parseMatchingPairs(q.answer)
            return (
              <MatchingQuestionInput
                pairs={pairs}
                value={getAnswer(mapId)}
                onChange={v => handleAnswerChange(mapId, v)}
                disabled={isSubmitted}
                showCorrect={!!quiz.show_correct_answers}
              />
            )
          })()}

          {(q.type === 'gap') && (
            <div className="text-sm text-muted-foreground italic">
              Gap fill — answer: {isSubmitted ? (getAnswer(mapId) || '—') : (
                <Input
                  value={getAnswer(mapId)}
                  onChange={e => handleAnswerChange(mapId, e.target.value)}
                  placeholder="word1||word2||..."
                  className="max-w-xs mt-1"
                />
              )}
            </div>
          )}

          {/* Show existing score if submitted */}
          {existingAnswerMap[mapId]?.points !== null && existingAnswerMap[mapId]?.points !== undefined && (
            <div className="mt-2 text-sm">
              <Badge className="bg-green-100 text-green-700">
                Score: {existingAnswerMap[mapId].points}/{map.points} pts
              </Badge>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">{quiz.title}</h2>
          {quiz.description && <p className="text-sm text-muted-foreground">{quiz.description}</p>}
        </div>
        <Button variant="outline" onClick={onClose}>Close</Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : loadError ? (
        <Card className={/locked/i.test(loadError.message) ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}>
          <CardContent className="p-8 text-center">
            {/locked/i.test(loadError.message) ? (
              <>
                <XCircle className="h-10 w-10 mx-auto mb-2 text-red-600" />
                <p className="font-semibold text-red-700">You missed the entry window</p>
                <p className="text-sm text-red-600 mt-1">This quiz is locked and you have been marked absent.</p>
              </>
            ) : /unlock/i.test(loadError.message) ? (
              <>
                <Clock className="h-10 w-10 mx-auto mb-2 text-amber-600" />
                <p className="font-semibold text-amber-700">This quiz hasn’t started yet</p>
                <p className="text-sm text-amber-600 mt-1">Please wait for the scheduled start time.</p>
              </>
            ) : (
              <>
                <AlertCircle className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
                <p className="text-muted-foreground">{loadError.message}</p>
              </>
            )}
          </CardContent>
        </Card>
      ) : !maps || maps.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <AlertCircle className="h-10 w-10 mx-auto mb-2" />
            <p>No questions in this quiz yet</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-4">
            {(quiz.shuffle ? [...maps].sort(() => Math.random() - 0.5) : maps).map((m, i) =>
              renderQuestion(m, i)
            )}
          </div>

          {!quiz.submitted && (
            <div className="flex justify-end pt-2">
              <Button onClick={handleSubmit} disabled={submitting} size="lg">
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Submit Quiz
              </Button>
            </div>
          )}

          {quiz.submitted && (
            <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
              <CardContent className="p-4 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <p className="text-green-800 dark:text-green-300 text-sm font-medium">
                  You have already submitted this quiz.
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

export default function StudentQuizzesPage() {
  const { user, profile } = useAuth()
  const studentId = profile?.student_id || ''

  const { data: quizzes, isLoading, error, mutate } = useSWR(
    user ? ['student-quizzes', user.id] : null,
    fetchStudentQuizzes,
    { revalidateOnFocus: false }
  )

  const [activeQuiz, setActiveQuiz] = useState<any | null>(null)

  const handleQuizSubmitted = async () => {
    setActiveQuiz(null)
    await mutate()
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {activeQuiz ? (
        <QuizTaker
          quiz={activeQuiz}
          studentId={studentId}
          onClose={() => setActiveQuiz(null)}
          onSubmitted={handleQuizSubmitted}
        />
      ) : (
        <>
          <div>
            <h1 className="text-3xl font-bold">Quizzes</h1>
            <p className="text-muted-foreground mt-1">Take and review your assigned quizzes</p>
          </div>

          {error && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="p-4 flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <p className="text-red-700 text-sm">{error.message}</p>
              </CardContent>
            </Card>
          )}

          {/* Summary */}
          {quizzes && quizzes.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold">{quizzes.length}</p>
                  <p className="text-xs text-muted-foreground mt-1">Total Quizzes</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-green-600">
                    {quizzes.filter((q: any) => q.submitted).length}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Submitted</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-blue-600">
                    {quizzes.filter((q: any) => !q.submitted).length}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Pending</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Pending Quizzes */}
          {quizzes && quizzes.filter((q: any) => !q.submitted).length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3">Pending</h2>
              <div className="space-y-3">
                {quizzes.filter((q: any) => !q.submitted).map((q: any) => (
                  <QuizCard key={q.id} quiz={q} onStart={setActiveQuiz} />
                ))}
              </div>
            </div>
          )}

          {/* Submitted Quizzes */}
          {quizzes && quizzes.filter((q: any) => q.submitted).length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3">Submitted</h2>
              <div className="space-y-3">
                {quizzes.filter((q: any) => q.submitted).map((q: any) => (
                  <QuizCard key={q.id} quiz={q} onStart={setActiveQuiz} />
                ))}
              </div>
            </div>
          )}

          {(!quizzes || quizzes.length === 0) && !error && (
            <Card>
              <CardContent className="p-12 text-center">
                <HelpCircle className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <h3 className="font-semibold text-lg mb-1">No quizzes assigned</h3>
                <p className="text-muted-foreground text-sm">
                  Quizzes assigned to your class will appear here
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
