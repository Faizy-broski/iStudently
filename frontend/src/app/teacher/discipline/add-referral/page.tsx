'use client'

import { useState, useMemo } from 'react'
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
import { Loader2, Search } from 'lucide-react'
import { toast } from 'sonner'

export default function AddTeacherReferralPage() {
  const router = useRouter()

  // Filters
  const [search, setSearch] = useState('')
  const [gradeFilter, setGradeFilter] = useState('all')

  const { students, isLoading: loadingStudents } = useTeacherStudents({
    search: search || undefined,
    grade_level: gradeFilter !== 'all' ? gradeFilter : undefined,
  })

  // Collect distinct grade levels from all (unfiltered) students for the filter chips
  const { students: allStudents } = useTeacherStudents({ limit: 500 })
  const gradeOptions = useMemo(() => {
    const grades = new Set<string>()
    allStudents.forEach((s: any) => { if (s.grade_level) grades.add(s.grade_level) })
    return Array.from(grades).sort()
  }, [allStudents])

  const [form, setForm] = useState({
    student_id: '',
    incident_date: new Date().toISOString().split('T')[0],
    notes: '',
  })
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
        toast.success('Referral submitted successfully')
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
          <div className="space-y-2">
            <Label>Select Student <span className="text-red-500">*</span></Label>

            {/* Grade filter chips */}
            {gradeOptions.length > 1 && (
              <div className="flex gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => { setGradeFilter('all'); setForm(f => ({ ...f, student_id: '' })) }}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    gradeFilter === 'all'
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border text-muted-foreground hover:bg-muted'
                  }`}
                >
                  All Grades
                </button>
                {gradeOptions.map(g => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => { setGradeFilter(g); setForm(f => ({ ...f, student_id: '' })) }}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                      gradeFilter === g
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-border text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            )}

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search by name or student number…"
                value={search}
                onChange={e => { setSearch(e.target.value); setForm(f => ({ ...f, student_id: '' })) }}
              />
            </div>

            {loadingStudents ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading students…
              </div>
            ) : students.length === 0 ? (
              <div className="text-sm text-muted-foreground py-2">
                {search || gradeFilter !== 'all' ? 'No students match the filters.' : 'You have no enrolled students.'}
              </div>
            ) : (
              <Select
                value={form.student_id}
                onValueChange={v => setForm(f => ({ ...f, student_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={`Select from ${students.length} student${students.length !== 1 ? 's' : ''}`} />
                </SelectTrigger>
                <SelectContent>
                  {students.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.profile?.last_name || 'Unknown'}, {s.profile?.first_name || 'Name'}
                      {' '}({s.student_number}){s.grade_level ? ` · ${s.grade_level}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <p className="text-xs text-muted-foreground">List restricted to students in your classes.</p>
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
              {submitting
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Submitting…</>
                : 'Submit Referral'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
