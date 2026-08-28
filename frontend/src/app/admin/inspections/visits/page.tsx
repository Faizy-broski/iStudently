'use client'

import { useEffect, useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Loader2, Calendar, CheckCircle2, XCircle, UserCog } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger,
} from '@/components/ui/dialog'
import { useCampus } from '@/context/CampusContext'
import {
  listVisitsForSchool, confirmVisit, cancelVisit, type InspectionVisit, type VisitStatus,
} from '@/lib/api/inspection-visits'

const STATUS_STYLES: Record<VisitStatus, string> = {
  scheduled: 'bg-amber-100 text-amber-800',
  confirmed: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-purple-100 text-purple-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  rescheduled: 'bg-gray-100 text-gray-600',
}

export default function AdminInspectionVisitsPage() {
  const t = useTranslations('inspections.visits')
  const campusCtx = useCampus()
  const schoolId = campusCtx?.selectedCampus?.id

  const [visits, setVisits] = useState<InspectionVisit[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)

  const [cancelTarget, setCancelTarget] = useState<InspectionVisit | null>(null)
  const [cancelReason, setCancelReason] = useState('')

  const load = useCallback(() => {
    if (!schoolId) return
    setLoading(true)
    listVisitsForSchool(schoolId).then((res) => {
      if (res.error) toast.error(res.error)
      setVisits(res.data || [])
      setLoading(false)
    })
  }, [schoolId])

  useEffect(() => { load() }, [load])

  const handleConfirm = async (visitId: string) => {
    setActing(visitId)
    try {
      const res = await confirmVisit(visitId)
      if (res.error) toast.error(res.error)
      else { toast.success(t('msg_confirmed')); load() }
    } finally { setActing(null) }
  }

  const handleCancel = async () => {
    if (!cancelTarget) return
    setActing(cancelTarget.id)
    try {
      const res = await cancelVisit(cancelTarget.id, cancelReason.trim() || undefined)
      if (res.error) toast.error(res.error)
      else { toast.success(t('msg_cancelled')); setCancelTarget(null); setCancelReason(''); load() }
    } finally { setActing(null) }
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
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
          ) : visits.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-12">{t('no_visits')}</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {visits.map((v) => (
                <div key={v.id} className="flex items-center justify-between gap-3 p-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-full bg-[#022172]/10 flex items-center justify-center shrink-0">
                      <UserCog className="h-4 w-4 text-[#022172]" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {v.inspector ? `${v.inspector.first_name} ${v.inspector.last_name}` : t('inspector_label')}
                      </div>
                      <div className="text-xs text-gray-500 flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {v.scheduled_date}
                        {v.scheduled_start_time ? ` · ${v.scheduled_start_time}` : ''}
                        <Badge variant="secondary" className="text-[10px] ml-1">{t(`visit_type_${v.visit_type}`)}</Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge className={STATUS_STYLES[v.status]} variant="outline">{t(`status_${v.status}`)}</Badge>
                    {v.status === 'scheduled' && (
                      <>
                        <Button
                          size="sm" variant="outline" className="gap-1.5 h-8"
                          onClick={() => handleConfirm(v.id)}
                          disabled={acting === v.id}
                        >
                          {acting === v.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                          {t('btn_confirm')}
                        </Button>
                        <Button
                          size="sm" variant="outline" className="gap-1.5 h-8 text-destructive"
                          onClick={() => setCancelTarget(v)}
                          disabled={acting === v.id}
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          {t('btn_cancel_visit')}
                        </Button>
                      </>
                    )}
                    {v.status === 'confirmed' && (
                      <Button
                        size="sm" variant="outline" className="gap-1.5 h-8 text-destructive"
                        onClick={() => setCancelTarget(v)}
                        disabled={acting === v.id}
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        {t('btn_cancel_visit')}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!cancelTarget} onOpenChange={(open) => { if (!open) setCancelTarget(null) }}>
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
            <Button onClick={handleCancel} disabled={!!acting} variant="destructive" className="gap-2">
              {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
              {t('btn_confirm_cancel')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
