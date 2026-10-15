'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { format, parseISO } from 'date-fns'
import { BookOpen, CheckCircle, Loader2, Plus, Search } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/context/AuthContext'
import { useCampus } from '@/context/CampusContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DynamicFieldInput } from '@/components/admin/discipline/AddReferralForm'
import {
  createDisciplineReferral,
  getDisciplineFields,
  getDisciplineReferrals,
  type DisciplineField,
  type DisciplineReferral,
} from '@/lib/api/discipline'
import { searchStudents, type Student } from '@/lib/api/library'

// The API joins the student's name under `students.profile`.
function studentName(r: DisciplineReferral): string {
  const s = r.students as unknown as { first_name?: string; last_name?: string; student_number?: string; profile?: { first_name?: string; last_name?: string } } | null
  const first = s?.profile?.first_name ?? s?.first_name ?? ''
  const last = s?.profile?.last_name ?? s?.last_name ?? ''
  return `${first} ${last}`.trim() || s?.student_number || '—'
}

function fieldText(v: unknown): string {
  if (v === null || v === undefined || v === '') return ''
  if (Array.isArray(v)) return v.join(', ')
  if (typeof v === 'boolean') return v ? '✓' : '✗'
  return String(v)
}

/**
 * Library incidents (e.g. a damaged or lost book), filed as discipline referrals marked
 * library-related. The server gives librarians only those, never behaviour records.
 */
export default function LibrarianDisciplinePage() {
  const t = useTranslations('discipline')
  const { profile, user } = useAuth()
  const campusCtx = useCampus()
  const campusId = campusCtx?.selectedCampus?.id ?? null
  const schoolId = profile?.school_id ?? null
  const [referrals, setReferrals] = useState<DisciplineReferral[]>([])
  const [fields, setFields] = useState<DisciplineField[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<Student[]>([])
  const [student, setStudent] = useState<Student | null>(null)
  const [incidentDate, setIncidentDate] = useState(new Date().toISOString().slice(0, 10))
  const [values, setValues] = useState<Record<string, unknown>>({})
  const [version, setVersion] = useState(0)
  const [saving, setSaving] = useState(false)

  // Reloads when the school / campus changes or after a report is filed (`version`).
  useEffect(() => {
    if (!schoolId) return
    let alive = true
    Promise.all([
      getDisciplineReferrals({ school_id: schoolId, campus_id: campusId ?? undefined, library_related: true, limit: 50 }),
      getDisciplineFields(schoolId, 'student'),
    ]).then(([refs, flds]) => {
      if (!alive) return
      if (refs.error) setError(refs.error)
      else {
        setError(null)
        setReferrals(refs.data ?? [])
      }
      setFields((flds.data as DisciplineField[] | undefined) ?? [])
      setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [schoolId, campusId, version])

  const searching = open && !student && query.trim().length >= 2
  useEffect(() => {
    const q = query.trim()
    const token = user?.access_token
    if (!searching || !token) return
    const timer = setTimeout(async () => {
      const res = await searchStudents(q, token, campusId)
      setHits(res.success && res.data ? res.data : [])
    }, 300)
    return () => clearTimeout(timer)
  }, [query, searching, user?.access_token, campusId])
  const shownHits = searching ? hits : []

  const resetForm = () => {
    setQuery('')
    setHits([])
    setStudent(null)
    setIncidentDate(new Date().toISOString().slice(0, 10))
    setValues({})
  }

  const submit = async () => {
    if (!schoolId || !student) return
    setSaving(true)
    const res = await createDisciplineReferral({
      school_id: schoolId,
      campus_id: campusId,
      student_id: student.id,
      incident_date: incidentDate,
      field_values: values,
      library_related: true,
    })
    setSaving(false)
    if (res.error) {
      toast.error(res.error)
      return
    }
    toast.success(t('toasts.referralAdded'))
    setOpen(false)
    resetForm()
    setVersion((v) => v + 1)
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-[#022172]" />
          <div>
            <h1 className="text-2xl font-bold text-[#022172] dark:text-white">{t('libraryIncidentsTitle')}</h1>
            <p className="text-muted-foreground text-sm">{t('libraryIncidentsSubtitle')}</p>
          </div>
        </div>
        <Button onClick={() => setOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          {t('add')}
        </Button>
      </div>

      {loading && schoolId ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : referrals.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-500" />
            <p className="text-lg font-semibold">{t('noLibraryIncidents')}</p>
            <p className="text-muted-foreground mt-1">{t('noLibraryIncidentsDesc')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{t('libraryIncidentCount', { count: referrals.length })}</p>
          {referrals.map((r) => (
            <Card key={r.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{studentName(r)}</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {[(r.students as { student_number?: string } | null | undefined)?.student_number, r.incident_date ? format(parseISO(r.incident_date), 'MMM d, yyyy') : null].filter(Boolean).join(' · ')}
                </p>
              </CardHeader>
              <CardContent className="pt-0 space-y-1 text-sm">
                {fields
                  .filter((f) => fieldText(r.field_values?.[f.id]))
                  .map((f) => (
                    <p key={f.id}>
                      <span className="text-muted-foreground">{f.name}:</span> {fieldText(r.field_values?.[f.id])}
                    </p>
                  ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm() }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('libraryIncidentsTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t('student')} *</Label>
              {student ? (
                <div className="flex items-center justify-between rounded-md border p-2 text-sm">
                  <span>{student.first_name} {student.last_name} ({student.admission_number})</span>
                  <Button variant="ghost" size="sm" onClick={() => setStudent(null)}>{t('change')}</Button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="absolute start-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('search_placeholder')} className="ps-9" />
                  </div>
                  {shownHits.length > 0 && (
                    <div className="border rounded-md divide-y max-h-48 overflow-y-auto">
                      {shownHits.map((s) => (
                        <button key={s.id} type="button" className="w-full text-start p-2 text-sm hover:bg-muted" onClick={() => setStudent(s)}>
                          {s.first_name} {s.last_name} <span className="text-muted-foreground">({s.admission_number})</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>{t('incidentDate')} *</Label>
              <Input type="date" value={incidentDate} onChange={(e) => setIncidentDate(e.target.value)} className="w-48" />
            </div>
            {fields.map((f) => (
              <div key={f.id} className="space-y-1.5">
                <Label>{f.name}</Label>
                <DynamicFieldInput field={f} value={values[f.id]} onChange={(v) => setValues((x) => ({ ...x, [f.id]: v }))} />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t('cancel')}</Button>
            <Button onClick={submit} disabled={saving || !student} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('add')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
