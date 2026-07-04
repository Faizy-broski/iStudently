'use client'
import { useEffect, useMemo, useState } from 'react'
import useSWR from 'swr'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DateTimePicker } from '@/components/ui/datetime-picker'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  createQuiz,
  updateQuiz,
  getAssignmentsForQuiz,
  getCoursePeriodsForQuiz,
  getCoursePeriodContext,
  getQuestions,
  type Quiz,
  type QuizGenerationMode,
  type DifficultyLevel,
} from '@/lib/api/quiz'
import { getStudents } from '@/lib/api/students'
import { StudentMultiSelect, type StudentOption } from './StudentMultiSelect'
import { useTranslations } from 'next-intl'

interface Props {
  quiz?: Quiz | null
  schoolId: string
  campusId?: string | null
  onClose: () => void
  onSaved: () => void
}

const NONE = '__none__'

// datetime-local (local wall time) <-> ISO helpers
function isoToLocalInput(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
function localInputToIso(local: string): string | null {
  if (!local) return null
  const d = new Date(local)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

export function AddEditQuizDialog({ quiz, schoolId, campusId, onClose, onSaved }: Props) {
  const isEdit = !!quiz
  const t = useTranslations('quiz')

  const [title, setTitle] = useState(quiz?.title ?? '')
  const [description, setDescription] = useState(quiz?.description ?? '')
  const [assignmentId, setAssignmentId] = useState(quiz?.assignment_id ?? '')
  const [coursePeriodId, setCoursePeriodId] = useState(quiz?.course_period_id ?? '')
  const [showCorrect, setShowCorrect] = useState(quiz?.show_correct_answers ?? true)
  const [shuffle, setShuffle] = useState(quiz?.shuffle ?? false)

  // resolved from the selected course period
  const [subjectId, setSubjectId] = useState<string | null>(quiz?.subject_id ?? null)
  const [gradeLevelId, setGradeLevelId] = useState<string | null>(quiz?.grade_level_id ?? null)
  const [sectionId, setSectionId] = useState<string | null>(null)

  // targeted assignment
  const [assignedStudentIds, setAssignedStudentIds] = useState<string[]>(quiz?.assigned_student_ids ?? [])

  // multi-form blueprint
  const [mode, setMode] = useState<QuizGenerationMode>(quiz?.generation_mode ?? 'manual')
  const [variantCount, setVariantCount] = useState(quiz?.variant_count ?? 3)
  const [bpEasy, setBpEasy] = useState(quiz?.blueprint_easy ?? 0)
  const [bpMedium, setBpMedium] = useState(quiz?.blueprint_medium ?? 0)
  const [bpHard, setBpHard] = useState(quiz?.blueprint_hard ?? 0)

  // scheduling
  const [startTime, setStartTime] = useState(isoToLocalInput(quiz?.start_time))
  const [lockoutMinutes, setLockoutMinutes] = useState<string>(quiz?.lockout_minutes != null ? String(quiz.lockout_minutes) : '')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const { data: assignments } = useSWR(
    schoolId ? ['quiz-assignments', schoolId, campusId, coursePeriodId] : null,
    () => getAssignmentsForQuiz(schoolId, campusId, coursePeriodId || undefined).then(r => r.data ?? [])
  )

  const { data: coursePeriods } = useSWR(
    schoolId ? ['quiz-course-periods', schoolId, campusId] : null,
    () => getCoursePeriodsForQuiz(schoolId, campusId).then(r => r.data ?? [])
  )

  // Resolve subject/grade/section from the selected course period.
  useEffect(() => {
    if (!coursePeriodId) { setSubjectId(null); setGradeLevelId(null); setSectionId(null); return }
    let active = true
    getCoursePeriodContext(coursePeriodId).then(r => {
      if (!active || !r.data) return
      setSubjectId(r.data.subject_id)
      setGradeLevelId(r.data.grade_level_id)
      setSectionId(r.data.section_id)
    })
    return () => { active = false }
  }, [coursePeriodId])

  // Roster for targeted assignment (campus-scoped).
  const { data: rosterRes } = useSWR(
    ['quiz-roster', campusId],
    () => getStudents({ campus_id: campusId ?? undefined, limit: 500 })
  )
  const studentOptions: StudentOption[] = useMemo(
    () => (rosterRes?.data ?? []).map((s: any) => ({
      id: s.id,
      name: [s.profile?.first_name, s.profile?.last_name].filter(Boolean).join(' ') || s.student_number,
      subtitle: [s.grade?.name, s.section?.name].filter(Boolean).join(' - ') || undefined,
    })),
    [rosterRes]
  )

  // Blueprint validation: how many questions exist per difficulty in this subject/grade.
  const { data: poolQuestions } = useSWR(
    mode === 'blueprint' && subjectId ? ['bp-pool', schoolId, campusId, subjectId, gradeLevelId] : null,
    () => getQuestions(schoolId, {
      campusId,
      subjectId: subjectId ?? undefined,
      gradeLevelId: gradeLevelId ?? undefined,
    }).then(r => r.data ?? [])
  )
  const poolCounts = useMemo(() => {
    const c: Record<DifficultyLevel, number> = { easy: 0, medium: 0, hard: 0 }
    for (const q of poolQuestions ?? []) if (q.difficulty_level) c[q.difficulty_level]++
    return c
  }, [poolQuestions])

  const blueprintTotal = bpEasy + bpMedium + bpHard

  const handleSave = async () => {
    if (!title.trim()) { setError(t('errors.titleRequired') || 'Title is required'); return }
    if (mode === 'blueprint') {
      if (blueprintTotal <= 0) { setError(t('errors.blueprintEmpty') || 'Blueprint must include at least one question.'); return }
      if (!subjectId) { setError(t('errors.coursePeriodRequired') || 'Select a course period so the blueprint knows which subject to pull from.'); return }
    }
    setSaving(true)
    setError('')
    try {
      const payload = {
        school_id: schoolId,
        campus_id: campusId ?? null,
        title: title.trim(),
        description: description.trim() || null,
        assignment_id: assignmentId || null,
        course_period_id: coursePeriodId || null,
        academic_year_id: null,
        created_by: null,
        show_correct_answers: showCorrect,
        shuffle,
        subject_id: subjectId,
        grade_level_id: gradeLevelId,
        assigned_student_ids: assignedStudentIds,
        generation_mode: mode,
        variant_count: mode === 'blueprint' ? Math.max(1, variantCount) : 1,
        blueprint_easy: mode === 'blueprint' ? bpEasy : 0,
        blueprint_medium: mode === 'blueprint' ? bpMedium : 0,
        blueprint_hard: mode === 'blueprint' ? bpHard : 0,
        start_time: localInputToIso(startTime),
        lockout_minutes: lockoutMinutes.trim() ? Number(lockoutMinutes) : null,
      }
      const res = isEdit && quiz
        ? await updateQuiz(quiz.id, payload)
        : await createQuiz(payload)
      if (res.error) { setError(res.error); return }
      onSaved()
    } catch (e: any) {
      setError(e.message || t('errors.failedToSaveQuiz') || 'Failed to save quiz')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open onOpenChange={onClose}>
      <SheetContent className="sm:max-w-xl w-full overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEdit ? t('editQuiz') : t('newQuiz')}</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label htmlFor="q-title">{t('table.title')} *</Label>
            <Input id="q-title" value={title} onChange={e => setTitle(e.target.value)} placeholder={t('placeholders.quizTitle')} />
          </div>

          <div className="space-y-1">
            <Label htmlFor="q-desc">{t('description')}</Label>
            <Textarea id="q-desc" value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder={t('placeholders.optionalDescription')} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>{t('coursePeriod')}</Label>
              <Select value={coursePeriodId || NONE} onValueChange={v => { setCoursePeriodId(v === NONE ? '' : v); setAssignmentId(''); setAssignedStudentIds([]) }}>
                <SelectTrigger><SelectValue placeholder={t('selectCoursePeriod')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{t('none')}</SelectItem>
                  {(coursePeriods ?? []).map(cp => (
                    <SelectItem key={cp.id} value={cp.id}>
                      {(cp.courses as any)?.title ?? cp.id.slice(0, 8)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>{t('assignmentOptional')}</Label>
              <Select value={assignmentId || NONE} onValueChange={v => setAssignmentId(v === NONE ? '' : v)}>
                <SelectTrigger><SelectValue placeholder={t('selectAssignment')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{t('none')}</SelectItem>
                  {(assignments ?? []).map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Targeted assignment */}
          <div className="space-y-1">
            <Label>{t('assignStudentsLabel')}</Label>
            <StudentMultiSelect
              options={studentOptions}
              value={assignedStudentIds}
              onChange={setAssignedStudentIds}
              disabled={false}
              placeholder={t('searchStudents')}
            />
            <p className="text-xs text-muted-foreground">{t('deployWholeSection')}</p>
          </div>

          {/* Multi-form blueprint */}
          <div className="space-y-2 rounded-md border p-3">
            <div className="flex items-center justify-between">
              <Label>{t('questionSelection')}</Label>
              <div className="flex items-center gap-2 text-sm">
                <span className={mode === 'manual' ? 'font-medium' : 'text-muted-foreground'}>{t('manual')}</span>
                <Switch checked={mode === 'blueprint'} onCheckedChange={v => setMode(v ? 'blueprint' : 'manual')} />
                <span className={mode === 'blueprint' ? 'font-medium' : 'text-muted-foreground'}>{t('blueprint')}</span>
              </div>
            </div>

            {mode === 'manual' ? (
              <p className="text-xs text-muted-foreground">{t('manualHelp')}</p>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  {t('blueprintHelp', { forms: Math.max(1, variantCount) })}
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {([['easy', bpEasy, setBpEasy], ['medium', bpMedium, setBpMedium], ['hard', bpHard, setBpHard]] as const).map(([key, val, setter]) => (
                    <div key={key} className="space-y-1">
                      <Label className="capitalize text-xs">
                        {t(`difficulty.${key}`)} <span className="text-muted-foreground">({poolCounts[key as DifficultyLevel]} {t('avail')})</span>
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        value={val}
                        onChange={e => setter(Math.max(0, Number(e.target.value)))}
                        className={val > poolCounts[key as DifficultyLevel] * (mode === 'blueprint' ? Math.max(1, variantCount) : 1) ? 'border-amber-400' : ''}
                      />
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2 items-end">
                  <div className="space-y-1">
                    <Label className="text-xs">{t('numberOfForms')}</Label>
                    <Input type="number" min={1} value={variantCount} onChange={e => setVariantCount(Math.max(1, Number(e.target.value)))} />
                  </div>
                  <p className="text-xs text-muted-foreground pb-2">{t('totalBlueprint', { questions: blueprintTotal, forms: Math.max(1, variantCount) })}</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('blueprintTip')}
                </p>
              </div>
            )}
          </div>

          {/* Strict live scheduling */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>{t('unlockAt')}</Label>
              <DateTimePicker value={startTime} onChange={setStartTime} />
            </div>
            <div className="space-y-1">
              <Label>{t('lockoutWindow')}</Label>
              <Input type="number" min={0} value={lockoutMinutes} onChange={e => setLockoutMinutes(e.target.value)} placeholder={t('lockoutPlaceholder')} disabled={!startTime} />
            </div>
          </div>

          <div className="flex gap-6">
            <div className="flex items-center gap-2">
              <Switch id="show-correct" checked={showCorrect} onCheckedChange={setShowCorrect} />
              <Label htmlFor="show-correct">{t('showCorrectAnswers')}</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="shuffle" checked={shuffle} onCheckedChange={setShuffle} />
              <Label htmlFor="shuffle">{t('randomQuestionOrder')}</Label>
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <SheetFooter className="mt-4">
          <Button variant="outline" onClick={onClose} disabled={saving}>{t('cancel')}</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? t('saving') : isEdit ? t('saveChanges') : t('createQuiz')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
