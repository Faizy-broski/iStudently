'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Loader2, CalendarPlus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { getMyAssignedSchools } from '@/lib/api/inspectors'
import { createVisit, type VisitType } from '@/lib/api/inspection-visits'

export default function NewInspectionVisitPage() {
  const t = useTranslations('inspections.visits')
  const router = useRouter()

  const [schools, setSchools] = useState<Array<{ id: string; name: string }>>([])
  const [loadingSchools, setLoadingSchools] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [schoolId, setSchoolId] = useState('')
  const [visitType, setVisitType] = useState<VisitType>('announced')
  const [scheduledDate, setScheduledDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [purpose, setPurpose] = useState('')

  useEffect(() => {
    getMyAssignedSchools().then((res) => {
      setSchools(res.data || [])
      setLoadingSchools(false)
    })
  }, [])

  const handleSubmit = async () => {
    if (!schoolId || !scheduledDate) return
    setSubmitting(true)
    try {
      const res = await createVisit({
        school_id: schoolId,
        visit_type: visitType,
        scheduled_date: scheduledDate,
        scheduled_start_time: startTime || undefined,
        scheduled_end_time: endTime || undefined,
        purpose: purpose.trim() || undefined,
      })
      if (res.error) {
        toast.error(res.error)
      } else if (res.data) {
        toast.success(t('msg_visit_created'))
        router.push(`/inspector/visits/${res.data.id}`)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('new_visit_title')}</h1>
        <p className="text-sm text-gray-500 mt-1">{t('new_visit_subtitle')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarPlus className="h-5 w-5 text-[#022172]" />
            {t('form_title')}
          </CardTitle>
          <CardDescription>{t('form_subtitle')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t('field_campus')}</Label>
            {loadingSchools ? (
              <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
                <Loader2 className="h-4 w-4 animate-spin" /> {t('loading_campuses')}
              </div>
            ) : schools.length === 0 ? (
              <p className="text-sm text-gray-500">{t('no_assigned_campuses')}</p>
            ) : (
              <Select value={schoolId} onValueChange={setSchoolId}>
                <SelectTrigger>
                  <SelectValue placeholder={t('field_campus_placeholder')} />
                </SelectTrigger>
                <SelectContent>
                  {schools.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>{t('field_visit_type')}</Label>
            <Select value={visitType} onValueChange={(v) => setVisitType(v as VisitType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="announced">{t('visit_type_announced')}</SelectItem>
                <SelectItem value="unannounced">{t('visit_type_unannounced')}</SelectItem>
                <SelectItem value="follow_up">{t('visit_type_follow_up')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5 col-span-3 sm:col-span-1">
              <Label>{t('field_date')}</Label>
              <Input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('field_start_time')}</Label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('field_end_time')}</Label>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{t('field_purpose')}</Label>
            <Textarea value={purpose} onChange={(e) => setPurpose(e.target.value)} rows={3} placeholder={t('field_purpose_placeholder')} />
          </div>

          <Button
            onClick={handleSubmit}
            disabled={submitting || !schoolId || !scheduledDate}
            className="w-full gap-2"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarPlus className="h-4 w-4" />}
            {t('btn_schedule')}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
