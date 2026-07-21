'use client'
import { useState, useRef, useCallback } from 'react'
import useSWR from 'swr'
import { useAuth } from '@/context/AuthContext'
import { useCampus } from '@/context/CampusContext'
import {
  extractQuestions,
  generateQuestionsAI,
  bulkCreateQuestions,
  getChapters,
  QUESTION_TYPE_LABELS,
  DIFFICULTY_LABELS,
  type DraftQuestion,
  type QuestionType,
  type DifficultyLevel,
} from '@/lib/api/quiz'
import { getGradeLevels, getSubjects } from '@/lib/api/academics'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import {
  Upload,
  Sparkles,
  FileText,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowLeft,
  Save,
  Trash2,
} from 'lucide-react'
import Link from 'next/link'

const NONE = '__none__'
const ALL_TYPES = Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]

// ── Draft Review Table ────────────────────────────────────────────────────────

function DraftTable({
  drafts,
  selected,
  onToggle,
  onToggleAll,
  onEdit,
  onDelete,
}: {
  drafts: DraftQuestion[]
  selected: Set<number>
  onToggle: (idx: number) => void
  onToggleAll: () => void
  onEdit: (idx: number, field: keyof DraftQuestion, value: string) => void
  onDelete: (idx: number) => void
}) {
  const allSelected = drafts.length > 0 && selected.size === drafts.length

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-3 py-2 text-left w-10">
                <Checkbox checked={allSelected} onCheckedChange={onToggleAll} />
              </th>
              <th className="px-3 py-2 text-left">#</th>
              <th className="px-3 py-2 text-left min-w-[200px]">Question</th>
              <th className="px-3 py-2 text-left w-32">Type</th>
              <th className="px-3 py-2 text-left w-24">Difficulty</th>
              <th className="px-3 py-2 text-left min-w-[200px]">Answer</th>
              <th className="px-3 py-2 text-left w-16">Actions</th>
            </tr>
          </thead>
          <tbody>
            {drafts.map((d, idx) => (
              <tr key={idx} className={`border-t ${selected.has(idx) ? 'bg-primary/5' : ''}`}>
                <td className="px-3 py-2">
                  <Checkbox checked={selected.has(idx)} onCheckedChange={() => onToggle(idx)} />
                </td>
                <td className="px-3 py-2 text-muted-foreground">{idx + 1}</td>
                <td className="px-3 py-2">
                  <Input
                    value={d.title}
                    onChange={e => onEdit(idx, 'title', e.target.value)}
                    className="h-8 text-sm"
                  />
                </td>
                <td className="px-3 py-2">
                  <Select value={d.type} onValueChange={v => onEdit(idx, 'type', v)}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ALL_TYPES.map(t => (
                        <SelectItem key={t} value={t}>{QUESTION_TYPE_LABELS[t]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-3 py-2">
                  <Select value={d.difficulty_level} onValueChange={v => onEdit(idx, 'difficulty_level', v)}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(DIFFICULTY_LABELS) as DifficultyLevel[]).map(dl => (
                        <SelectItem key={dl} value={dl}>{DIFFICULTY_LABELS[dl]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-3 py-2">
                  <Textarea
                    value={d.answer}
                    onChange={e => onEdit(idx, 'answer', e.target.value)}
                    className="h-16 text-xs font-mono min-w-[200px]"
                    rows={2}
                  />
                </td>
                <td className="px-3 py-2">
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => onDelete(idx)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function BulkImportPage() {
  const { profile } = useAuth()
  const { selectedCampus } = useCampus()
  const schoolId = profile?.school_id ?? ''
  const campusId = selectedCampus?.id ?? null
  const activeContextId = campusId ?? schoolId

  // ── Shared state ──
  const [gradeLevelId, setGradeLevelId] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [chapterId, setChapterId] = useState('')
  const [selectedTypes, setSelectedTypes] = useState<QuestionType[]>([...ALL_TYPES])

  // ── Drafts state ──
  const [drafts, setDrafts] = useState<DraftQuestion[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // ── Generate state ──
  const [count, setCount] = useState(10)
  const [freePrompt, setFreePrompt] = useState('')

  // ── File upload ──
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)

  // ── Data fetches ──
  const { data: gradeLevels } = useSWR(
    activeContextId ? ['grade-levels-bi', activeContextId] : null,
    () => getGradeLevels(activeContextId).then(r => r.data ?? [])
  )
  const { data: subjects } = useSWR(
    gradeLevelId ? ['subjects-bi', gradeLevelId, activeContextId] : null,
    () => getSubjects(gradeLevelId, activeContextId).then(r => r.data ?? [])
  )
  const { data: chapters } = useSWR(
    subjectId && schoolId ? ['chapters-bi', subjectId, schoolId] : null,
    () => getChapters(subjectId, schoolId).then(r => r.data ?? [])
  )

  // ── Type toggle ──
  const toggleType = (t: QuestionType) => {
    setSelectedTypes(prev =>
      prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]
    )
  }

  // ── Draft management ──
  const toggleDraft = (idx: number) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(idx) ? next.delete(idx) : next.add(idx)
      return next
    })
  }
  const toggleAll = () => {
    if (selected.size === drafts.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(drafts.map((_, i) => i)))
    }
  }
  const editDraft = (idx: number, field: keyof DraftQuestion, value: string) => {
    setDrafts(prev => {
      const next = [...prev]
      next[idx] = { ...next[idx], [field]: value }
      return next
    })
  }
  const deleteDraft = (idx: number) => {
    setDrafts(prev => prev.filter((_, i) => i !== idx))
    setSelected(prev => {
      const next = new Set<number>()
      prev.forEach(i => {
        if (i < idx) next.add(i)
        else if (i > idx) next.add(i - 1)
      })
      return next
    })
  }

  // ── Extract from file ──
  const handleExtract = useCallback(async () => {
    if (!uploadedFile) { setError('Please select a file first'); return }
    setLoading(true); setError(''); setSuccess('')
    try {
      const res = await extractQuestions(uploadedFile, {
        allowedTypes: selectedTypes,
        gradeLevelId: gradeLevelId || undefined,
        subjectId: subjectId || undefined,
        chapterId: chapterId || undefined,
      })
      if (res.error) { setError(res.error); return }
      const data = res.data ?? []
      setDrafts(data)
      setSelected(new Set(data.map((_, i) => i)))
      setSuccess(`Extracted ${data.length} question(s) from document`)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [uploadedFile, selectedTypes, gradeLevelId, subjectId, chapterId])

  // ── Generate with AI ──
  const handleGenerate = useCallback(async () => {
    setLoading(true); setError(''); setSuccess('')
    try {
      const res = await generateQuestionsAI({
        school_id: schoolId,
        grade_level_id: gradeLevelId || null,
        subject_id: subjectId || null,
        chapter_ids: chapterId ? [chapterId] : [],
        count,
        allowed_types: selectedTypes,
        prompt: freePrompt || undefined,
      })
      if (res.error) { setError(res.error); return }
      const data = res.data ?? []
      setDrafts(data)
      setSelected(new Set(data.map((_, i) => i)))
      setSuccess(`Generated ${data.length} question(s)`)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [schoolId, gradeLevelId, subjectId, chapterId, count, selectedTypes, freePrompt])

  // ── Save selected drafts ──
  const handleSave = useCallback(async () => {
    const toSave = drafts.filter((_, i) => selected.has(i))
    if (toSave.length === 0) { setError('No questions selected'); return }
    setSaving(true); setError(''); setSuccess('')
    try {
      const questions = toSave.map((d, i) => ({
        school_id: schoolId,
        campus_id: campusId ?? null,
        category_id: null,
        created_by: null,
        title: d.title,
        type: d.type,
        description: d.description || null,
        answer: d.answer || null,
        sort_order: i,
        grade_level_id: gradeLevelId || null,
        subject_id: subjectId || null,
        chapter_id: chapterId || null,
        difficulty_level: d.difficulty_level || 'medium',
      }))
      const res = await bulkCreateQuestions(questions as any)
      if (res.error) { setError(res.error); return }
      const savedCount = (res.data ?? []).length
      setSuccess(`Successfully saved ${savedCount} question(s) to the bank!`)
      setDrafts([])
      setSelected(new Set())
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }, [drafts, selected, schoolId, campusId, gradeLevelId, subjectId, chapterId])

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin/quiz/questions">
          <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">AI Question Import</h1>
          <p className="text-sm text-muted-foreground">Extract questions from documents or generate them with AI</p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Context &amp; Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label>Grade Level</Label>
              <Select value={gradeLevelId || NONE} onValueChange={v => { setGradeLevelId(v === NONE ? '' : v); setSubjectId(''); setChapterId('') }}>
                <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Any</SelectItem>
                  {(gradeLevels ?? []).map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Subject</Label>
              <Select value={subjectId || NONE} onValueChange={v => { setSubjectId(v === NONE ? '' : v); setChapterId('') }} disabled={!gradeLevelId}>
                <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Any</SelectItem>
                  {(subjects ?? []).map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Chapter</Label>
              <Select value={chapterId || NONE} onValueChange={v => setChapterId(v === NONE ? '' : v)} disabled={!subjectId}>
                <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Any</SelectItem>
                  {(chapters ?? []).map(c => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-4">
            <Label className="mb-2 block">Question Types</Label>
            <div className="flex flex-wrap gap-2">
              {ALL_TYPES.map(t => (
                <Badge
                  key={t}
                  variant={selectedTypes.includes(t) ? 'default' : 'outline'}
                  className="cursor-pointer select-none"
                  onClick={() => toggleType(t)}
                >
                  {QUESTION_TYPE_LABELS[t]}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs: Extract / Generate */}
      <Tabs defaultValue="extract">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="extract" className="flex items-center gap-2">
            <Upload className="w-4 h-4" /> Import from File
          </TabsTrigger>
          <TabsTrigger value="generate" className="flex items-center gap-2">
            <Sparkles className="w-4 h-4" /> Generate with AI
          </TabsTrigger>
        </TabsList>

        <TabsContent value="extract" className="mt-4">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="border-2 border-dashed rounded-lg p-8 text-center space-y-3">
                <FileText className="w-10 h-10 mx-auto text-muted-foreground" />
                <div>
                  <p className="font-medium">Upload a document</p>
                  <p className="text-sm text-muted-foreground">PDF, Word (.docx), or image (JPG, PNG, WebP)</p>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.docx,image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={e => { setUploadedFile(e.target.files?.[0] ?? null); setError('') }}
                />
                <Button variant="outline" onClick={() => fileRef.current?.click()}>
                  Choose File
                </Button>
                {uploadedFile && (
                  <p className="text-sm font-medium text-primary">{uploadedFile.name} ({(uploadedFile.size / 1024).toFixed(0)} KB)</p>
                )}
              </div>
              <Button
                onClick={handleExtract}
                disabled={loading || !uploadedFile}
                className="w-full"
              >
                {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Extracting…</> : <><Upload className="w-4 h-4 mr-2" /> Extract Questions</>}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="generate" className="mt-4">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Number of Questions</Label>
                  <Input
                    type="number"
                    min={1}
                    max={50}
                    value={count}
                    onChange={e => setCount(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Additional Instructions (optional)</Label>
                  <Input
                    placeholder="e.g. make them tricky, word problems only…"
                    value={freePrompt}
                    onChange={e => setFreePrompt(e.target.value)}
                  />
                </div>
              </div>
              <Button
                onClick={handleGenerate}
                disabled={loading || selectedTypes.length === 0}
                className="w-full"
              >
                {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating…</> : <><Sparkles className="w-4 h-4 mr-2" /> Generate Questions</>}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Messages */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          <XCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 text-emerald-700 text-sm dark:bg-emerald-950 dark:text-emerald-300">
          <CheckCircle2 className="w-4 h-4 shrink-0" /> {success}
        </div>
      )}

      {/* Draft review table */}
      {drafts.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                Review Questions ({selected.size} of {drafts.length} selected)
              </CardTitle>
              <Button onClick={handleSave} disabled={saving || selected.size === 0}>
                {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…</> : <><Save className="w-4 h-4 mr-2" /> Save Selected ({selected.size})</>}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <DraftTable
              drafts={drafts}
              selected={selected}
              onToggle={toggleDraft}
              onToggleAll={toggleAll}
              onEdit={editDraft}
              onDelete={deleteDraft}
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
