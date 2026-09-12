'use client'

import { useEffect, useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Loader2, Download, AlertTriangle, Check } from 'lucide-react'
import { getAuthToken } from '@/lib/api/schools'
import { listPatternFlags, acknowledgeFlag, downloadTimesheet, downloadMinistryReport, MiqatPatternFlag } from '@/lib/api/miqat'
import { useCampus } from '@/context/CampusContext'
import { toast } from 'sonner'

const FLAG_LABEL: Record<string, string> = {
  same_weekday_absences: 'sameWeekdayAbsences',
  gate_present_period_absent: 'gatePresentPeriodAbsent',
  chronic_early_checkout: 'chronicEarlyCheckout',
  teacher_not_scanning: 'teacherNotScanning',
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7)
}

export default function MiqatReportsPage() {
  const t = useTranslations('miqat.reports')
  const locale = useLocale()
  const isAr = locale === 'ar'
  const campusId = useCampus()?.selectedCampus?.id

  const [flags, setFlags] = useState<MiqatPatternFlag[]>([])
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState(currentMonth())
  const [dateFrom, setDateFrom] = useState(`${currentMonth()}-01`)
  const [dateTo, setDateTo] = useState(new Date().toISOString().slice(0, 10))
  const [exporting, setExporting] = useState<'timesheet' | 'ministry' | null>(null)

  const load = async () => {
    const token = await getAuthToken()
    if (!token) return
    const res = await listPatternFlags(token, campusId)
    if (res.success && res.data) setFlags(res.data)
    setLoading(false)
  }

  useEffect(() => { load() }, [campusId])

  const handleAcknowledge = async (id: string) => {
    const token = await getAuthToken()
    if (!token) return
    const res = await acknowledgeFlag(id, token, campusId)
    if (res.success) {
      setFlags((prev) => prev.filter((f) => f.id !== id))
    } else {
      toast.error(res.error || t('acknowledgeError'))
    }
  }

  const handleExportTimesheet = async () => {
    const token = await getAuthToken()
    if (!token) return
    setExporting('timesheet')
    try {
      await downloadTimesheet(month, token, campusId)
    } catch {
      toast.error(t('exportError'))
    }
    setExporting(null)
  }

  const handleExportMinistry = async () => {
    const token = await getAuthToken()
    if (!token) return
    setExporting('ministry')
    try {
      await downloadMinistryReport(dateFrom, dateTo, token, campusId)
    } catch {
      toast.error(t('exportError'))
    }
    setExporting(null)
  }

  return (
    <div className="space-y-6 p-6 max-w-3xl" dir={isAr ? 'rtl' : 'ltr'}>
      <h1 className="text-2xl font-bold">{t('title')}</h1>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">{t('hrTimesheet')}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
            <Button onClick={handleExportTimesheet} disabled={exporting === 'timesheet'}>
              {exporting === 'timesheet' ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <Download className="h-4 w-4 me-2" />}
              {t('download')}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">{t('ministryReport')}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            <Button onClick={handleExportMinistry} disabled={exporting === 'ministry'}>
              {exporting === 'ministry' ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <Download className="h-4 w-4 me-2" />}
              {t('download')}
            </Button>
            <p className="text-xs text-muted-foreground">{t('ministryPlaceholderNotice')}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-600" />{t('patternFlags')}</CardTitle></CardHeader>
        <CardContent className="p-0 divide-y">
          {loading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : flags.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">{t('noFlags')}</p>
          ) : (
            flags.map((f) => (
              <div key={f.id} className="flex items-center justify-between p-3">
                <div>
                  <div className="font-medium">{f.profiles ? `${f.profiles.first_name} ${f.profiles.last_name}` : f.person_id}</div>
                  <Badge variant="outline">{t(FLAG_LABEL[f.flag_type] ?? f.flag_type)}</Badge>
                </div>
                <Button size="sm" variant="ghost" onClick={() => handleAcknowledge(f.id)}>
                  <Check className="h-4 w-4 me-1" />{t('acknowledge')}
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
