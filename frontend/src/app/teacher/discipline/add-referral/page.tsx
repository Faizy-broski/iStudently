'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createStaffDisciplineReferral, getDisciplineFields, type DisciplineField } from '@/lib/api/discipline'
import { useTeacherStudents } from '@/hooks/useTeacherStudents'
import { useAuth } from '@/context/AuthContext'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

// ---------------------------------------------------------------------------
// Dynamic field renderer (mirrors admin add-referral form)
// ---------------------------------------------------------------------------

function isPenaltyMarker(opt: string) {
  return !isNaN(parseFloat(opt)) && parseFloat(opt) < 0
}

function DynamicFieldInput({
  field,
  value,
  onChange,
}: {
  field: DisciplineField
  value: any
  onChange: (val: any) => void
}) {
  const { field_type, options, name } = field
  const visibleOptions = (options ?? []).filter((opt, idx) => !(idx === 0 && isPenaltyMarker(opt)))

  if (field_type === 'text') {
    return (
      <Input
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={name}
        maxLength={1000}
      />
    )
  }

  if (field_type === 'textarea') {
    return (
      <Textarea
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={name}
        rows={3}
        maxLength={5000}
      />
    )
  }

  if (field_type === 'numeric') {
    return (
      <Input
        type="number"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
      />
    )
  }

  if (field_type === 'date') {
    return (
      <Input
        type="date"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
      />
    )
  }

  if (field_type === 'checkbox') {
    return (
      <div className="flex items-center gap-2">
        <Checkbox
          id={`chk-${field.id}`}
          checked={value === true || value === 'Y'}
          onCheckedChange={(checked) => onChange(checked ? 'Y' : 'N')}
        />
        <label htmlFor={`chk-${field.id}`} className="text-sm cursor-pointer">Yes</label>
      </div>
    )
  }

  if (field_type === 'select') {
    return (
      <Select value={value || '__na__'} onValueChange={(v) => onChange(v === '__na__' ? '' : v)}>
        <SelectTrigger>
          <SelectValue placeholder="Select…" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__na__">N/A</SelectItem>
          {visibleOptions.map((opt) => (
            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  if (field_type === 'multiple_radio') {
    return (
      <div className="flex flex-wrap gap-4">
        {visibleOptions.map((opt) => (
          <label key={opt} className="flex items-center gap-1.5 text-sm cursor-pointer">
            <input
              type="radio"
              name={`radio-${field.id}`}
              value={opt}
              checked={value === opt}
              onChange={() => onChange(opt)}
              className="accent-primary"
            />
            {opt}
          </label>
        ))}
      </div>
    )
  }

  if (field_type === 'multiple_checkbox') {
    const selected: string[] = Array.isArray(value) ? value : []
    return (
      <div className="flex flex-wrap gap-4">
        {visibleOptions.map((opt) => (
          <label key={opt} className="flex items-center gap-1.5 text-sm cursor-pointer">
            <Checkbox
              checked={selected.includes(opt)}
              onCheckedChange={(checked) => {
                if (checked) {
                  onChange([...selected, opt])
                } else {
                  onChange(selected.filter((v) => v !== opt))
                }
              }}
            />
            {opt}
          </label>
        ))}
      </div>
    )
  }

  return null
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AddTeacherReferralPage() {
  const router = useRouter()
  const { user } = useAuth()
  const schoolId = user?.school_id || ''

  const { students, isLoading: loadingStudents } = useTeacherStudents()

  const [studentId, setStudentId] = useState('')
  const [incidentDate, setIncidentDate] = useState(new Date().toISOString().split('T')[0])
  const [fieldValues, setFieldValues] = useState<Record<string, any>>({})
  const [fields, setFields] = useState<DisciplineField[]>([])
  const [loadingFields, setLoadingFields] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!schoolId) {
      setLoadingFields(false)
      return
    }
    getDisciplineFields(schoolId, 'student')
      .then((res) => setFields(res.data ?? []))
      .catch(() => toast.error('Failed to load referral fields'))
      .finally(() => setLoadingFields(false))
  }, [schoolId])

  function setFieldValue(fieldId: string, value: any) {
    setFieldValues((prev) => ({ ...prev, [fieldId]: value }))
  }

  const handleSubmit = async () => {
    if (!studentId) {
      toast.warning('Please select a student')
      return
    }
    setSubmitting(true)
    try {
      const res = await createStaffDisciplineReferral({
        student_id: studentId,
        incident_date: incidentDate,
        field_values: fieldValues,
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
        <CardContent className="pt-6 space-y-5">

          {/* Student selector */}
          <div className="space-y-1">
            <Label>Select Student <span className="text-red-500">*</span></Label>
            {loadingStudents ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Fetching your enrolled students…
              </div>
            ) : students.length === 0 ? (
              <div className="text-sm text-muted-foreground py-2">You currently have no enrolled students.</div>
            ) : (
              <Select value={studentId} onValueChange={setStudentId}>
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
            <p className="text-xs text-muted-foreground">List restricted to students under your supervision.</p>
          </div>

          {/* Incident Date */}
          <div className="space-y-1">
            <Label>Incident Date</Label>
            <Input
              type="date"
              value={incidentDate}
              onChange={(e) => setIncidentDate(e.target.value)}
              className="w-48"
            />
          </div>

          {/* Dynamic discipline fields */}
          {loadingFields ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading referral fields…
            </div>
          ) : fields.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No referral fields configured.{' '}
              <span className="text-xs">(Contact your administrator to set up discipline fields.)</span>
            </p>
          ) : (
            fields.map((field, idx) => (
              <div key={field.id}>
                {idx > 0 && <hr className="my-4 border-t" />}
                <div className="space-y-3">
                  <p className="text-base font-semibold text-blue-700">{field.name}</p>
                  <DynamicFieldInput
                    field={field}
                    value={fieldValues[field.id]}
                    onChange={(val) => setFieldValue(field.id, val)}
                  />
                </div>
              </div>
            ))
          )}

          <div className="pt-4 flex justify-end gap-3">
            <Button variant="outline" onClick={() => router.back()}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={submitting || !studentId}>
              {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Submitting…</> : 'Submit Referral'}
            </Button>
          </div>

        </CardContent>
      </Card>
    </div>
  )
}
