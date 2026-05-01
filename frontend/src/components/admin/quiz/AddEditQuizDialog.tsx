'use client'
import { useEffect, useState } from 'react'
import useSWR from 'swr'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { createQuiz, updateQuiz, getAssignmentsForQuiz, getCoursePeriodsForQuiz, type Quiz } from '@/lib/api/quiz'

interface Props {
  quiz?: Quiz | null
  schoolId: string
  campusId?: string | null
  onClose: () => void
  onSaved: () => void
}

const NONE = '__none__'

export function AddEditQuizDialog({ quiz, schoolId, campusId, onClose, onSaved }: Props) {
  const isEdit = !!quiz

  const [title, setTitle] = useState(quiz?.title ?? '')
  const [description, setDescription] = useState(quiz?.description ?? '')
  const [assignmentId, setAssignmentId] = useState(quiz?.assignment_id ?? '')
  const [coursePeriodId, setCoursePeriodId] = useState(quiz?.course_period_id ?? '')
  const [showCorrect, setShowCorrect] = useState(quiz?.show_correct_answers ?? true)
  const [shuffle, setShuffle] = useState(quiz?.shuffle ?? false)
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

  const handleSave = async () => {
    if (!title.trim()) { setError('Title is required'); return }
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
      }
      if (isEdit && quiz) {
        await updateQuiz(quiz.id, payload)
      } else {
        await createQuiz(payload)
      }
      onSaved()
    } catch (e: any) {
      setError(e.message || 'Failed to save quiz')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Quiz' : 'New Quiz'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label htmlFor="q-title">Title *</Label>
            <Input
              id="q-title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Quiz title"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="q-desc">Description</Label>
            <Textarea
              id="q-desc"
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              placeholder="Optional description"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Course Period</Label>
              <Select value={coursePeriodId || NONE} onValueChange={v => { setCoursePeriodId(v === NONE ? '' : v); setAssignmentId('') }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select course period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>— None —</SelectItem>
                  {(coursePeriods ?? []).map(cp => (
                    <SelectItem key={cp.id} value={cp.id}>
                      {(cp.courses as any)?.title ?? cp.id.slice(0, 8)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Assignment (optional)</Label>
              <Select value={assignmentId || NONE} onValueChange={v => setAssignmentId(v === NONE ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select assignment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>— None —</SelectItem>
                  {(assignments ?? []).map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-6">
            <div className="flex items-center gap-2">
              <Switch id="show-correct" checked={showCorrect} onCheckedChange={setShowCorrect} />
              <Label htmlFor="show-correct">Show Correct Answers</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="shuffle" checked={shuffle} onCheckedChange={setShuffle} />
              <Label htmlFor="shuffle">Random Question Order</Label>
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Quiz'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
