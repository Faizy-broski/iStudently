'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import useSWR from 'swr'
import { useAuth } from '@/context/AuthContext'
import { useCampus } from '@/context/CampusContext'
import {
  getQuizzes, createQuiz, deleteQuiz, getQuizQuestions,
  addQuestionToQuiz, removeQuestionFromQuiz, getQuestions, getCoursePeriodsForQuiz,
  type Quiz, type QuizQuestion, type QuizQuestionMap, QUESTION_TYPE_LABELS
} from '@/lib/api/quiz'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import {
  Loader2, Plus, HelpCircle, Trash2, ChevronDown, ChevronUp, AlertCircle
} from 'lucide-react'
import { toast } from 'sonner'
import { format, parseISO } from 'date-fns'

export default function TeacherQuizPage() {
  const t = useTranslations('teacherPages.quiz')
  const { profile } = useAuth()
  const campusContext = useCampus()
  const schoolId = profile?.school_id
  const staffId = profile?.staff_id
  const campusId = campusContext?.selectedCampus?.id

  const [showCreate, setShowCreate] = useState(false)
  const [expandedQuizId, setExpandedQuizId] = useState<string | null>(null)
  const [showAddQuestion, setShowAddQuestion] = useState<string | null>(null) // quizId
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [form, setForm] = useState({
    title: '',
    description: '',
    course_period_id: '',
    show_correct_answers: false,
    shuffle: false,
  })

  const { data: quizzesRes, isLoading, mutate } = useSWR(
    schoolId && staffId ? ['teacher-quizzes', schoolId, staffId] : null,
    () => getQuizzes(schoolId!, { campusId, createdBy: staffId }),
    { revalidateOnFocus: false }
  )

  const { data: coursePeriodsRes } = useSWR(
    schoolId ? ['quiz-course-periods', schoolId] : null,
    () => getCoursePeriodsForQuiz(schoolId!, campusId),
    { revalidateOnFocus: false }
  )

  const quizzes: Quiz[] = quizzesRes?.data || []
  const coursePeriods: any[] = coursePeriodsRes?.data || []

  const handleCreate = async () => {
    if (!form.title.trim()) { toast.warning(t('quizTitleRequired')); return }
    if (!schoolId || !staffId) return
    setCreating(true)
    const res = await createQuiz({
      school_id: schoolId,
      campus_id: campusId || null,
      title: form.title.trim(),
      description: form.description.trim() || null,
      course_period_id: form.course_period_id || null,
      created_by: staffId,
      academic_year_id: null,
      assignment_id: null,
      show_correct_answers: form.show_correct_answers,
      shuffle: form.shuffle,
    })
    setCreating(false)
    if (res.error) { toast.error(res.error); return }
    toast.success(t('quizCreated'))
    setShowCreate(false)
    setForm({ title: '', description: '', course_period_id: '', show_correct_answers: false, shuffle: false })
    mutate()
  }

  const handleDelete = async (quiz: Quiz) => {
    if (!confirm(t('deleteQuizConfirm', { title: quiz.title }))) return
    setDeletingId(quiz.id)
    const res = await deleteQuiz(quiz.id)
    setDeletingId(null)
    if (res.error) { toast.error(res.error); return }
    toast.success(t('quizDeleted'))
    mutate()
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('pageTitle')}</h1>
          <p className="text-muted-foreground mt-1">{t('pageSubtitle')}</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-2" /> {t('newQuiz')}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : quizzes.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <HelpCircle className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
            <p className="font-medium text-muted-foreground">{t('noQuizzesCreatedYet')}</p>
            <p className="text-sm text-muted-foreground mt-1">{t('createFirstQuiz')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {quizzes.map(quiz => (
            <QuizRow
              key={quiz.id}
              quiz={quiz}
              schoolId={schoolId!}
              staffId={staffId!}
              expanded={expandedQuizId === quiz.id}
              onToggle={() => setExpandedQuizId(prev => prev === quiz.id ? null : quiz.id)}
              onDelete={() => handleDelete(quiz)}
              deleting={deletingId === quiz.id}
              onAddQuestion={() => setShowAddQuestion(quiz.id)}
            />
          ))}
        </div>
      )}

      {/* Create Quiz Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('createQuiz')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>{t('title')} <span className="text-red-500">*</span></Label>
              <Input
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder={t('quizTitlePlaceholder')}
              />
            </div>
            <div className="space-y-1">
              <Label>{t('description')}</Label>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px] resize-none"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder={t('optionalDescriptionPlaceholder')}
              />
            </div>
            <div className="space-y-1">
              <Label>{t('classOptional')}</Label>
              <Select value={form.course_period_id} onValueChange={v => setForm(f => ({ ...f, course_period_id: v === 'none' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder={t('selectClassPlaceholder')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('none')}</SelectItem>
                  {coursePeriods.map((cp: any) => (
                    <SelectItem key={cp.id} value={cp.id}>
                      {cp.courses?.title || cp.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.show_correct_answers}
                  onChange={e => setForm(f => ({ ...f, show_correct_answers: e.target.checked }))}
                />
                {t('showCorrectAnswers')}
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.shuffle}
                  onChange={e => setForm(f => ({ ...f, shuffle: e.target.checked }))}
                />
                {t('shuffleQuestions')}
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>{t('cancel')}</Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {t('creating')}</> : t('createQuiz')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Question Dialog */}
      {showAddQuestion && (
        <AddQuestionDialog
          quizId={showAddQuestion}
          schoolId={schoolId!}
          campusId={campusId}
          staffId={staffId!}
          onClose={() => setShowAddQuestion(null)}
          onAdded={() => { setShowAddQuestion(null); mutate() }}
        />
      )}
    </div>
  )
}

function QuizRow({
  quiz, schoolId, staffId, expanded, onToggle, onDelete, deleting, onAddQuestion
}: {
  quiz: Quiz
  schoolId: string
  staffId: string
  expanded: boolean
  onToggle: () => void
  onDelete: () => void
  deleting: boolean
  onAddQuestion: () => void
}) {
  const t = useTranslations('teacherPages.quiz')
  const { data: qRes, isLoading: loadingQ, mutate: mutateQ } = useSWR(
    expanded ? ['quiz-questions', quiz.id] : null,
    () => getQuizQuestions(quiz.id),
    { revalidateOnFocus: false }
  )

  const questions: QuizQuestionMap[] = qRes?.data || []
  const totalPoints = questions.reduce((s, q) => s + (q.points || 0), 0)

  const handleRemoveQuestion = async (mapId: string) => {
    const res = await removeQuestionFromQuiz(quiz.id, mapId)
    if (res.error) { toast.error(res.error); return }
    toast.success(t('questionRemoved'))
    mutateQ()
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div
          className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/40 transition-colors"
          onClick={onToggle}
        >
          <HelpCircle className="h-5 w-5 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold">{quiz.title}</p>
            <div className="flex items-center gap-2 mt-0.5">
              {quiz.question_count !== undefined && (
                <span className="text-xs text-muted-foreground">{t('questionCountBadge', { count: quiz.question_count })}</span>
              )}
              {quiz.show_correct_answers && (
                <Badge variant="secondary" className="text-xs">{t('answersShown')}</Badge>
              )}
              {quiz.shuffle && (
                <Badge variant="secondary" className="text-xs">{t('shuffled')}</Badge>
              )}
              <span className="text-xs text-muted-foreground">
                {format(parseISO(quiz.created_at), 'MMM d, yyyy')}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
              onClick={e => { e.stopPropagation(); onDelete() }}
              disabled={deleting}
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </Button>
            {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </div>

        {expanded && (
          <div className="border-t px-4 pb-4 pt-3 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                {t('questionsCount', { count: questions.length })}
                {totalPoints > 0 && <span className="text-muted-foreground ml-2">· {t('ptsTotal', { points: totalPoints })}</span>}
              </p>
              <Button size="sm" variant="outline" onClick={onAddQuestion} className="gap-1">
                <Plus className="h-3 w-3" /> {t('addQuestion')}
              </Button>
            </div>

            {loadingQ ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : questions.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                {t('noQuestionsYet')}
              </p>
            ) : (
              <div className="space-y-2">
                {questions.map((qm, i) => (
                  <div key={qm.id} className="flex items-start gap-2 p-3 rounded-lg border bg-muted/30">
                    <span className="text-xs text-muted-foreground w-5 shrink-0 mt-0.5">{i + 1}.</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">{qm.question?.title || t('unknownQuestion')}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {qm.question?.type && (
                          <Badge variant="outline" className="text-xs">
                            {QUESTION_TYPE_LABELS[qm.question.type]}
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">{t('ptsAbbrev', { count: qm.points })}</span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-red-400 hover:text-red-600 shrink-0"
                      onClick={() => handleRemoveQuestion(qm.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function AddQuestionDialog({
  quizId, schoolId, campusId, staffId, onClose, onAdded
}: {
  quizId: string
  schoolId: string
  campusId?: string
  staffId: string
  onClose: () => void
  onAdded: () => void
}) {
  const t = useTranslations('teacherPages.quiz')
  const [selectedId, setSelectedId] = useState('')
  const [points, setPoints] = useState('1')
  const [adding, setAdding] = useState(false)

  const { data: qRes, isLoading } = useSWR(
    ['quiz-question-bank', schoolId],
    () => getQuestions(schoolId, { campusId, createdBy: staffId }),
    { revalidateOnFocus: false }
  )

  const questions: QuizQuestion[] = qRes?.data || []

  const handleAdd = async () => {
    if (!selectedId) { toast.warning(t('selectAQuestion')); return }
    setAdding(true)
    const { data: existingQ } = await getQuizQuestions(quizId)
    const sortOrder = (existingQ?.length || 0) + 1
    const res = await addQuestionToQuiz(quizId, selectedId, Number(points) || 1, sortOrder)
    setAdding(false)
    if (res.error) { toast.error(res.error); return }
    toast.success(t('questionAdded'))
    onAdded()
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('addQuestionFromBank')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : questions.length === 0 ? (
            <div className="text-center py-6">
              <AlertCircle className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{t('noQuestionsInBank')}</p>
              <p className="text-xs text-muted-foreground mt-1">{t('createQuestionsInAdminFirst')}</p>
            </div>
          ) : (
            <div className="space-y-1">
              <Label>{t('selectQuestion')}</Label>
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger><SelectValue placeholder={t('chooseAQuestionPlaceholder')} /></SelectTrigger>
                <SelectContent>
                  {questions.map(q => (
                    <SelectItem key={q.id} value={q.id}>
                      <span className="truncate">{q.title}</span>
                      <span className="text-xs text-muted-foreground ml-2">({QUESTION_TYPE_LABELS[q.type]})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1">
            <Label>{t('points')}</Label>
            <Input
              type="number"
              min="0"
              value={points}
              onChange={e => setPoints(e.target.value)}
              className="max-w-[100px]"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('cancel')}</Button>
          <Button onClick={handleAdd} disabled={adding || questions.length === 0}>
            {adding ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {t('adding')}</> : t('addQuestion')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
