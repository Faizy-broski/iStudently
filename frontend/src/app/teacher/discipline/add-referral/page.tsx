'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createStaffDisciplineReferral } from '@/lib/api/discipline'
import { useTeacherStudents } from '@/hooks/useTeacherStudents'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export default function AddTeacherReferralPage() {
  const router = useRouter()
  // Uses our strict Zero-Trust hook!
  const { students, isLoading: loadingStudents } = useTeacherStudents()

  const [form, setForm] = useState({ student_id: '', incident_date: new Date().toISOString().split('T')[0], notes: '' })
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!form.student_id) {
      toast.warning('Please select a student')
      return
    }
    setSubmitting(true)
    try {
      const res = await createStaffDisciplineReferral({
        student_id: form.student_id,
        incident_date: form.incident_date,
        field_values: form.notes ? { notes: form.notes } : {},
      })
      if (res.success) {
        toast.success('Referral actively logged securely on the backend')
        router.push('/teacher/discipline/referrals')
      } else {
        toast.error(res.error || 'Failed to submit referral')
      }
    } catch {
      toast.error('Failed to submit referral')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Add Discipline Referral</h1>
        <p className="text-muted-foreground mt-1">Submit a behavioral referral for a student in your classes.</p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-1">
            <Label>Select Student <span className="text-red-500">*</span></Label>
            {loadingStudents ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Fetching your enrolled students securely...
              </div>
            ) : students.length === 0 ? (
              <div className="text-sm text-muted-foreground py-2">You currently have no enrolled students.</div>
            ) : (
              <Select value={form.student_id} onValueChange={v => setForm(f => ({ ...f, student_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select one of your students" /></SelectTrigger>
                <SelectContent>
                  {students.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.profile?.last_name || 'Unknown'}, {s.profile?.first_name || 'Name'} ({s.student_number})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <p className="text-xs text-muted-foreground">List restricted strictly to students under your supervision.</p>
          </div>

          <div className="space-y-1">
            <Label>Incident Date</Label>
            <Input
              type="date"
              value={form.incident_date}
              onChange={e => setForm(f => ({ ...f, incident_date: e.target.value }))}
            />
          </div>

          <div className="space-y-1">
            <Label>Detailed Notes / Violation Information</Label>
            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[120px] resize-none"
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Describe what occurred during the incident..."
            />
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <Button variant="outline" onClick={() => router.back()}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={submitting || !form.student_id}>
              {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Submitting securely...</> : 'Submit Referral'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
