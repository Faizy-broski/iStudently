'use client'
import { useState } from 'react'
import useSWR, { mutate as globalMutate } from 'swr'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Trash2, GripVertical, Search } from 'lucide-react'
import {
  getQuizQuestions,
  getQuestions,
  getCategories,
  addQuestionToQuiz,
  removeQuestionFromQuiz,
  updateQuizQuestion,
  QUESTION_TYPE_LABELS,
  type Quiz,
  type QuizQuestionMap,
  type QuizQuestion,
} from '@/lib/api/quiz'

interface Props {
  quiz: Quiz
  schoolId: string
  campusId?: string | null
  onClose: () => void
  /** Called so the quizzes list can refresh question_count */
  onChanged: () => void
}

const NONE = '__none__'

export function ManageQuizQuestionsDialog({ quiz, schoolId, campusId, onClose, onChanged }: Props) {
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [adding, setAdding] = useState<string | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)
  const [editingPoints, setEditingPoints] = useState<Record<string, string>>({})

  // --- already-in-quiz questions ---
  const mappedKey = ['quiz-question-map', quiz.id]
  const { data: mapped, isLoading: loadingMapped } = useSWR(
    mappedKey,
    () => getQuizQuestions(quiz.id).then(r => r.data ?? [])
  )

  // --- question bank ---
  const bankKey = ['quiz-bank', schoolId, campusId, filterCategory, search]
  const { data: bank, isLoading: loadingBank } = useSWR(
    schoolId ? bankKey : null,
    () =>
      getQuestions(schoolId, {
        campusId,
        categoryId: filterCategory || undefined,
        search: search || undefined,
      }).then(r => r.data ?? [])
  )

  // --- categories for filter dropdown ---
  const { data: categories } = useSWR(
    schoolId ? ['quiz-categories', schoolId, campusId] : null,
    () => getCategories(schoolId, campusId).then(r => r.data ?? [])
  )

  const mappedIds = new Set((mapped ?? []).map(m => m.question_id))

  const handleAdd = async (question: QuizQuestion) => {
    setAdding(question.id)
    try {
      const nextOrder = (mapped?.length ?? 0)
      await addQuestionToQuiz(quiz.id, question.id, 10, nextOrder)
      await globalMutate(mappedKey)
      onChanged()
    } finally {
      setAdding(null)
    }
  }

  const handleRemove = async (map: QuizQuestionMap) => {
    setRemoving(map.id)
    try {
      await removeQuestionFromQuiz(quiz.id, map.id)
      await globalMutate(mappedKey)
      onChanged()
    } finally {
      setRemoving(null)
    }
  }

  const handlePointsBlur = async (map: QuizQuestionMap) => {
    const raw = editingPoints[map.id]
    if (raw === undefined) return
    const pts = parseFloat(raw)
    if (!isNaN(pts) && pts !== map.points) {
      await updateQuizQuestion(quiz.id, map.id, { points: pts })
      await globalMutate(mappedKey)
    }
    setEditingPoints(prev => { const n = { ...prev }; delete n[map.id]; return n })
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col overflow-hidden p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle>Manage Questions — {quiz.title}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col lg:flex-row flex-1 overflow-hidden min-h-0">

          {/* ── LEFT: Questions in this quiz ──────────────────────────── */}
          <div className="flex flex-col w-full lg:w-1/2 border-b lg:border-b-0 lg:border-r overflow-hidden">
            <div className="px-4 py-3 bg-muted/40 border-b flex items-center justify-between shrink-0">
              <span className="text-sm font-semibold">In this Quiz</span>
              <Badge variant="secondary">{mapped?.length ?? 0} questions</Badge>
            </div>

            <div className="overflow-y-auto flex-1 p-3 space-y-2">
              {loadingMapped
                ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-md" />)
                : (mapped ?? []).length === 0
                ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No questions yet. Add from the bank →
                    </p>
                  )
                : (mapped ?? []).map((map, idx) => (
                    <div key={map.id} className="flex items-start gap-2 rounded-md border bg-background p-3">
                      <GripVertical className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-snug line-clamp-2">
                          {idx + 1}. {map.question?.title ?? '—'}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {QUESTION_TYPE_LABELS[map.question?.type ?? 'select']}
                          </Badge>
                          {map.question?.category?.title && (
                            <span className="text-xs text-muted-foreground">{map.question.category.title}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Input
                          className="w-16 h-7 text-xs text-right px-2"
                          value={editingPoints[map.id] ?? map.points}
                          title="Points for this question"
                          onChange={e => setEditingPoints(prev => ({ ...prev, [map.id]: e.target.value }))}
                          onBlur={() => handlePointsBlur(map)}
                          type="number"
                          min={0}
                        />
                        <span className="text-xs text-muted-foreground">pts</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          disabled={removing === map.id}
                          onClick={() => handleRemove(map)}
                          title="Remove from quiz"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
            </div>
          </div>

          {/* ── RIGHT: Question Bank ──────────────────────────────────── */}
          <div className="flex flex-col w-full lg:w-1/2 overflow-hidden">
            <div className="px-4 py-3 bg-muted/40 border-b shrink-0">
              <p className="text-sm font-semibold mb-2">Question Bank</p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    className="pl-8 h-8 text-sm"
                    placeholder="Search questions…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
                <Select value={filterCategory || NONE} onValueChange={v => setFilterCategory(v === NONE ? '' : v)}>
                  <SelectTrigger className="h-8 w-40 text-sm">
                    <SelectValue placeholder="All categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>All categories</SelectItem>
                    {(categories ?? []).map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 p-3 space-y-2">
              {loadingBank
                ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-md" />)
                : (bank ?? []).length === 0
                ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No questions found.
                    </p>
                  )
                : (bank ?? []).map(q => {
                    const alreadyAdded = mappedIds.has(q.id)
                    return (
                      <div
                        key={q.id}
                        className={`flex items-start gap-2 rounded-md border p-3 transition-colors ${alreadyAdded ? 'bg-muted/50 opacity-60' : 'bg-background'}`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium leading-snug line-clamp-2">{q.title}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {QUESTION_TYPE_LABELS[q.type]}
                            </Badge>
                            {q.category?.title && (
                              <span className="text-xs text-muted-foreground">{q.category.title}</span>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant={alreadyAdded ? 'secondary' : 'default'}
                          className="h-7 px-2 text-xs shrink-0"
                          disabled={alreadyAdded || adding === q.id}
                          onClick={() => handleAdd(q)}
                        >
                          {alreadyAdded ? 'Added' : adding === q.id ? '…' : <><Plus className="w-3 h-3 mr-1" />Add</>}
                        </Button>
                      </div>
                    )
                  })}
            </div>
          </div>

        </div>

        <div className="px-6 py-3 border-t flex justify-end shrink-0">
          <Button variant="outline" onClick={onClose}>Done</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
