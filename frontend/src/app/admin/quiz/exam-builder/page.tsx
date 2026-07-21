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
import { openPrintPreview } from '@/lib/utils/printLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  X,
  GripVertical,
  Printer,
  ArrowLeft,
  FileText,
} from 'lucide-react'
import Link from 'next/link'

const NONE = '__none__'

// ── Exam Question Item ────────────────────────────────────────────────────────

interface ExamItem {
  question: QuizQuestion
  points: number
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ExamBuilderPage() {
  const { profile } = useAuth()
  const { selectedCampus } = useCampus()
  const schoolId = profile?.school_id ?? ''
  const campusId = selectedCampus?.id ?? null
  const activeContextId = campusId ?? schoolId

  // ── Exam metadata ──
  const [examTitle, setExamTitle] = useState('')
  const [examDate, setExamDate] = useState('')
  const [teacherName, setTeacherName] = useState('')

  // ── Filters ──
  const [filterGrade, setFilterGrade] = useState('')
  const [filterSubject, setFilterSubject] = useState('')
  const [filterChapter, setFilterChapter] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterDifficulty, setFilterDifficulty] = useState('')
  const [filterSearch, setFilterSearch] = useState('')

  // ── Selected questions ──
  const [examItems, setExamItems] = useState<ExamItem[]>([])

  // ── Data fetches ──
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

  // ── Derived ──
  const selectedIds = useMemo(() => new Set(examItems.map(i => i.question.id)), [examItems])
  const totalPoints = useMemo(() => examItems.reduce((s, i) => s + i.points, 0), [examItems])

  // ── Actions ──
  const addQuestion = useCallback((q: QuizQuestion) => {
    if (selectedIds.has(q.id)) return
    setExamItems(prev => [...prev, { question: q, points: 10 }])
  }, [selectedIds])

  const removeQuestion = useCallback((idx: number) => {
    setExamItems(prev => prev.filter((_, i) => i !== idx))
  }, [])

  const updatePoints = useCallback((idx: number, pts: number) => {
    setExamItems(prev => {
      const next = [...prev]
      next[idx] = { ...next[idx], points: pts }
      return next
    })
  }, [])

  const moveItem = useCallback((from: number, to: number) => {
    setExamItems(prev => {
      const next = [...prev]
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item)
      return next
    })
  }, [])

  // ── Print / Download ──
  const handlePrint = useCallback(() => {
    if (examItems.length === 0) return

    const school = selectedCampus || {
      name: profile?.school_name || 'School',
      logo_url: null,
    }

    const examHeaderHtml = `
      <div style="text-align:center;margin:20px 0 24px;font-family:'Segoe UI',Arial,sans-serif;">
        <h1 style="font-size:22px;font-weight:700;color:#1e3a5f;margin:0 0 8px;">${examTitle || 'Examination'}</h1>
        <div style="display:flex;justify-content:center;gap:32px;font-size:13px;color:#444;">
          ${examDate ? `<span><strong>Date:</strong> ${examDate}</span>` : ''}
          ${teacherName ? `<span><strong>Teacher:</strong> ${teacherName}</span>` : ''}
          <span><strong>Total Points:</strong> ${totalPoints}</span>
        </div>
        <div style="margin-top:12px;padding-top:8px;border-top:1px solid #e2e8f0;">
          <div style="display:flex;gap:24px;justify-content:center;font-size:12px;color:#666;">
            <span><strong>Student Name:</strong> ___________________________</span>
            <span><strong>Class:</strong> __________</span>
          </div>
        </div>
      </div>
    `

    const questionsHtml = examItems.map((item, idx) => {
      const q = item.question
      const num = idx + 1
      let answerSpace = ''

      // Render answer area based on question type
      switch (q.type) {
        case 'select':
        case 'multiple': {
          const options = (q.answer || '').split('\n').filter(Boolean).map(o => o.replace(/^\*/, ''))
          const isMulti = q.type === 'multiple'
          answerSpace = options.map((opt, oi) =>
            `<div style="margin:6px 0 6px 20px;display:flex;align-items:center;gap:8px;">
              <span style="display:inline-block;width:16px;height:16px;border:1.5px solid #888;${isMulti ? 'border-radius:3px;' : 'border-radius:50%;'}"></span>
              <span style="font-size:13px;">${opt.trim()}</span>
            </div>`
          ).join('')
          break
        }
        case 'gap': {
          const gapText = (q.answer || '').replace(/__(.+?)__/g, '________________')
          answerSpace = `<div style="margin:8px 0 8px 20px;font-size:13px;line-height:2;">${gapText}</div>`
          break
        }
        case 'matching': {
          const pairs = (q.answer || '').split('\n').filter(Boolean).map(l => l.split('::'))
          const leftItems = pairs.map(p => p[0]?.trim() || '')
          const rightItems = pairs.map(p => p[1]?.trim() || '').sort(() => Math.random() - 0.5)
          answerSpace = `
            <div style="margin:8px 0 8px 20px;display:flex;gap:40px;">
              <div>
                <div style="font-size:11px;text-transform:uppercase;color:#666;margin-bottom:4px;">Column A</div>
                ${leftItems.map((l, i) => `<div style="margin:4px 0;font-size:13px;">${i + 1}. ${l} ________</div>`).join('')}
              </div>
              <div>
                <div style="font-size:11px;text-transform:uppercase;color:#666;margin-bottom:4px;">Column B</div>
                ${rightItems.map((r, i) => `<div style="margin:4px 0;font-size:13px;">${String.fromCharCode(65 + i)}. ${r}</div>`).join('')}
              </div>
            </div>
          `
          break
        }
        case 'text':
          answerSpace = `<div style="margin:8px 0 8px 20px;border-bottom:1px solid #ccc;height:24px;"></div>`
          break
        case 'textarea':
          answerSpace = `<div style="margin:8px 0 8px 20px;">
            ${Array.from({ length: 5 }).map(() => '<div style="border-bottom:1px solid #ddd;height:24px;"></div>').join('')}
          </div>`
          break
      }

      return `
        <div style="margin:0 0 20px;page-break-inside:avoid;">
          <div style="display:flex;align-items:baseline;gap:8px;">
            <span style="font-weight:700;font-size:14px;color:#1e3a5f;">${num}.</span>
            <span style="font-size:14px;flex:1;">${q.title}</span>
            <span style="font-size:11px;color:#888;white-space:nowrap;">[${item.points} pts]</span>
          </div>
          ${q.description ? `<p style="margin:4px 0 4px 20px;font-size:12px;color:#666;font-style:italic;">${q.description}</p>` : ''}
          ${answerSpace}
        </div>
      `
    }).join('')

    const bodyHtml = `
      <div class="print-page">
        ${examHeaderHtml}
        ${questionsHtml}
      </div>
    `

    const bodyStyles = `
      .print-page { padding: 0 12px; font-family: 'Segoe UI', Arial, sans-serif; }
    `

    const pdfSettings = schoolSettings?.data?.pdf_header_footer ?? null

    openPrintPreview({
      title: examTitle || 'Examination',
      bodyHtml,
      bodyStyles,
      school: school as any,
      pdfSettings: pdfSettings ?? null,
    })
  }, [examItems, examTitle, examDate, teacherName, totalPoints, selectedCampus, profile, pdfSettings])

  return (
    <div className="p-6 space-y-4 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin/quiz/questions">
          <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="w-6 h-6" /> Exam Builder
          </h1>
          <p className="text-sm text-muted-foreground">Select questions from the bank and build a printable exam paper</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* ── LEFT: Question Bank ── */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Question Bank</CardTitle>
            {/* Filters */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
              <Select value={filterGrade || NONE} onValueChange={v => { setFilterGrade(v === NONE ? '' : v); setFilterSubject(''); setFilterChapter('') }}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Grade" /></SelectTrigger>
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
              <Select value={filterChapter || NONE} onValueChange={v => setFilterChapter(v === NONE ? '' : v)} disabled={!filterSubject}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Chapter" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>All Chapters</SelectItem>
                  {(chapters ?? []).map(c => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterType || NONE} onValueChange={v => setFilterType(v === NONE ? '' : v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Type" /></SelectTrigger>
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
              <div className="relative">
                <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  className="pl-7 h-8 text-xs"
                  placeholder="Search…"
                  value={filterSearch}
                  onChange={e => setFilterSearch(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0 space-y-1.5 max-h-[600px] overflow-y-auto">
            {bankLoading
              ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)
              : ((bankQuestions ?? []).filter(q => !selectedIds.has(q.id))).length === 0
              ? <p className="text-center py-8 text-muted-foreground text-sm">No questions found</p>
              : (bankQuestions ?? []).filter(q => !selectedIds.has(q.id))
                  .filter(q => !filterType || q.type === filterType)
                  .map(q => (
                  <div key={q.id} className="border rounded-md px-3 py-2 flex items-start justify-between gap-2 hover:bg-muted/30 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{q.title}</p>
                      <div className="flex gap-1.5 mt-1 flex-wrap">
                        <Badge variant="secondary" className="text-[10px] px-1.5">{QUESTION_TYPE_LABELS[q.type]}</Badge>
                        {q.difficulty_level && <Badge variant="outline" className="text-[10px] px-1.5">{DIFFICULTY_LABELS[q.difficulty_level]}</Badge>}
                      </div>
                    </div>
                    <Button size="sm" variant="outline" className="h-7 text-xs shrink-0" onClick={() => addQuestion(q)}>
                      <Plus className="w-3 h-3 mr-1" /> Add
                    </Button>
                  </div>
                ))
            }
          </CardContent>
        </Card>

        {/* ── RIGHT: Exam Paper ── */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Exam Paper</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-4">
            {/* Exam Metadata */}
            <div className="space-y-2">
              <div className="space-y-1">
                <Label className="text-xs">Exam Title</Label>
                <Input value={examTitle} onChange={e => setExamTitle(e.target.value)} placeholder="e.g. Mid-Term Examination" className="h-8 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Date</Label>
                  <Input type="date" value={examDate} onChange={e => setExamDate(e.target.value)} className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Teacher Name</Label>
                  <Input value={teacherName} onChange={e => setTeacherName(e.target.value)} placeholder="Teacher name" className="h-8 text-sm" />
                </div>
              </div>
              <div className="flex items-center justify-between text-sm pt-1">
                <span className="text-muted-foreground">{examItems.length} question(s)</span>
                <span className="font-semibold">Total: {totalPoints} pts</span>
              </div>
            </div>

            {/* Selected Questions */}
            <div className="space-y-1.5 max-h-[420px] overflow-y-auto">
              {examItems.length === 0 ? (
                <p className="text-center py-12 text-muted-foreground text-sm">
                  Add questions from the bank to build your exam
                </p>
              ) : (
                examItems.map((item, idx) => (
                  <div key={item.question.id} className="border rounded-md px-3 py-2 flex items-center gap-2 bg-card">
                    <GripVertical className="w-3.5 h-3.5 text-muted-foreground shrink-0 cursor-grab" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{idx + 1}. {item.question.title}</p>
                      <Badge variant="secondary" className="text-[10px] px-1.5 mt-0.5">{QUESTION_TYPE_LABELS[item.question.type]}</Badge>
                    </div>
                    <Input
                      type="number"
                      min={0}
                      value={item.points}
                      onChange={e => updatePoints(idx, Number(e.target.value))}
                      className="w-16 h-7 text-xs text-center"
                    />
                    <span className="text-xs text-muted-foreground">pts</span>
                    <div className="flex gap-0.5">
                      {idx > 0 && (
                        <Button size="icon" variant="ghost" className="h-6 w-6 text-xs" onClick={() => moveItem(idx, idx - 1)}>↑</Button>
                      )}
                      {idx < examItems.length - 1 && (
                        <Button size="icon" variant="ghost" className="h-6 w-6 text-xs" onClick={() => moveItem(idx, idx + 1)}>↓</Button>
                      )}
                    </div>
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive shrink-0" onClick={() => removeQuestion(idx)}>
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ))
              )}
            </div>

            {/* Print Button */}
            <Button
              onClick={handlePrint}
              disabled={examItems.length === 0}
              className="w-full"
            >
              <Printer className="w-4 h-4 mr-2" /> Print / Download PDF
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
