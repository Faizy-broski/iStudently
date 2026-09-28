'use client'

import { useEffect, useState, useCallback } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Check, X, AlertTriangle } from 'lucide-react'
import { getAuthToken } from '@/lib/api/schools'
import { listAlerts, approveAlert, rejectAlert, type AlertStatus, type WeatherAlert } from '@/lib/api/weather'
import { useCampus } from '@/context/CampusContext'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const STATUSES: AlertStatus[] = ['draft', 'approved', 'sent', 'rejected', 'expired']

const SEVERITY_COLOR: Record<string, string> = {
  minor: 'bg-blue-100 text-blue-800',
  moderate: 'bg-amber-100 text-amber-800',
  severe: 'bg-orange-100 text-orange-800',
  extreme: 'bg-red-100 text-red-800',
}

export default function WeatherAlertsDashboardPage() {
  const t = useTranslations('weather_alerts.dashboard')
  const locale = useLocale()
  const isAr = locale === 'ar'
  const campusCtx = useCampus()
  const campusId = campusCtx?.selectedCampus?.id

  const [status, setStatus] = useState<AlertStatus>('draft')
  const [alerts, setAlerts] = useState<WeatherAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const token = await getAuthToken()
    if (!token) { setLoading(false); return }
    const res = await listAlerts(token, status, campusId)
    if (res.success) setAlerts(res.data ?? [])
    else toast.error(res.error || t('loadError'))
    setLoading(false)
  }, [status, campusId, t])

  useEffect(() => { load() }, [load])

  const handleApprove = async (id: string) => {
    const token = await getAuthToken()
    if (!token) return
    setBusyId(id)
    const res = await approveAlert(id, token, campusId)
    setBusyId(null)
    if (res.success) {
      toast.success(t('approveSuccess'))
      load()
    } else {
      toast.error(res.error || t('approveError'))
    }
  }

  const handleReject = async (id: string) => {
    if (!rejectReason.trim()) return
    const token = await getAuthToken()
    if (!token) return
    setBusyId(id)
    const res = await rejectAlert(id, rejectReason.trim(), token, campusId)
    setBusyId(null)
    if (res.success) {
      toast.success(t('rejectSuccess'))
      setRejectingId(null)
      setRejectReason('')
      load()
    } else {
      toast.error(res.error || t('rejectError'))
    }
  }

  return (
    <div className="space-y-6 p-6" dir={isAr ? 'rtl' : 'ltr'}>
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><AlertTriangle className="h-6 w-6" /> {t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('description')}</p>
      </div>

      <Tabs value={status} onValueChange={(v) => setStatus(v as AlertStatus)}>
        <TabsList>
          {STATUSES.map((s) => (
            <TabsTrigger key={s} value={s}>{t(`status.${s}`)}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin" /></div>
      ) : alerts.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">{t('empty')}</p>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <Card key={alert.id}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge className={cn('capitalize', SEVERITY_COLOR[alert.severity])}>{t(`severity.${alert.severity}`)}</Badge>
                      {alert.alert_type && <span className="text-xs text-muted-foreground">{alert.alert_type}</span>}
                    </div>
                    <p className="font-semibold mt-1">{alert.headline}</p>
                    <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{alert.description}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {alert.effective && new Date(alert.effective).toLocaleString()}
                      {alert.expires && ` — ${new Date(alert.expires).toLocaleString()}`}
                    </p>
                    {alert.status === 'sent' && alert.sent_via && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {t('sentVia', {
                          channels: Object.entries(alert.sent_via)
                            .filter(([k, v]) => (k === 'push' || k === 'portalNoteId') && v)
                            .map(([k]) => (k === 'push' ? t('channelPush') : t('channelPortal')))
                            .join(', '),
                        })}
                      </p>
                    )}
                    {alert.status === 'rejected' && alert.rejection_reason && (
                      <p className="text-xs text-muted-foreground mt-1">{t('rejectedReason', { reason: alert.rejection_reason })}</p>
                    )}
                  </div>

                  {alert.status === 'draft' && (
                    <div className="flex flex-col gap-2 shrink-0">
                      <Button size="sm" onClick={() => handleApprove(alert.id)} disabled={busyId === alert.id}>
                        {busyId === alert.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 me-1" />}
                        {t('approve')}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setRejectingId(rejectingId === alert.id ? null : alert.id)}>
                        <X className="h-4 w-4 me-1" />{t('reject')}
                      </Button>
                    </div>
                  )}
                </div>

                {rejectingId === alert.id && (
                  <div className="pt-2 border-t space-y-2">
                    <Textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder={t('rejectReasonPlaceholder')}
                      rows={2}
                    />
                    <Button size="sm" variant="destructive" onClick={() => handleReject(alert.id)} disabled={!rejectReason.trim() || busyId === alert.id}>
                      {t('confirmReject')}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
