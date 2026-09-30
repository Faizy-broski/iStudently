'use client'

import { useEffect, useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, CheckCircle2, Clock, XCircle, AlertTriangle, LogIn, LogOut, Radio } from 'lucide-react'
import { getAuthToken } from '@/lib/api/schools'
import { getSummary, getDay, MiqatDaySummaryRow, MiqatDayEvent } from '@/lib/api/miqat'
import { useCampus } from '@/context/CampusContext'

// Live activity re-fetches on this interval — cheap enough for a small
// per-day event list, and gives a "real-time enough" feel without a
// websocket. Independent of the once-daily miqat_days rollup below.
const LIVE_POLL_MS = 15_000

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
  const [liveEvents, setLiveEvents] = useState<MiqatDayEvent[]>([])
  const [liveError, setLiveError] = useState<string | null>(null)

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

  useEffect(() => {
    let cancelled = false
    const loadLive = async () => {
      const token = await getAuthToken()
      if (!token) return
      const res = await getDay(todayIso(), token, undefined, campusId)
      if (cancelled) return
      if (res.success && res.data) {
        // Most recent scan first.
        setLiveEvents([...res.data].sort((a, b) => new Date(b.device_time).getTime() - new Date(a.device_time).getTime()))
        setLiveError(null)
      } else {
        setLiveError(res.error || 'Failed to load live activity')
      }
    }
    void loadLive()
    const interval = setInterval(loadLive, LIVE_POLL_MS)
    return () => { cancelled = true; clearInterval(interval) }
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

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Radio className="h-4 w-4 text-emerald-600" />
            {t('liveActivity')}
          </CardTitle>
          <p className="text-xs text-muted-foreground">{t('liveActivityHint')}</p>
        </CardHeader>
        <CardContent className="p-0">
          {liveError ? (
            <p className="text-red-600 text-sm p-4">{liveError}</p>
          ) : liveEvents.length === 0 ? (
            <p className="text-muted-foreground text-sm p-4">{t('liveNoData')}</p>
          ) : (
            <div className="divide-y max-h-96 overflow-y-auto">
              {liveEvents.map((e) => (
                <div key={e.id} className="flex items-center justify-between px-4 py-2 text-sm">
                  <div className="flex items-center gap-2">
                    {e.event_type === 'check_in' ? (
                      <LogIn className="h-4 w-4 text-green-600" />
                    ) : (
                      <LogOut className="h-4 w-4 text-amber-600" />
                    )}
                    <span>{e.profiles?.first_name} {e.profiles?.last_name}</span>
                    <span className="text-muted-foreground text-xs">
                      {e.event_type === 'check_in' ? t('liveCheckIn') : t('liveCheckOut')}
                    </span>
                  </div>
                  <span className="text-muted-foreground text-xs">{new Date(e.device_time).toLocaleTimeString()}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
