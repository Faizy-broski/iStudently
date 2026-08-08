'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
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
import { MultiSelectPopover } from '@/components/shared/MultiSelectPopover'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { ArrowLeft, UserMinus } from 'lucide-react'
import type { StaffMember, CoursePeriod } from '@/lib/api/staff-absences'

export default function AddAbsencePage() {
  const t = useTranslations('staffAbsences')
  const { profile } = useAuth()
  const campusCtx = useCampus()
  const router = useRouter()
  const schoolId = profile?.school_id || ''
  const campusId = campusCtx?.selectedCampus?.id

  const today = new Date().toISOString().slice(0, 10)

  const [staffList, setStaffList] = useState<StaffMember[]>([])
  const [coursePeriods, setCoursePeriods] = useState<CoursePeriod[]>([])
  const [loadingStaff, setLoadingStaff] = useState(true)
  const [loadingCPs, setLoadingCPs] = useState(false)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    start_date: today,
    end_date: today,
    reason: '',
    notes: '',
    status: 'pending' as api.AbsenceStatus,
  })
  // Multiple staff can be marked absent at once (same dates/reason/notes/status
  // applied to each). Cancelled-course-period selection only makes sense when
  // exactly one staff member is selected, since different teachers teach
  // different course periods.
  const [staffIds, setStaffIds] = useState<string[]>([])
  const [staffPopoverOpen, setStaffPopoverOpen] = useState(false)
  const [selectedCPs, setSelectedCPs] = useState<Set<string>>(new Set())

  // Load staff
  useEffect(() => {
    if (!schoolId) return
    setLoadingStaff(true)
    api.getStaffMembers(schoolId, campusId).then((res) => {
      setStaffList(res.data || [])
      setLoadingStaff(false)
    })
  }, [schoolId, campusId])

  // Load course periods when exactly one staff member is selected — with
  // multiple staff selected there's no single "whose classes" to show, so
  // that section is hidden instead (see below).
  const singleStaffId = staffIds.length === 1 ? staffIds[0] : null
  useEffect(() => {
    if (!singleStaffId || !schoolId) {
      setCoursePeriods([])
      setSelectedCPs(new Set())
      return
    }
    setLoadingCPs(true)
    api.getStaffCoursePeriods(singleStaffId, schoolId, campusId).then((res) => {
      setCoursePeriods(res.data || [])
      setSelectedCPs(new Set())
      setLoadingCPs(false)
    })
  }, [singleStaffId, schoolId, campusId])

  const toggleCP = (id: string) => {
    setSelectedCPs((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (staffIds.length === 0) return toast.error(t('validation.selectStaff'))
    if (!form.start_date || !form.end_date) return toast.error(t('validation.startEndRequired'))
    if (form.start_date > form.end_date) return toast.error(t('validation.endAfterStart'))

    setSaving(true)
    // One absence row per selected staff member (same dates/reason/notes/status
    // applied to each) — cancelled course periods only apply when a single
    // staff member was selected, since they're specific to that person's schedule.
    const results = await Promise.all(
      staffIds.map((staffId) =>
        api.createAbsence({
          school_id: schoolId,
          campus_id: campusId,
          staff_id: staffId,
          start_date: form.start_date + 'T00:00:00',
          end_date: form.end_date + 'T23:59:59',
          reason: form.reason || undefined,
          notes: form.notes || undefined,
          status: form.status,
          cancelled_course_period_ids: singleStaffId ? Array.from(selectedCPs) : [],
        })
      )
    )
    setSaving(false)

    const failures = results.filter((r) => r.error)
    const successCount = results.length - failures.length

    if (successCount > 0) {
      toast.success(
        successCount === 1
          ? t('toasts.absenceAdded')
          : t('toasts.absencesAdded', { count: successCount })
      )
    }
    if (failures.length > 0) {
      toast.error(failures[0].error || t('validation.selectStaff'))
    }
    if (successCount > 0) {
      router.push('/admin/staff-absences/absences')
    }
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
        <UserMinus className="h-6 w-6 text-muted-foreground" />
        <h1 className="text-2xl font-semibold">{t('addAbsence')}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('absenceDetails')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Staff member(s) — select one, several, or all at once */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="staff_id">
                  {t('fields.staffMember')} <span className="text-destructive">*</span>
                </Label>
                {!loadingStaff && staffList.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() =>
                      setStaffIds((prev) =>
                        prev.length === staffList.length ? [] : staffList.map((s) => s.id)
                      )
                    }
                  >
                    {staffIds.length === staffList.length ? t('deselectAll') : t('selectAll')}
                  </Button>
                )}
              </div>
              {loadingStaff ? (
                <Skeleton className="h-9 w-full" />
              ) : (
                <MultiSelectPopover
                  options={staffList.map((s) => ({ id: s.id, label: `${s.name} (${s.role})` }))}
                  selectedIds={staffIds}
                  onChange={setStaffIds}
                  placeholder={t('placeholders.selectStaff')}
                  emptyMessage={t('placeholders.selectStaff')}
                  open={staffPopoverOpen}
                  onOpenChange={setStaffPopoverOpen}
                />
              )}
              {staffIds.length > 1 && (
                <p className="text-xs text-muted-foreground">
                  {t('multipleStaffHint', { count: staffIds.length })}
                </p>
              )}
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="start_date">
                  {t('fields.startDate')} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="start_date"
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="end_date">
                  {t('fields.endDate')} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="end_date"
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                  required
                />
              </div>
            </div>

            {/* Reason */}
            <div className="space-y-1.5">
              <Label htmlFor="reason">{t('fields.reason')}</Label>
              <Input
                id="reason"
                placeholder={t('placeholders.reason')}
                value={form.reason}
                onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
              />
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="notes">{t('fields.notes')}</Label>
              <Textarea
                id="notes"
                placeholder={t('placeholders.notes')}
                rows={3}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>

            {/* Status */}
            <div className="space-y-1.5">
              <Label htmlFor="status">{t('fields.status')}</Label>
              <Select
                value={form.status}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, status: v as api.AbsenceStatus }))
                }
              >
                <SelectTrigger id="status" className="w-40">
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

        {/* Cancelled Classes — only shown for a single selected staff member,
            since which classes get cancelled is specific to their own
            schedule and wouldn't mean the same thing across several teachers
            selected at once. */}
        {staffIds.length > 1 && (
          <p className="text-xs text-muted-foreground">
            {t('cancelledClasses.hiddenForMultiple')}
          </p>
        )}
        {singleStaffId && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('cancelledClasses.title')}</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingCPs ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-6 w-full" />
                  ))}
                </div>
              ) : coursePeriods.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t('cancelledClasses.noCoursePeriods')}
                </p>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground mb-3">
                    {t('cancelledClasses.selectCoursePeriods')}
                  </p>
                  {coursePeriods.map((cp) => (
                    <label
                      key={cp.id}
                      className="flex items-center gap-2.5 cursor-pointer group"
                    >
                      <Checkbox
                        checked={selectedCPs.has(cp.id)}
                        onCheckedChange={() => toggleCP(cp.id)}
                      />
                      <span className="text-sm group-hover:text-foreground">
                        {cp.title}
                        {cp.short_name && (
                          <span className="ml-1.5 text-xs text-muted-foreground">
                            ({cp.short_name})
                          </span>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="flex gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? t('saving') : t('saveAbsence')}
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
