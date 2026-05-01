'use client'
import { useEffect, useState } from 'react'
import useSWR, { mutate } from 'swr'
import { useTranslations } from 'next-intl'
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
  const t = useTranslations('quiz')
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
        <h1 className="text-2xl font-bold">{t('configuration')}</h1>
        <Badge variant="secondary" className="ml-1">{t('premiumBadge')}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="w-4 h-4" />
            {t('questionAccessControl')}
          </CardTitle>
          <CardDescription>
            {t('questionAccessControlDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? (
            <Skeleton className="h-12 w-full" />
          ) : (
            <div className="flex items-start justify-between gap-4 p-4 border rounded-md">
              <div className="space-y-1">
                <Label htmlFor="teacher-edit-own" className="text-sm font-medium">
                  {t('teacherEditOwn')}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {t('teacherEditOwnHelp')}
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
              {saving ? t('saving') : t('saveSettings')}
            </Button>
            {saved && <span className="text-sm text-green-600">{t('premium.settingsSaved')}</span>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('premium.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>{t('premium.quizModuleFeatures')}</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><strong>{t('premium.copyQuizLabel')}</strong> {t('premium.duplicateQuiz')}</li>
            <li><strong>{t('premium.answerBreakdownLabel')}</strong> {t('premium.questionAnalysis')}</li>
            <li><strong>{t('premium.teacherAccessControlLabel')}</strong> {t('premium.restrictEditing')}</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
