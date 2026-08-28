'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import {
  Loader2, Calendar, Building2, ArrowLeft, LogIn, CheckCircle2, XCircle,
  CalendarClock, Users, Plus, X, User, ClipboardCheck, GraduationCap, FileText,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger,
} from '@/components/ui/dialog'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import {
  getVisit, checkInVisit, completeVisit, cancelVisit, rescheduleVisit, setVisitTeachers,
  type VisitDetail, type VisitStatus,
} from '@/lib/api/inspection-visits'
import { listTeachersForSchool, listSubjectsForSchool, type TeacherListItem, type SubjectListItem } from '@/lib/api/inspector-teachers'

const STATUS_STYLES: Record<VisitStatus, string> = {
  scheduled: 'bg-amber-100 text-amber-800',
  confirmed: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-purple-100 text-purple-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  rescheduled: 'bg-gray-100 text-gray-600',
}

export default function InspectionVisitDetailPage() {
  const t = useTranslations('inspections.visits')
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string

  const [visit, setVisit] = useState<VisitDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)

  const [teachers, setTeachers] = useState<TeacherListItem[]>([])
  const [subjects, setSubjects] = useState<SubjectListItem[]>([])

  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')

  const [rescheduleOpen, setRescheduleOpen] = useState(false)
  const [newDate, setNewDate] = useState('')
  const [newStartTime, setNewStartTime] = useState('')
  const [newEndTime, setNewEndTime] = useState('')

  const [addTeacherOpen, setAddTeacherOpen] = useState(false)
  const [pickedTeacher, setPickedTeacher] = useState('')
  const [pickedSubject, setPickedSubject] = useState('')

  const load = useCallback(() => {
    if (!id) return
    setLoading(true)
    getVisit(id).then((res) => {
      if (res.error) toast.error(res.error)
      setVisit(res.data)
      setLoading(false)
      if (res.data) {
        listTeachersForSchool(res.data.school_id).then((r) => setTeachers(r.data || []))
        listSubjectsForSchool(res.data.school_id).then((r) => setSubjects(r.data || []))
      }
    })
  }, [id])

  useEffect(() => { load() }, [load])

  const canEdit = visit && ['scheduled', 'confirmed'].includes(visit.status)

  const handleCheckIn = async () => {
    if (!id) return
    setActing(true)
    try {
      const res = await checkInVisit(id)
      if (res.error) toast.error(res.error)
      else { toast.success(t('msg_checked_in')); load() }
    } finally { setActing(false) }
  }

  const handleComplete = async () => {
    if (!id) return
    setActing(true)
    try {
      const res = await completeVisit(id)
      if (res.error) toast.error(res.error)
      else { toast.success(t('msg_completed')); load() }
    } finally { setActing(false) }
  }

  const handleCancel = async () => {
    if (!id) return
    setActing(true)
    try {
      const res = await cancelVisit(id, cancelReason.trim() || undefined)
      if (res.error) toast.error(res.error)
      else { toast.success(t('msg_cancelled')); setCancelOpen(false); setCancelReason(''); load() }
    } finally { setActing(false) }
  }

  const handleReschedule = async () => {
    if (!id || !newDate) return
    setActing(true)
    try {
      const res = await rescheduleVisit(id, {
        scheduled_date: newDate,
        scheduled_start_time: newStartTime || undefined,
        scheduled_end_time: newEndTime || undefined,
      })
      if (res.error) toast.error(res.error)
      else {
        toast.success(t('msg_rescheduled'))
        setRescheduleOpen(false)
        router.push(`/inspector/visits/${res.data!.id}`)
      }
    } finally { setActing(false) }
  }

  const handleAddTeacher = async () => {
    if (!id || !visit || !pickedTeacher) return
    setActing(true)
    try {
      const existing = visit.teachers.map((vt) => ({ teacher_profile_id: vt.teacher_profile_id, subject_id: vt.subject_id }))
      const next = [...existing, { teacher_profile_id: pickedTeacher, subject_id: pickedSubject || null }]
      const res = await setVisitTeachers(id, next)
      if (res.error) toast.error(res.error)
      else {
        toast.success(t('msg_teacher_added'))
        setAddTeacherOpen(false)
        setPickedTeacher('')
        setPickedSubject('')
        load()
      }
    } finally { setActing(false) }
  }

  const handleRemoveTeacher = async (teacherProfileId: string, subjectId: string | null) => {
    if (!id || !visit) return
    const next = visit.teachers
      .filter((vt) => !(vt.teacher_profile_id === teacherProfileId && vt.subject_id === subjectId))
      .map((vt) => ({ teacher_profile_id: vt.teacher_profile_id, subject_id: vt.subject_id }))
    const res = await setVisitTeachers(id, next)
    if (res.error) toast.error(res.error)
    else { toast.success(t('msg_teacher_removed')); load() }
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
  }

  if (!visit) {
    return <div className="p-6 text-center text-gray-500">{t('visit_not_found')}</div>
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
      <Link href="/inspector/visits" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4" /> {t('back_to_visits')}
      </Link>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Building2 className="h-5 w-5 text-[#022172]" />
                {visit.school?.name || visit.school_id}
              </CardTitle>
              <CardDescription className="flex items-center gap-1.5 mt-1">
                <Calendar className="h-3.5 w-3.5" />
                {visit.scheduled_date}
                {visit.scheduled_start_time ? ` · ${visit.scheduled_start_time}${visit.scheduled_end_time ? ` - ${visit.scheduled_end_time}` : ''}` : ''}
              </CardDescription>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <Badge className={STATUS_STYLES[visit.status]} variant="outline">{t(`status_${visit.status}`)}</Badge>
              <Badge variant="secondary" className="text-[10px]">{t(`visit_type_${visit.visit_type}`)}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {visit.purpose && (
            <div>
              <Label className="text-xs text-gray-500">{t('field_purpose')}</Label>
              <p className="text-sm text-gray-800 mt-1">{visit.purpose}</p>
            </div>
          )}
          {visit.status === 'cancelled' && visit.cancellation_reason && (
            <div className="text-sm text-red-700 bg-red-50 rounded-md p-3">
              {t('cancellation_reason_label')}: {visit.cancellation_reason}
            </div>
          )}
          {visit.status === 'rescheduled' && (
            <div className="text-sm text-gray-600 bg-gray-50 rounded-md p-3">{t('rescheduled_notice')}</div>
          )}

          <div className="flex flex-wrap gap-2 pt-2">
            {(visit.status === 'scheduled' || visit.status === 'confirmed') && (
              <Button size="sm" onClick={handleCheckIn} disabled={acting} className="gap-2">
                {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                {t('btn_check_in')}
              </Button>
            )}
            {visit.status === 'in_progress' && (
              <Button size="sm" onClick={handleComplete} disabled={acting} className="gap-2">
                {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {t('btn_complete')}
              </Button>
            )}
            {['scheduled', 'confirmed', 'in_progress'].includes(visit.status) && (
              <Button asChild size="sm" variant="outline" className="gap-2">
                <Link href={`/inspector/visits/${visit.id}/observe`}>
                  <ClipboardCheck className="h-4 w-4" />
                  {t('btn_observe')}
                </Link>
              </Button>
            )}
            {!['cancelled', 'rescheduled'].includes(visit.status) && (
              <Button asChild size="sm" variant="outline" className="gap-2">
                <Link href={`/inspector/visits/${visit.id}/coaching`}>
                  <GraduationCap className="h-4 w-4" />
                  {t('btn_coaching')}
                </Link>
              </Button>
            )}
            {!['cancelled', 'rescheduled'].includes(visit.status) && (
              <Button asChild size="sm" variant="outline" className="gap-2">
                <Link href={`/inspector/visits/${visit.id}/report`}>
                  <FileText className="h-4 w-4" />
                  {t('btn_report')}
                </Link>
              </Button>
            )}
            {canEdit && (
              <Dialog open={rescheduleOpen} onOpenChange={setRescheduleOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" className="gap-2">
                    <CalendarClock className="h-4 w-4" />
                    {t('btn_reschedule')}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t('dialog_reschedule_title')}</DialogTitle>
                    <DialogDescription>{t('dialog_reschedule_desc')}</DialogDescription>
                  </DialogHeader>
                  <div className="grid grid-cols-3 gap-3 py-2">
                    <div className="space-y-1.5 col-span-3 sm:col-span-1">
                      <Label>{t('field_date')}</Label>
                      <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>{t('field_start_time')}</Label>
                      <Input type="time" value={newStartTime} onChange={(e) => setNewStartTime(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>{t('field_end_time')}</Label>
                      <Input type="time" value={newEndTime} onChange={(e) => setNewEndTime(e.target.value)} />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={handleReschedule} disabled={acting || !newDate} className="gap-2">
                      {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />}
                      {t('btn_confirm_reschedule')}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
            {canEdit && (
              <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" className="gap-2 text-destructive">
                    <XCircle className="h-4 w-4" />
                    {t('btn_cancel_visit')}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t('dialog_cancel_title')}</DialogTitle>
                    <DialogDescription>{t('dialog_cancel_desc')}</DialogDescription>
                  </DialogHeader>
                  <div className="py-2 space-y-1.5">
                    <Label>{t('field_cancellation_reason')}</Label>
                    <Textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} rows={3} />
                  </div>
                  <DialogFooter>
                    <Button onClick={handleCancel} disabled={acting} variant="destructive" className="gap-2">
                      {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                      {t('btn_confirm_cancel')}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-5 w-5 text-[#022172]" />
            {t('teachers_title')}
          </CardTitle>
          {canEdit && (
            <Dialog open={addTeacherOpen} onOpenChange={setAddTeacherOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="gap-2">
                  <Plus className="h-4 w-4" />
                  {t('btn_add_teacher')}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t('dialog_add_teacher_title')}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 py-2">
                  <div className="space-y-1.5">
                    <Label>{t('field_teacher')}</Label>
                    <Select value={pickedTeacher} onValueChange={setPickedTeacher}>
                      <SelectTrigger><SelectValue placeholder={t('field_teacher_placeholder')} /></SelectTrigger>
                      <SelectContent>
                        {teachers.map((tc) => (
                          <SelectItem key={tc.id} value={tc.id}>{tc.first_name} {tc.last_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t('field_subject_optional')}</Label>
                    <Select value={pickedSubject} onValueChange={setPickedSubject}>
                      <SelectTrigger><SelectValue placeholder={t('field_subject_placeholder')} /></SelectTrigger>
                      <SelectContent>
                        {subjects.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleAddTeacher} disabled={acting || !pickedTeacher} className="gap-2">
                    {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    {t('btn_add')}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </CardHeader>
        <CardContent>
          {visit.teachers.length === 0 ? (
            <p className="text-sm text-gray-500 py-4">{t('no_teachers')}</p>
          ) : (
            <div className="space-y-1.5">
              {visit.teachers.map((vt) => (
                <div key={vt.id} className="flex items-center justify-between p-2.5 rounded-md border">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-gray-400" />
                    <span className="text-sm">{vt.teacher ? `${vt.teacher.first_name} ${vt.teacher.last_name}` : vt.teacher_profile_id}</span>
                    {vt.subject && <Badge variant="outline" className="text-[10px]">{vt.subject.name}</Badge>}
                  </div>
                  {canEdit && (
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                      onClick={() => handleRemoveTeacher(vt.teacher_profile_id, vt.subject_id)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
