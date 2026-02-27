'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
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
import { ArrowLeft, UserMinus } from 'lucide-react'
import type { StaffMember, CoursePeriod } from '@/lib/api/staff-absences'

export default function AddAbsencePage() {
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
    staff_id: '',
    start_date: today,
    end_date: today,
    reason: '',
    notes: '',
    status: 'pending' as api.AbsenceStatus,
  })
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

  // Load course periods when staff changes
  useEffect(() => {
    if (!form.staff_id || !schoolId) {
      setCoursePeriods([])
      setSelectedCPs(new Set())
      return
    }
    setLoadingCPs(true)
    api.getStaffCoursePeriods(form.staff_id, schoolId, campusId).then((res) => {
      setCoursePeriods(res.data || [])
      setSelectedCPs(new Set())
      setLoadingCPs(false)
    })
  }, [form.staff_id, schoolId, campusId])

  const toggleCP = (id: string) => {
    setSelectedCPs((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.staff_id) return toast.error('Please select a staff member')
    if (!form.start_date || !form.end_date) return toast.error('Start and end dates are required')
    if (form.start_date > form.end_date) return toast.error('End date must be after start date')

    setSaving(true)
    const res = await api.createAbsence({
      school_id: schoolId,
      campus_id: campusId,
      staff_id: form.staff_id,
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
      toast.success('Absence added successfully')
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
        <h1 className="text-2xl font-semibold">Add Absence</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Absence Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Staff member */}
            <div className="space-y-1.5">
              <Label htmlFor="staff_id">
                Staff Member <span className="text-destructive">*</span>
              </Label>
              {loadingStaff ? (
                <Skeleton className="h-9 w-full" />
              ) : (
                <Select
                  value={form.staff_id}
                  onValueChange={(v) => setForm((f) => ({ ...f, staff_id: v }))}
                >
                  <SelectTrigger id="staff_id">
                    <SelectValue placeholder="Select staff member…" />
                  </SelectTrigger>
                  <SelectContent>
                    {staffList.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                        <span className="ml-2 text-xs text-muted-foreground capitalize">
                          ({s.role})
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="start_date">
                  Start Date <span className="text-destructive">*</span>
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
                  End Date <span className="text-destructive">*</span>
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
              <Label htmlFor="reason">Reason</Label>
              <Input
                id="reason"
                placeholder="e.g. Sick leave, vacation…"
                value={form.reason}
                onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
              />
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Additional notes…"
                rows={3}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>

            {/* Status */}
            <div className="space-y-1.5">
              <Label htmlFor="status">Status</Label>
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
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Cancelled Classes (only shown if staff member has course periods) */}
        {form.staff_id && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Cancelled Classes</CardTitle>
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
                  No course periods found for this staff member.
                </p>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground mb-3">
                    Select the course periods that will be cancelled during this absence:
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
            {saving ? 'Saving…' : 'Save Absence'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/admin/staff-absences/absences')}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  )
}
