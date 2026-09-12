'use client'

import { useEffect, useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, CheckCircle2, Clock, XCircle, AlertTriangle, Send } from 'lucide-react'
import { getAuthToken } from '@/lib/api/schools'
import { getMyChildren, getChildDays, createPermission, MiqatChild, MiqatDayRow } from '@/lib/api/miqat'
import { useCampus } from '@/context/CampusContext'
import { toast } from 'sonner'

const STATUS_ICON: Record<string, any> = {
  present: <CheckCircle2 className="h-4 w-4 text-green-600" />,
  late: <Clock className="h-4 w-4 text-amber-600" />,
  absent: <XCircle className="h-4 w-4 text-red-600" />,
  excused: <CheckCircle2 className="h-4 w-4 text-blue-600" />,
  unclosed: <AlertTriangle className="h-4 w-4 text-amber-600" />,
}

function monthRange() {
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  const to = now.toISOString().slice(0, 10)
  return { from, to }
}

export default function ParentMiqatPage() {
  const t = useTranslations('miqat.guardian')
  const locale = useLocale()
  const isAr = locale === 'ar'
  const campusId = useCampus()?.selectedCampus?.id

  const [children, setChildren] = useState<MiqatChild[]>([])
  const [selected, setSelected] = useState<string>('')
  const [days, setDays] = useState<MiqatDayRow[]>([])
  const [loading, setLoading] = useState(true)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    (async () => {
      const token = await getAuthToken()
      if (!token) return
      const res = await getMyChildren(token, campusId)
      if (res.success && res.data) {
        setChildren(res.data)
        if (res.data.length > 0) setSelected(res.data[0].profileId)
      }
      setLoading(false)
    })()
  }, [campusId])

  useEffect(() => {
    if (!selected) return
    (async () => {
      const token = await getAuthToken()
      if (!token) return
      const { from, to } = monthRange()
      const res = await getChildDays(selected, from, to, token, campusId)
      if (res.success && res.data) setDays(res.data)
    })()
  }, [selected, campusId])

  const accumulatedLateness = days.reduce((sum, d) => sum + (d.lateness_minutes || 0), 0)

  const handleRequestExcuse = async () => {
    const token = await getAuthToken()
    if (!token || !selected) return
    setSubmitting(true)
    const today = new Date().toISOString().slice(0, 10)
    const res = await createPermission({ person_id: selected, type: 'full_day', date_from: today, date_to: today, reason }, token, campusId)
    setSubmitting(false)
    if (res.success) {
      toast.success(t('requestSubmitted'))
      setReason('')
    } else {
      toast.error(res.error || t('requestError'))
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-[300px]"><Loader2 className="h-8 w-8 animate-spin" /></div>
  }

  if (children.length === 0) {
    return <div className="p-6 text-muted-foreground">{t('noChildren')}</div>
  }

  return (
    <div className="space-y-6 p-6 max-w-2xl" dir={isAr ? 'rtl' : 'ltr'}>
      <h1 className="text-2xl font-bold">{t('title')}</h1>

      {children.length > 1 && (
        <Select value={selected} onValueChange={setSelected}>
          <SelectTrigger className="w-[240px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {children.map((c) => (
              <SelectItem key={c.profileId} value={c.profileId}>{c.firstName} {c.lastName}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <Card>
        <CardContent className="p-4">
          <div className="text-sm text-muted-foreground">{t('accumulatedLateness')}</div>
          <div className="text-2xl font-bold">{accumulatedLateness} {t('minutes')}</div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 divide-y">
          {days.length === 0 && <p className="p-4 text-sm text-muted-foreground">{t('noRecords')}</p>}
          {days.map((d) => (
            <div key={d.id} className="flex items-center justify-between p-3">
              <span>{d.date}</span>
              <div className="flex items-center gap-2">
                {STATUS_ICON[d.status]}
                <Badge variant="outline">{t(`status.${d.status}`)}</Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="font-medium">{t('submitExcuse')}</div>
          <textarea
            className="w-full border rounded-md p-2 text-sm"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('reasonPlaceholder')}
          />
          <Button onClick={handleRequestExcuse} disabled={submitting || !reason.trim()}>
            {submitting ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <Send className="h-4 w-4 me-2" />}
            {t('submit')}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
