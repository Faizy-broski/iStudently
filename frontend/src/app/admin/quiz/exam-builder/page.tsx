'use client'
import { useState, useCallback, useMemo } from 'react'
import useSWR from 'swr'
import { useAuth } from '@/context/AuthContext'
import { useCampus } from '@/context/CampusContext'
import {
  getQuestions,
  getChapters,
  QUESTION_TYPE_LABELS,
  DIFFICULTY_LABELS,
  type QuizQuestion,
  type QuestionType,
  type DifficultyLevel,
} from '@/lib/api/quiz'
import { getGradeLevels, getSubjects } from '@/lib/api/academics'
import { getPdfHeaderFooter } from '@/lib/api/school-settings'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import {
  Search,
  Plus,
  Printer,
  ArrowLeft,
  FileText,
  CheckCircle,
  HelpCircle,
  Sparkles,
} from 'lucide-react'
import Link from 'next/link'
import { ExamHeaderSetup, ExamHeaderConfig } from '@/components/admin/quiz/ExamHeaderSetup'
import { RichTextQuestionEditor, EditableQuestionItem } from '@/components/admin/quiz/RichTextQuestionEditor'
import { generateAndPrintExam, ExamPrintMode } from '@/lib/utils/examPrintEngine'
import { toast } from 'sonner'

const NONE = '__none__'

export default function ExamBuilderPage() {
  const { profile } = useAuth()
  const { selectedCampus } = useCampus()
  const schoolId = profile?.school_id ?? ''
  const campusId = selectedCampus?.id ?? null
  const activeContextId = campusId ?? schoolId

  // ── Header & Setup State ──
  const [headerConfig, setHeaderConfig] = useState<ExamHeaderConfig>({
    material: '',
    semester: 'Second semester',
    exam_type: 'final exam',
    exam_date: new Date().toISOString().split('T')[0],
    school_name: selectedCampus?.name || profile?.school_name || 'School',
    education_monitoring: 'مراقبة التعليم - Education Monitoring',
    classroom: '',
    duration: '2 Hours',
    academic_year: '2026-2027',
    total_marks: 100,
    auto_calculate_marks: true,
    teacher_name: profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : '',
    exam_instructions: 'Answer all questions. No calculators allowed. Write clearly.',
  })

  // ── Print Mode State (Student Copy vs Answer Key) ──
  const [printMode, setPrintMode] = useState<ExamPrintMode>('student')

  // ── Question Bank Filters ──
  const [filterGrade, setFilterGrade] = useState('')
  const [filterSubject, setFilterSubject] = useState('')
  const [filterChapter, setFilterChapter] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterDifficulty, setFilterDifficulty] = useState('')
  const [filterSearch, setFilterSearch] = useState('')

  // ── Exam Question Items ──
  const [editableItems, setEditableItems] = useState<EditableQuestionItem[]>([])

  // ── Data Fetches ──
  const { data: gradeLevels } = useSWR(
    activeContextId ? ['gl-eb', activeContextId] : null,
    () => getGradeLevels(activeContextId).then(r => r.data ?? [])
  )
  const { data: subjects } = useSWR(
    filterGrade ? ['subj-eb', filterGrade, activeContextId] : null,
    () => getSubjects(filterGrade, activeContextId).then(r => r.data ?? [])
  )
  const { data: chapters } = useSWR(
    filterSubject && schoolId ? ['ch-eb', filterSubject, schoolId] : null,
    () => getChapters(filterSubject, schoolId).then(r => r.data ?? [])
  )

  const { data: bankQuestions, isLoading: bankLoading } = useSWR(
    schoolId ? ['bank-eb', schoolId, campusId, filterGrade, filterSubject, filterChapter, filterType, filterDifficulty, filterSearch] : null,
    () =>
      getQuestions(schoolId, {
        campusId,
        gradeLevelId: filterGrade || undefined,
        subjectId: filterSubject || undefined,
        chapterId: filterChapter || undefined,
        difficulty: (filterDifficulty || undefined) as DifficultyLevel | undefined,
        search: filterSearch || undefined,
      }).then(r => r.data ?? [])
  )

  const { data: pdfSettings } = useSWR(
    schoolId ? ['pdf-settings-eb', campusId] : null,
    () => getPdfHeaderFooter(campusId).then(r => r.data ?? null)
  )

  // ── Calculations ──
  const selectedIds = useMemo(() => new Set(editableItems.map(i => i.id)), [editableItems])
  const calculatedTotalPoints = useMemo(
    () => editableItems.reduce((sum, item) => sum + (item.allocated_marks || 0), 0),
    [editableItems]
  )

  // ── Actions ──
  const addQuestionFromBank = useCallback((q: QuizQuestion) => {
    if (selectedIds.has(q.id)) return

    const newItem: EditableQuestionItem = {
      id: q.id,
      title: q.title || '',
      type: q.type || 'select',
      description: q.description || undefined,
      allocated_marks: q.allocated_marks || 10,
      image_url: q.image_url || null,
      correct_answer: q.correct_answer || (q.type === 'select' ? 'Option 1' : null),
      blank_lines_count: q.blank_lines_count || (q.type === 'textarea' ? 6 : 0),
      answer_options: (q.answer || '').split('\n').filter(Boolean).map(o => o.replace(/^\*/, '')),
    }

    setEditableItems(prev => [...prev, newItem])
    toast.success('Question added to exam paper')
  }, [selectedIds])

  const createNewBlankQuestion = useCallback(() => {
    const newId = `custom-${Date.now()}`
    const newItem: EditableQuestionItem = {
      id: newId,
      title: 'Enter question text here...',
      type: 'select',
      allocated_marks: 10,
      image_url: null,
      correct_answer: 'Option 1',
      blank_lines_count: 0,
      answer_options: ['Option 1', 'Option 2', 'Option 3', 'Option 4'],
    }

    setEditableItems(prev => [...prev, newItem])
  }, [])

  const updateItem = useCallback((index: number, updated: EditableQuestionItem) => {
    setEditableItems(prev => {
      const next = [...prev]
      next[index] = updated
      return next
    })
  }, [])

  const removeItem = useCallback((index: number) => {
    setEditableItems(prev => prev.filter((_, i) => i !== index))
  }, [])

  // ── Header Config Update Handler ──
  const updateHeaderConfig = useCallback((updated: Partial<ExamHeaderConfig>) => {
    setHeaderConfig(prev => ({ ...prev, ...updated }))
  }, [])

  // ── Print & PDF Execution ──
  const handlePrintExam = useCallback((overrideMode?: ExamPrintMode) => {
    if (editableItems.length === 0) {
      toast.error('Please add at least one question before printing')
      return
    }

    const modeToUse = overrideMode || printMode
    const schoolLogo = selectedCampus?.logo_url || pdfSettings?.header_logo_url || null
    const ministryLogo = pdfSettings?.footer_logo_url || null

    generateAndPrintExam({
      headerConfig,
      items: editableItems,
      mode: modeToUse,
      schoolLogoUrl: schoolLogo,
      ministryLogoUrl: ministryLogo,
    })
  }, [editableItems, printMode, headerConfig, selectedCampus, pdfSettings])

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1500px] mx-auto">
      {/* Top Bar Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div className="flex items-center gap-3">
          <Link href="/admin/quiz/questions">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <FileText className="w-6 h-6 text-primary" /> Exam Builder & Paper Creator
            </h1>
            <p className="text-sm text-muted-foreground">
              Design officially compliant school exam papers, rich math questions, and generate Answer Keys automatically
            </p>
          </div>
        </div>

        {/* Dual Print Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={printMode} onValueChange={v => setPrintMode(v as ExamPrintMode)}>
            <SelectTrigger className="h-9 text-xs w-[200px]">
              <SelectValue placeholder="Print Mode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="student">Student Copy (نسخة الطالب)</SelectItem>
              <SelectItem value="teacher_key">Answer Key (نموذج الإجابة)</SelectItem>
            </SelectContent>
          </Select>

          <Button onClick={() => handlePrintExam()} disabled={editableItems.length === 0} className="h-9 gap-1.5">
            <Printer className="w-4 h-4" />
            Print {printMode === 'teacher_key' ? 'Answer Key' : 'Student Paper'}
          </Button>
        </div>
      </div>

      {/* Official Header Configuration Section */}
      <ExamHeaderSetup
        config={headerConfig}
        onChange={updateHeaderConfig}
        calculatedTotalPoints={calculatedTotalPoints}
      />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* ── LEFT: Question Bank ── */}
        <Card className="lg:col-span-2 border shadow-sm">
          <CardHeader className="pb-3 border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Question Bank</CardTitle>
              <Badge variant="secondary" className="text-xs">
                {(bankQuestions ?? []).filter(q => !selectedIds.has(q.id)).length} available
              </Badge>
            </div>

            {/* Bank Filters */}
            <div className="grid grid-cols-2 gap-2 mt-3">
              <Select value={filterGrade || NONE} onValueChange={v => { setFilterGrade(v === NONE ? '' : v); setFilterSubject(''); setFilterChapter('') }}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Grade Level" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>All Grades</SelectItem>
                  {(gradeLevels ?? []).map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                </SelectContent>
              </Select>

              <Select value={filterSubject || NONE} onValueChange={v => { setFilterSubject(v === NONE ? '' : v); setFilterChapter('') }} disabled={!filterGrade}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Subject" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>All Subjects</SelectItem>
                  {(subjects ?? []).map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>

              <Select value={filterType || NONE} onValueChange={v => setFilterType(v === NONE ? '' : v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Question Type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>All Types</SelectItem>
                  {(Object.entries(QUESTION_TYPE_LABELS) as [QuestionType, string][]).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterDifficulty || NONE} onValueChange={v => setFilterDifficulty(v === NONE ? '' : v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Difficulty" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>All Difficulties</SelectItem>
                  {(Object.keys(DIFFICULTY_LABELS) as DifficultyLevel[]).map(d => (
                    <SelectItem key={d} value={d}>{DIFFICULTY_LABELS[d]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="relative mt-2">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                className="pl-8 h-8 text-xs"
                placeholder="Search questions by keyword..."
                value={filterSearch}
                onChange={e => setFilterSearch(e.target.value)}
              />
            </div>
          </CardHeader>

          <CardContent className="p-3 space-y-2 max-h-[650px] overflow-y-auto">
            {bankLoading ? (
              Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)
            ) : (bankQuestions ?? []).filter(q => !selectedIds.has(q.id)).length === 0 ? (
              <div className="text-center py-12 space-y-2">
                <HelpCircle className="w-8 h-8 text-muted-foreground mx-auto" />
                <p className="text-sm font-medium text-muted-foreground">No questions found matching criteria</p>
              </div>
            ) : (
              (bankQuestions ?? [])
                .filter(q => !selectedIds.has(q.id))
                .filter(q => !filterType || q.type === filterType)
                .map(q => (
                  <div
                    key={q.id}
                    className="border rounded-lg p-3 bg-card hover:bg-muted/30 transition-all flex items-start justify-between gap-3 group"
                  >
                    <div className="flex-1 min-w-0 space-y-1">
                      <p className="font-medium text-xs line-clamp-2">{q.title}</p>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="secondary" className="text-[10px] px-1.5">
                          {QUESTION_TYPE_LABELS[q.type]}
                        </Badge>
                        {q.difficulty_level && (
                          <Badge variant="outline" className="text-[10px] px-1.5">
                            {DIFFICULTY_LABELS[q.difficulty_level]}
                          </Badge>
                        )}
                        <span className="text-[10px] text-muted-foreground">
                          [{q.allocated_marks || 10} pts]
                        </span>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs shrink-0 group-hover:bg-primary group-hover:text-primary-foreground"
                      onClick={() => addQuestionFromBank(q)}
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" /> Add
                    </Button>
                  </div>
                ))
            )}
          </CardContent>
        </Card>

        {/* ── RIGHT: Exam Paper Questions Editor ── */}
        <Card className="lg:col-span-3 border shadow-sm">
          <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">Exam Paper Questions Editor</CardTitle>
              <p className="text-xs text-muted-foreground">
                {editableItems.length} Question(s) | Total Points: {calculatedTotalPoints} pts
              </p>
            </div>

            <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={createNewBlankQuestion}>
              <Plus className="w-3.5 h-3.5" /> Add Blank Question
            </Button>
          </CardHeader>

          <CardContent className="p-4 space-y-4 max-h-[750px] overflow-y-auto">
            {editableItems.length === 0 ? (
              <div className="text-center py-16 border-2 border-dashed rounded-xl p-8 space-y-3">
                <Sparkles className="w-10 h-10 text-primary mx-auto opacity-70" />
                <h3 className="font-semibold text-base">Your Exam Paper is Empty</h3>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  Add questions from the left Question Bank or click "Add Blank Question" to create math, essay, or multiple choice questions.
                </p>
                <Button size="sm" onClick={createNewBlankQuestion} className="gap-1 mt-2">
                  <Plus className="w-4 h-4" /> Create Custom Question
                </Button>
              </div>
            ) : (
              editableItems.map((item, idx) => (
                <RichTextQuestionEditor
                  key={item.id}
                  question={item}
                  index={idx}
                  onChange={updated => updateItem(idx, updated)}
                  onRemove={() => removeItem(idx)}
                />
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
