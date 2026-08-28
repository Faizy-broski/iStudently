'use client'

import { useEffect, useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Loader2, GraduationCap, Sparkles } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { useCampus } from '@/context/CampusContext'
import {
  listPrescriptionsForSchool, assignPrescription, dismissPrescription, listAvailableTrainingSessions,
  type TrainingPrescription, type TrainingSessionOption,
} from '@/lib/api/training-prescription'

export default function AdminTrainingPrescriptionsPage() {
  const t = useTranslations('inspections.training')
  const campusCtx = useCampus()
  const schoolId = campusCtx?.selectedCampus?.id

  const [prescriptions, setPrescriptions] = useState<TrainingPrescription[]>([])
  const [sessions, setSessions] = useState<TrainingSessionOption[]>([])
  const [loading, setLoading] = useState(true)

  const [assignTargetId, setAssignTargetId] = useState<string | null>(null)
  const [assignSessionId, setAssignSessionId] = useState('')
  const [assigning, setAssigning] = useState(false)

  const load = useCallback(() => {
    if (!schoolId) return
    setLoading(true)
    listPrescriptionsForSchool(schoolId).then((res) => {
      if (res.error) toast.error(res.error)
      setPrescriptions(res.data || [])
      setLoading(false)
    })
    listAvailableTrainingSessions(schoolId).then((res) => setSessions(res.data || []))
  }, [schoolId])

  useEffect(() => { load() }, [load])

  const handleAssign = async () => {
    if (!assignTargetId) return
    setAssigning(true)
    try {
      const res = await assignPrescription(assignTargetId, assignSessionId || undefined)
      if (res.error) toast.error(res.error)
      else { toast.success(t('msg_assigned')); setAssignTargetId(null); setAssignSessionId(''); load() }
    } finally {
      setAssigning(false)
    }
  }

  const handleDismiss = async (id: string) => {
    const res = await dismissPrescription(id)
    if (res.error) toast.error(res.error)
    else { toast.success(t('msg_dismissed')); load() }
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('admin_page_title')}</h1>
        <p className="text-sm text-gray-500 mt-1">{t('admin_page_subtitle')}</p>
      </div>

      <Card>
        <CardContent className="p-0">
          {!schoolId ? (
            <p className="text-sm text-gray-500 text-center py-12">{t('select_campus_prompt')}</p>
          ) : loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : prescriptions.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-12">{t('no_prescriptions')}</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {prescriptions.map((p) => (
                <div key={p.id} className="p-4 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-full bg-[#022172]/10 flex items-center justify-center shrink-0">
                      <GraduationCap className="h-4 w-4 text-[#022172]" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900">{p.teacher ? `${p.teacher.first_name} ${p.teacher.last_name}` : ''}</div>
                      <div className="flex items-center gap-1.5 flex-wrap my-1">
                        {p.auto_suggested && (
                          <Badge variant="outline" className="text-[10px] gap-1"><Sparkles className="h-2.5 w-2.5" />{t('auto_suggested_badge')}</Badge>
                        )}
                        <Badge variant="secondary" className="text-[10px]">{t(`status_${p.status}`)}</Badge>
                      </div>
                      {p.reason && <p className="text-sm text-gray-700">{p.reason}</p>}
                      {p.training_session && <p className="text-xs text-gray-500 mt-0.5">{t('linked_session_label')}: {p.training_session.title}</p>}
                    </div>
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
              {assigning ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t('btn_confirm_assign')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
