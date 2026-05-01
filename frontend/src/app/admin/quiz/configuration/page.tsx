'use client'
import { useEffect, useState } from 'react'
import useSWR, { mutate } from 'swr'
import { useAuth } from '@/context/AuthContext'
import { useCampus } from '@/context/CampusContext'
import { getQuizConfig, upsertQuizConfig } from '@/lib/api/quiz'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Settings, ShieldCheck } from 'lucide-react'

export default function QuizConfigurationPage() {
  const { profile } = useAuth()
  const { selectedCampus } = useCampus()
  const schoolId = profile?.school_id ?? ''
  const campusId = selectedCampus?.id ?? null

  const key = ['quiz-config', schoolId]
  const { data: config, isLoading } = useSWR(
    schoolId ? key : null,
    () => getQuizConfig(schoolId).then(r => r.data ?? null)
  )

  const [teacherEditOwn, setTeacherEditOwn] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (config) setTeacherEditOwn(config.teacher_edit_own_only)
  }, [config])

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)
    try {
      await upsertQuizConfig({
        school_id: schoolId,
        campus_id: campusId ?? null,
        teacher_edit_own_only: teacherEditOwn,
      })
      mutate(key)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Settings className="w-6 h-6" />
        <h1 className="text-2xl font-bold">Quiz Configuration</h1>
        <Badge variant="secondary" className="ml-1">Premium</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="w-4 h-4" />
            Question Access Control
          </CardTitle>
          <CardDescription>
            Control who can edit questions in the question bank.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? (
            <Skeleton className="h-12 w-full" />
          ) : (
            <div className="flex items-start justify-between gap-4 p-4 border rounded-md">
              <div className="space-y-1">
                <Label htmlFor="teacher-edit-own" className="text-sm font-medium">
                  Teachers can only edit their own questions
                </Label>
                <p className="text-xs text-muted-foreground">
                  When enabled, teachers can only create, edit, and delete questions they created.
                  Administrators and other teachers can view but not modify other teachers' questions.
                </p>
              </div>
              <Switch
                id="teacher-edit-own"
                checked={teacherEditOwn}
                onCheckedChange={setTeacherEditOwn}
              />
            </div>
          )}

          <div className="flex items-center gap-3">
            <Button onClick={handleSave} disabled={saving || isLoading}>
              {saving ? 'Saving…' : 'Save Settings'}
            </Button>
            {saved && <span className="text-sm text-green-600">Settings saved.</span>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">About Premium Features</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>The following premium features are included in the Quiz module:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><strong>Copy Quiz from Last Year</strong> — Duplicate a quiz to a new academic year from the Quizzes list.</li>
            <li><strong>Answer Breakdown</strong> — Identify which questions students struggled with most.</li>
            <li><strong>Teacher Access Control</strong> — Restrict question editing to question owners (this page).</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
