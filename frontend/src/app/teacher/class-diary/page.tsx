'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { useAuth } from '@/context/AuthContext'
import { useCampus } from '@/context/CampusContext'
import { getCoursePeriods } from '@/lib/api/grades'
import { getDiaryEntries, createDiaryEntry, type DiaryEntry } from '@/lib/api/class-diary'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import { Loader2, BookOpen, Plus, AlertCircle } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { toast } from 'sonner'

export default function TeacherClassDiaryPage() {
  const { profile } = useAuth()
  const campusContext = useCampus()
  const campusId = campusContext?.selectedCampus?.id

  const [selectedCPId, setSelectedCPId] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    content: '',
    diary_date: new Date().toISOString().split('T')[0],
    enable_comments: false,
  })
  const [submitting, setSubmitting] = useState(false)

  const { data: cpData } = useSWR(
    campusId ? ['teacher-cps-diary', campusId] : null,
    () => getCoursePeriods(campusId),
    { revalidateOnFocus: false }
  )

  const selectedCP = (cpData?.data || []).find((cp: any) => cp.id === selectedCPId)

  const { data: diaryRes, isLoading, mutate } = useSWR(
    selectedCPId && profile?.staff_id
      ? ['diary-entries', selectedCPId, profile.staff_id]
      : null,
    () => getDiaryEntries({ section_id: selectedCP?.section_id || undefined, teacher_id: profile?.staff_id }),
    { revalidateOnFocus: false }
  )

  const coursePeriods = (cpData?.data || []).filter(
    (cp: any) => !profile?.staff_id || cp.teacher_id === profile.staff_id
  )
  const entries: DiaryEntry[] = diaryRes?.data || []

  const handleSubmit = async () => {
    if (!form.content.trim()) {
      toast.warning('Please enter diary content')
      return
    }
    if (!selectedCP?.section_id || !profile?.staff_id) {
      toast.warning('Missing class or teacher info')
      return
    }
    setSubmitting(true)
    try {
      const res = await createDiaryEntry({
        content: form.content,
        section_id: selectedCP.section_id!,
        teacher_id: profile.staff_id,
        diary_date: form.diary_date,
        enable_comments: form.enable_comments,
        campus_id: campusId,
      })
      if (res.success) {
        toast.success('Diary entry created')
        setForm({ content: '', diary_date: new Date().toISOString().split('T')[0], enable_comments: false })
        setShowForm(false)
        mutate()
      } else {
        toast.error(res.error || 'Failed to create entry')
      }
    } catch {
      toast.error('Failed to create entry')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Class Diary</h1>
          <p className="text-muted-foreground mt-1">Record daily class activities and notes</p>
        </div>
        <Button onClick={() => setShowForm(v => !v)} variant={showForm ? 'outline' : 'default'}>
          <Plus className="h-4 w-4 mr-2" /> {showForm ? 'Cancel' : 'New Entry'}
        </Button>
      </div>

      <div className="space-y-1">
        <Label>Select Class</Label>
        <Select value={selectedCPId} onValueChange={setSelectedCPId}>
          <SelectTrigger className="max-w-xs">
            <SelectValue placeholder="Choose a class..." />
          </SelectTrigger>
          <SelectContent>
            {coursePeriods.map((cp: any) => (
              <SelectItem key={cp.id} value={cp.id}>
                {cp.course?.title || cp.subject?.name || 'Unnamed'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New Diary Entry</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label>Date</Label>
              <Input
                type="date"
                value={form.diary_date}
                onChange={e => setForm(f => ({ ...f, diary_date: e.target.value }))}
                className="max-w-xs"
              />
            </div>
            <div className="space-y-1">
              <Label>Content <span className="text-red-500">*</span></Label>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[120px] resize-none"
                value={form.content}
                onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                placeholder="What happened in class today..."
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="enable-comments"
                checked={form.enable_comments}
                onChange={e => setForm(f => ({ ...f, enable_comments: e.target.checked }))}
              />
              <label htmlFor="enable-comments" className="text-sm cursor-pointer">Allow student comments</label>
            </div>
            <Button onClick={handleSubmit} disabled={submitting || !selectedCPId}>
              {submitting
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
                : 'Save Entry'}
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {!selectedCPId ? (
          <Card>
            <CardContent className="py-12 text-center">
              <BookOpen className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
              <p className="text-muted-foreground">Select a class to view diary entries</p>
            </CardContent>
          </Card>
        ) : isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : entries.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <AlertCircle className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
              <p className="text-muted-foreground">No diary entries for this class</p>
            </CardContent>
          </Card>
        ) : (
          entries.map(entry => (
            <Card key={entry.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-primary" />
                    <p className="font-medium">{format(parseISO(entry.diary_date), 'EEEE, MMMM d, yyyy')}</p>
                  </div>
                  <div className="flex gap-2">
                    {entry.is_published && <Badge variant="outline" className="text-xs">Published</Badge>}
                    {entry.enable_comments && <Badge variant="outline" className="text-xs">Comments on</Badge>}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{entry.content}</p>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
