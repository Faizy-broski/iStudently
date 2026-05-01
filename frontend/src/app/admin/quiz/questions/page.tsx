'use client'
import { useState } from 'react'
import useSWR, { mutate as globalMutate } from 'swr'
import { useAuth } from '@/context/AuthContext'
import { useCampus } from '@/context/CampusContext'
import {
  getCategories,
  getQuestions,
  deleteCategory,
  deleteQuestion,
  createCategory,
  updateCategory,
  createQuestion,
  updateQuestion,
  QUESTION_TYPE_LABELS,
  type QuizCategory,
  type QuizQuestion,
  type QuestionType,
} from '@/lib/api/quiz'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Trash2, Pencil, FolderOpen, BookOpen, Search } from 'lucide-react'

const NONE = '__none__'

// ── Question Form ──────────────────────────────────────────────────────────────

function QuestionDialog({
  question,
  categories,
  schoolId,
  campusId,
  defaultCategoryId,
  onClose,
  onSaved,
}: {
  question?: QuizQuestion | null
  categories: QuizCategory[]
  schoolId: string
  campusId?: string | null
  defaultCategoryId?: string
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = !!question
  const [title, setTitle] = useState(question?.title ?? '')
  const [type, setType] = useState<QuestionType>(question?.type ?? 'select')
  const [description, setDescription] = useState(question?.description ?? '')
  const [answer, setAnswer] = useState(question?.answer ?? '')
  const [categoryId, setCategoryId] = useState(question?.category_id ?? defaultCategoryId ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const answerPlaceholder: Record<QuestionType, string> = {
    select: '*Correct option\nWrong option A\nWrong option B',
    multiple: '*Correct A\n*Correct B\nWrong C',
    gap: 'The sky is __blue__.\nThe grass is __green__.',
    text: 'Expected answer (case-insensitive)',
    textarea: '',
  }

  const handleSave = async () => {
    if (!title.trim()) { setError('Title is required'); return }
    setSaving(true); setError('')
    try {
      const payload = {
        school_id: schoolId,
        campus_id: campusId ?? null,
        category_id: categoryId || null,
        created_by: null,
        title: title.trim(),
        type,
        description: description.trim() || null,
        answer: answer.trim() || null,
        sort_order: question?.sort_order ?? 0,
      }
      if (isEdit && question) {
        await updateQuestion(question.id, payload)
      } else {
        await createQuestion(payload)
      }
      onSaved()
    } catch (e: any) {
      setError(e.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Question' : 'New Question'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Question *</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Question text" />
            </div>
            <div className="space-y-1">
              <Label>Type</Label>
              <Select value={type} onValueChange={v => { setType(v as QuestionType); setAnswer('') }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(QUESTION_TYPE_LABELS) as [QuestionType, string][]).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Category</Label>
            <Select value={categoryId || NONE} onValueChange={v => setCategoryId(v === NONE ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="— None —" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>— None —</SelectItem>
                {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Description (optional)</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Additional context shown before the question" />
          </div>

          {type !== 'textarea' && (
            <div className="space-y-1">
              <Label>
                {type === 'select' || type === 'multiple' ? 'Options (one per line, * = correct)' : type === 'gap' ? 'Text with gaps (use __answer__)' : 'Correct Answer'}
              </Label>
              <Textarea
                value={answer}
                onChange={e => setAnswer(e.target.value)}
                rows={5}
                placeholder={answerPlaceholder[type]}
                className="font-mono text-sm"
              />
              {(type === 'select' || type === 'multiple') && (
                <p className="text-xs text-muted-foreground">Prefix correct answer(s) with * e.g. <code>*True</code></p>
              )}
              {type === 'gap' && (
                <p className="text-xs text-muted-foreground">Delimit gaps with double underscores e.g. <code>The sky is __blue__.</code></p>
              )}
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Question'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Category Form ─────────────────────────────────────────────────────────────

function CategoryDialog({
  category,
  schoolId,
  campusId,
  onClose,
  onSaved,
}: {
  category?: QuizCategory | null
  schoolId: string
  campusId?: string | null
  onClose: () => void
  onSaved: () => void
}) {
  const [title, setTitle] = useState(category?.title ?? '')
  const [sortOrder, setSortOrder] = useState(String(category?.sort_order ?? 0))
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!title.trim()) return
    setSaving(true)
    try {
      if (category) {
        await updateCategory(category.id, { title: title.trim(), sort_order: Number(sortOrder) })
      } else {
        await createCategory({ school_id: schoolId, campus_id: campusId ?? null, title: title.trim(), sort_order: Number(sortOrder) })
      }
      onSaved()
    } finally { setSaving(false) }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{category ? 'Edit Category' : 'New Category'}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label>Title *</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Category name" />
          </div>
          <div className="space-y-1">
            <Label>Sort Order</Label>
            <Input type="number" value={sortOrder} onChange={e => setSortOrder(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !title.trim()}>{saving ? 'Saving…' : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function QuestionsPage() {
  const { profile } = useAuth()
  const { selectedCampus } = useCampus()
  const schoolId = profile?.school_id ?? ''
  const campusId = selectedCampus?.id ?? null

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const [catDialogOpen, setCatDialogOpen] = useState(false)
  const [editCategory, setEditCategory] = useState<QuizCategory | null>(null)
  const [deleteCatId, setDeleteCatId] = useState<string | null>(null)

  const [qDialogOpen, setQDialogOpen] = useState(false)
  const [editQuestion, setEditQuestion] = useState<QuizQuestion | null>(null)
  const [deleteQId, setDeleteQId] = useState<string | null>(null)

  const catKey = ['quiz-categories', schoolId, campusId]
  const qKey = ['quiz-questions', schoolId, campusId, selectedCategoryId, search]

  const { data: categories, isLoading: catLoading } = useSWR(
    schoolId ? catKey : null,
    () => getCategories(schoolId, campusId).then(r => r.data ?? [])
  )

  const { data: questions, isLoading: qLoading } = useSWR(
    schoolId ? qKey : null,
    () =>
      getQuestions(schoolId, {
        campusId,
        categoryId: selectedCategoryId ?? undefined,
        search: search || undefined,
      }).then(r => r.data ?? [])
  )

  const refreshAll = () => { globalMutate(catKey); globalMutate(qKey) }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Question Bank</h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* ── Categories Sidebar ── */}
        <Card className="md:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-1"><FolderOpen className="w-4 h-4" /> Categories</span>
              <Button size="sm" variant="ghost" onClick={() => { setEditCategory(null); setCatDialogOpen(true) }}>
                <Plus className="w-3 h-3" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-1">
            <button
              onClick={() => setSelectedCategoryId(null)}
              className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${!selectedCategoryId ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
            >
              All Questions
            </button>
            {catLoading
              ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)
              : (categories ?? []).map(c => (
                  <div key={c.id} className="flex items-center group">
                    <button
                      onClick={() => setSelectedCategoryId(c.id)}
                      className={`flex-1 text-left px-3 py-2 rounded-md text-sm transition-colors ${selectedCategoryId === c.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                    >
                      {c.title}
                    </button>
                    <div className="flex opacity-0 group-hover:opacity-100 gap-0.5">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => { setEditCategory(c); setCatDialogOpen(true) }}
                      >
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive"
                        onClick={() => setDeleteCatId(c.id)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
          </CardContent>
        </Card>

        {/* ── Questions List ── */}
        <Card className="md:col-span-3">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <BookOpen className="w-4 h-4" />
                {selectedCategoryId
                  ? (categories ?? []).find(c => c.id === selectedCategoryId)?.title ?? 'Questions'
                  : 'All Questions'}
              </CardTitle>
              <Button size="sm" onClick={() => { setEditQuestion(null); setQDialogOpen(true) }}>
                <Plus className="w-3 h-3 mr-1" /> Add Question
              </Button>
            </div>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search questions…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            {qLoading
              ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)
              : (questions ?? []).length === 0
              ? <p className="text-center py-8 text-muted-foreground text-sm">No questions found.</p>
              : (questions ?? []).map(q => (
                  <div key={q.id} className="border rounded-md px-4 py-3 flex items-start justify-between gap-2 hover:bg-muted/30 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{q.title}</p>
                      <div className="flex gap-2 mt-1 flex-wrap">
                        <Badge variant="secondary" className="text-xs">{QUESTION_TYPE_LABELS[q.type]}</Badge>
                        {q.category && (
                          <Badge variant="outline" className="text-xs">{q.category.title}</Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => { setEditQuestion(q); setQDialogOpen(true) }}
                      >
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive"
                        onClick={() => setDeleteQId(q.id)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
          </CardContent>
        </Card>
      </div>

      {/* Dialogs */}
      {catDialogOpen && (
        <CategoryDialog
          category={editCategory}
          schoolId={schoolId}
          campusId={campusId}
          onClose={() => { setCatDialogOpen(false); setEditCategory(null) }}
          onSaved={() => { refreshAll(); setCatDialogOpen(false); setEditCategory(null) }}
        />
      )}

      {qDialogOpen && (
        <QuestionDialog
          question={editQuestion}
          categories={categories ?? []}
          schoolId={schoolId}
          campusId={campusId}
          defaultCategoryId={selectedCategoryId ?? undefined}
          onClose={() => { setQDialogOpen(false); setEditQuestion(null) }}
          onSaved={() => { globalMutate(qKey); setQDialogOpen(false); setEditQuestion(null) }}
        />
      )}

      <AlertDialog open={!!deleteCatId} onOpenChange={() => setDeleteCatId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Category?</AlertDialogTitle>
            <AlertDialogDescription>Questions in this category will be unassigned, not deleted.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={async () => { await deleteCategory(deleteCatId!); refreshAll(); setDeleteCatId(null) }}
            >Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteQId} onOpenChange={() => setDeleteQId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Question?</AlertDialogTitle>
            <AlertDialogDescription>This will remove the question from all quizzes it belongs to.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={async () => { await deleteQuestion(deleteQId!); globalMutate(qKey); setDeleteQId(null) }}
            >Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
