'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import {
  Loader2, ArrowLeft, Plus, X, ThumbsUp, TrendingUp, ListChecks, GraduationCap, Sparkles,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from '@/components/ui/dialog'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { getVisit, type VisitDetail } from '@/lib/api/inspection-visits'
import { listEvaluationsForVisit } from '@/lib/api/inspection-evaluation'
import {
  listNotes, addNote, deleteNote, type CoachingNote, type CoachingNoteType,
} from '@/lib/api/inspection-coaching'
import {
  listPrescriptionsForEvaluation, createManualPrescription, assignPrescription, dismissPrescription,
  listAvailableTrainingSessions, type TrainingPrescription, type TrainingSessionOption,
} from '@/lib/api/training-prescription'

type EvalListItem = { id: string; status: string; overall_score: number | null; teacher: { id: string; first_name: string; last_name: string } }

const NOTE_TYPES: { key: CoachingNoteType; icon: typeof ThumbsUp }[] = [
  { key: 'strength', icon: ThumbsUp },
  { key: 'area_for_growth', icon: TrendingUp },
  { key: 'action_item', icon: ListChecks },
]

export default function CoachingPage() {
  const t = useTranslations('inspections.coaching')
  const params = useParams()
  const visitId = params?.id as string

  const [visit, setVisit] = useState<VisitDetail | null>(null)
  const [evaluations, setEvaluations] = useState<EvalListItem[]>([])
  const [selectedEvalId, setSelectedEvalId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const [notes, setNotes] = useState<CoachingNote[]>([])
  const [prescriptions, setPrescriptions] = useState<TrainingPrescription[]>([])
  const [sessions, setSessions] = useState<TrainingSessionOption[]>([])
  const [loadingDetail, setLoadingDetail] = useState(false)

  const [noteDialogType, setNoteDialogType] = useState<CoachingNoteType | null>(null)
  const [noteContent, setNoteContent] = useState('')
  const [noteTargetDate, setNoteTargetDate] = useState('')
  const [savingNote, setSavingNote] = useState(false)

  const [prescriptionOpen, setPrescriptionOpen] = useState(false)
  const [prescriptionReason, setPrescriptionReason] = useState('')
  const [prescriptionSessionId, setPrescriptionSessionId] = useState('')
  const [savingPrescription, setSavingPrescription] = useState(false)

  const [assignTargetId, setAssignTargetId] = useState<string | null>(null)
  const [assignSessionId, setAssignSessionId] = useState('')
  const [assigning, setAssigning] = useState(false)

  useEffect(() => {
    if (!visitId) return
    setLoading(true)
    getVisit(visitId).then((res) => {
      setVisit(res.data)
      listEvaluationsForVisit(visitId).then((evalRes) => {
        setEvaluations(evalRes.data || [])
        if (evalRes.data && evalRes.data.length > 0) setSelectedEvalId(evalRes.data[0].id)
        setLoading(false)
      })
    })
  }, [visitId])

  const loadDetail = useCallback(() => {
    if (!selectedEvalId) return
    setLoadingDetail(true)
    Promise.all([listNotes(selectedEvalId), listPrescriptionsForEvaluation(selectedEvalId)]).then(([notesRes, presRes]) => {
      setNotes(notesRes.data || [])
      setPrescriptions(presRes.data || [])
      setLoadingDetail(false)
    })
  }, [selectedEvalId])

  useEffect(() => { loadDetail() }, [loadDetail])

  useEffect(() => {
    if (!visit) return
    listAvailableTrainingSessions(visit.school_id).then((res) => setSessions(res.data || []))
  }, [visit])

  const handleAddNote = async () => {
    if (!selectedEvalId || !noteDialogType || !noteContent.trim()) return
    setSavingNote(true)
    try {
      const res = await addNote(selectedEvalId, {
        note_type: noteDialogType,
        content: noteContent.trim(),
        target_date: noteDialogType === 'action_item' ? (noteTargetDate || undefined) : undefined,
      })
      if (res.error) toast.error(res.error)
      else {
        toast.success(t('msg_note_added'))
        setNoteDialogType(null)
        setNoteContent('')
        setNoteTargetDate('')
        loadDetail()
      }
    } finally {
      setSavingNote(false)
    }
  }

  const handleDeleteNote = async (id: string) => {
    const res = await deleteNote(id)
    if (res.error) toast.error(res.error)
    else { toast.success(t('msg_note_deleted')); loadDetail() }
  }

  const handleAddPrescription = async () => {
    if (!selectedEvalId) return
    setSavingPrescription(true)
    try {
      const res = await createManualPrescription(selectedEvalId, {
        reason: prescriptionReason.trim() || undefined,
        training_session_id: prescriptionSessionId || undefined,
      })
      if (res.error) toast.error(res.error)
      else {
        toast.success(t('msg_prescription_added'))
        setPrescriptionOpen(false)
        setPrescriptionReason('')
        setPrescriptionSessionId('')
        loadDetail()
      }
    } finally {
      setSavingPrescription(false)
    }
  }

  const handleAssign = async () => {
    if (!assignTargetId) return
    setAssigning(true)
    try {
      const res = await assignPrescription(assignTargetId, assignSessionId || undefined)
      if (res.error) toast.error(res.error)
      else { toast.success(t('msg_assigned')); setAssignTargetId(null); setAssignSessionId(''); loadDetail() }
    } finally {
      setAssigning(false)
    }
  }

  const handleDismiss = async (id: string) => {
    const res = await dismissPrescription(id)
    if (res.error) toast.error(res.error)
    else { toast.success(t('msg_dismissed')); loadDetail() }
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
  }
  if (!visit) {
    return <div className="p-6 text-center text-gray-500">{t('visit_not_found')}</div>
  }

  return (
    <div className="p-3 sm:p-6 max-w-4xl mx-auto space-y-5">
      <Link href={`/inspector/visits/${visitId}`} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4" /> {t('back_to_visit')}
      </Link>

      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{t('page_title')}</h1>
        <p className="text-sm text-gray-500">{visit.school?.name} · {visit.scheduled_date}</p>
      </div>

      {evaluations.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-gray-500">{t('no_evaluations')}</CardContent></Card>
      ) : (
        <>
          {evaluations.length > 1 && (
            <div className="flex gap-2 flex-wrap">
              {evaluations.map((ev) => (
                <button
                  key={ev.id}
                  onClick={() => setSelectedEvalId(ev.id)}
                  className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                    selectedEvalId === ev.id ? 'bg-[#022172] text-white border-[#022172]' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {ev.teacher.first_name} {ev.teacher.last_name}
                </button>
              ))}
            </div>
          )}

          {loadingDetail ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="space-y-4">
              {NOTE_TYPES.map(({ key, icon: Icon }) => (
                <Card key={key}>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Icon className="h-4 w-4 text-[#022172]" />
                      {t(`note_type_${key}`)}
                    </CardTitle>
                    <Dialog open={noteDialogType === key} onOpenChange={(open) => setNoteDialogType(open ? key : null)}>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="outline" className="gap-1.5">
                          <Plus className="h-3.5 w-3.5" />
                          {t('btn_add_note')}
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader><DialogTitle>{t(`dialog_add_${key}`)}</DialogTitle></DialogHeader>
                        <div className="space-y-3 py-2">
                          <Textarea rows={3} value={noteContent} onChange={(e) => setNoteContent(e.target.value)} placeholder={t('field_note_placeholder')} />
                          {key === 'action_item' && (
                            <div className="space-y-1.5">
                              <Label>{t('field_target_date')}</Label>
                              <Input type="date" value={noteTargetDate} onChange={(e) => setNoteTargetDate(e.target.value)} />
                            </div>
                          )}
                        </div>
                        <DialogFooter>
                          <Button onClick={handleAddNote} disabled={savingNote || !noteContent.trim()} className="gap-2">
                            {savingNote ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                            {t('btn_save')}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </CardHeader>
                  <CardContent>
                    {notes.filter((n) => n.note_type === key).length === 0 ? (
                      <p className="text-sm text-gray-500 py-2">{t('no_notes')}</p>
                    ) : (
                      <div className="space-y-1.5">
                        {notes.filter((n) => n.note_type === key).map((n) => (
                          <div key={n.id} className="flex items-start justify-between gap-2 p-2.5 rounded-md border text-sm">
                            <div>
                              <p className="text-gray-800">{n.content}</p>
                              {n.target_date && <p className="text-xs text-gray-500 mt-0.5">{t('target_date_label')}: {n.target_date}</p>}
                            </div>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive shrink-0" onClick={() => handleDeleteNote(n.id)}>
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}

              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <GraduationCap className="h-4 w-4 text-[#022172]" />
                      {t('prescriptions_title')}
                    </CardTitle>
                    <CardDescription>{t('prescriptions_desc')}</CardDescription>
                  </div>
                  <Dialog open={prescriptionOpen} onOpenChange={setPrescriptionOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline" className="gap-1.5">
                        <Plus className="h-3.5 w-3.5" />
                        {t('btn_add_prescription')}
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>{t('dialog_add_prescription')}</DialogTitle></DialogHeader>
                      <div className="space-y-3 py-2">
                        <div className="space-y-1.5">
                          <Label>{t('field_reason')}</Label>
                          <Textarea rows={2} value={prescriptionReason} onChange={(e) => setPrescriptionReason(e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                          <Label>{t('field_training_session_optional')}</Label>
                          <Select value={prescriptionSessionId} onValueChange={setPrescriptionSessionId}>
                            <SelectTrigger><SelectValue placeholder={t('field_training_session_placeholder')} /></SelectTrigger>
                            <SelectContent>
                              {sessions.map((s) => (
                                <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button onClick={handleAddPrescription} disabled={savingPrescription} className="gap-2">
                          {savingPrescription ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                          {t('btn_save')}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </CardHeader>
                <CardContent>
                  {prescriptions.length === 0 ? (
                    <p className="text-sm text-gray-500 py-2">{t('no_prescriptions')}</p>
                  ) : (
                    <div className="space-y-1.5">
                      {prescriptions.map((p) => (
                        <div key={p.id} className="flex items-start justify-between gap-2 p-2.5 rounded-md border text-sm">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {p.auto_suggested && (
                                <Badge variant="outline" className="text-[10px] gap-1"><Sparkles className="h-2.5 w-2.5" />{t('auto_suggested_badge')}</Badge>
                              )}
                              <Badge variant="secondary" className="text-[10px]">{t(`prescription_status_${p.status}`)}</Badge>
                              {p.criterion && <span className="text-xs text-gray-500">{p.criterion.name}</span>}
                            </div>
                            {p.reason && <p className="text-gray-700 mt-1">{p.reason}</p>}
                            {p.training_session && <p className="text-xs text-gray-500 mt-0.5">{t('linked_session_label')}: {p.training_session.title}</p>}
                          </div>
                          {(p.status === 'suggested' || p.status === 'assigned') && (
                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                size="sm" variant="outline" className="h-7 text-xs"
                                onClick={() => { setAssignTargetId(p.id); setAssignSessionId(p.training_session_id || '') }}
                              >
                                {t('btn_assign')}
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={() => handleDismiss(p.id)}>
                                {t('btn_dismiss')}
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}

      <Dialog open={!!assignTargetId} onOpenChange={(open) => { if (!open) setAssignTargetId(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('dialog_assign_title')}</DialogTitle></DialogHeader>
          <div className="py-2 space-y-1.5">
            <Label>{t('field_training_session_optional')}</Label>
            <Select value={assignSessionId} onValueChange={setAssignSessionId}>
              <SelectTrigger><SelectValue placeholder={t('field_training_session_placeholder')} /></SelectTrigger>
              <SelectContent>
                {sessions.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button onClick={handleAssign} disabled={assigning} className="gap-2">
              {assigning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {t('btn_confirm_assign')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
