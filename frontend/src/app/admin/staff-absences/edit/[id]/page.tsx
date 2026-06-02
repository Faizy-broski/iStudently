'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/context/AuthContext'
import { useCampus } from '@/context/CampusContext'
import * as api from '@/lib/api/staff-absences'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { ArrowLeft, Pencil } from 'lucide-react'
import type { CoursePeriod } from '@/lib/api/staff-absences'

export default function EditAbsencePage() {
  const t = useTranslations('staffAbsences')
  const { profile } = useAuth()
  const campusCtx = useCampus()
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const schoolId = profile?.school_id || ''
  const campusId = campusCtx?.selectedCampus?.id

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [coursePeriods, setCoursePeriods] = useState<CoursePeriod[]>([])
  const [staffName, setStaffName] = useState('')

  const [form, setForm] = useState({
    start_date: '',
    end_date: '',
    reason: '',
    notes: '',
    status: 'pending' as api.AbsenceStatus,
  })
  const [selectedCPs, setSelectedCPs] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!id) return
    api.getAbsenceById(id).then(async (res) => {
      if (res.error || !res.data) {
        toast.error(t('toasts.absenceNotFound'))
        router.push('/admin/staff-absences/absences')
        return
      }
      const a = res.data
      setStaffName(a.staff_name || '')
      setForm({
        start_date: a.start_date?.slice(0, 10) || '',
        end_date: a.end_date?.slice(0, 10) || '',
        reason: a.reason || '',
        notes: a.notes || '',
        status: a.status,
      })
      setSelectedCPs(new Set(a.cancelled_course_periods || []))

      // Load course periods for this staff member
      if (a.staff_id && schoolId) {
        const cpRes = await api.getStaffCoursePeriods(a.staff_id, schoolId, campusId)
        setCoursePeriods(cpRes.data || [])
      }
      setLoading(false)
    })
  }, [id, schoolId, campusId, router])

  const toggleCP = (cpId: string) => {
    setSelectedCPs((prev) => {
      const next = new Set(prev)
      next.has(cpId) ? next.delete(cpId) : next.add(cpId)
      return next
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.start_date || !form.end_date) return toast.error(t('validation.datesRequired'))
    if (form.start_date > form.end_date) return toast.error(t('validation.endAfterStart'))

    setSaving(true)
    const res = await api.updateAbsence(id, {
      start_date: form.start_date + 'T00:00:00',
      end_date: form.end_date + 'T23:59:59',
      reason: form.reason || undefined,
      notes: form.notes || undefined,
      status: form.status,
      cancelled_course_period_ids: Array.from(selectedCPs),
    })
    setSaving(false)

    if (res.error) {
      toast.error(res.error)
    } else {
      toast.success(t('toasts.absenceUpdated'))
      router.push('/admin/staff-absences/absences')
    }
  }

  if (loading) {
    return (
      <div className="p-6 max-w-2xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-2xl space-y-4">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/admin/staff-absences/absences')}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Pencil className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-2xl font-semibold">{t('editAbsence')}</h1>
        {staffName && (
          <span className="text-muted-foreground text-sm">— {staffName}</span>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('absenceDetails')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{t('fields.startDate')} <span className="text-destructive">*</span></Label>
                <Input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t('fields.endDate')} <span className="text-destructive">*</span></Label>
                <Input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>{t('fields.reason')}</Label>
              <Input
                placeholder={t('placeholders.reason')}
                value={form.reason}
                onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t('fields.notes')}</Label>
              <Textarea
                placeholder={t('placeholders.notes')}
                rows={3}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t('fields.status')}</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm((f) => ({ ...f, status: v as api.AbsenceStatus }))}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">{t('statuses.pending')}</SelectItem>
                  <SelectItem value="approved">{t('statuses.approved')}</SelectItem>
                  <SelectItem value="rejected">{t('statuses.rejected')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {coursePeriods.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('cancelledClasses.title')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {coursePeriods.map((cp) => (
                <label key={cp.id} className="flex items-center gap-2.5 cursor-pointer group">
                  <Checkbox
                    checked={selectedCPs.has(cp.id)}
                    onCheckedChange={() => toggleCP(cp.id)}
                  />
                  <span className="text-sm">
                    {cp.title}
                    {cp.short_name && (
                      <span className="ml-1.5 text-xs text-muted-foreground">({cp.short_name})</span>
                    )}
                  </span>
                </label>
              ))}
            </CardContent>
          </Card>
        )}

        <div className="flex gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? t('saving') : t('saveChanges')}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/admin/staff-absences/absences')}
          >
            {t('cancel')}
          </Button>
        </div>
      </form>
    </div>
  )
}
