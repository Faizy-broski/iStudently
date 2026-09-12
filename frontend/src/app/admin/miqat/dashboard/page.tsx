'use client'

import { useEffect, useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, CheckCircle2, Clock, XCircle, AlertTriangle } from 'lucide-react'
import { getAuthToken } from '@/lib/api/schools'
import { getSummary, MiqatDaySummaryRow } from '@/lib/api/miqat'
import { useCampus } from '@/context/CampusContext'

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

export default function MiqatDashboardPage() {
  const t = useTranslations('miqat.dashboard')
  const locale = useLocale()
  const isAr = locale === 'ar'
  const campusId = useCampus()?.selectedCampus?.id

  const [rows, setRows] = useState<MiqatDaySummaryRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      const token = await getAuthToken()
      if (!token) return
      const date = todayIso()
      const res = await getSummary(date, date, token, campusId)
      if (res.success && res.data) setRows(res.data)
      setLoading(false)
    })()
  }, [campusId])

  const total = rows.length
  const present = rows.filter((r) => r.status === 'present').length
  const late = rows.filter((r) => r.status === 'late').length
  const absent = rows.filter((r) => r.status === 'absent').length
  const unclosed = rows.filter((r) => r.status === 'unclosed').length
  const attendancePct = total > 0 ? Math.round(((present + late) / total) * 100) : 0

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6" dir={isAr ? 'rtl' : 'ltr'}>
      <h1 className="text-2xl font-bold">{t('title')}</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t('attendanceToday')}</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{attendancePct}%</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-600" /><CardTitle className="text-sm text-muted-foreground">{t('present')}</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{present}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center gap-2"><Clock className="h-4 w-4 text-amber-600" /><CardTitle className="text-sm text-muted-foreground">{t('late')}</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{late}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center gap-2"><XCircle className="h-4 w-4 text-red-600" /><CardTitle className="text-sm text-muted-foreground">{t('absent')}</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{absent}</div></CardContent>
        </Card>
      </div>

      {unclosed > 0 && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="p-4 flex items-center gap-2 text-amber-800 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4" />
            <span>{t('unclosedWarning', { count: unclosed })}</span>
          </CardContent>
        </Card>
      )}

      {total === 0 && <p className="text-muted-foreground text-sm">{t('noData')}</p>}
    </div>
  )
}
