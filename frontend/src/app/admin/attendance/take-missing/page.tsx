'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { generateMissingAttendanceRange } from '@/lib/api/attendance'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { UserCheck, Play, Loader2, Info, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'

export default function TakeMissingAttendancePage() {
  const t = useTranslations('attendance')
  const today = new Date().toISOString().split('T')[0]
  const [fromDate, setFromDate] = useState(today)
  const [toDate, setToDate] = useState(today)
  const [running, setRunning] = useState(false)
  const [lastResult, setLastResult] = useState<{ total: number; days: number } | null>(null)

  const handleRun = async () => {
    if (!fromDate || !toDate) {
      toast.error(t('print_selectDateRange'))
      return
    }
    if (fromDate > toDate) {
      toast.error(t('addAbsences_fromDateError'))
      return
    }
    setRunning(true)
    setLastResult(null)
    try {
      const result = await generateMissingAttendanceRange({ from_date: fromDate, to_date: toDate })
      if (result.success && result.data) {
        setLastResult({ total: result.data.total_generated, days: result.data.days_processed })
        toast.success(
          `Generated ${result.data.total_generated} attendance records across ${result.data.days_processed} day(s)`
        )
      } else {
        toast.error(result.error || t('recalculate_generateFailed'))
      }
    } catch {
      toast.error(t('recalculate_generateFailed'))
    }
    setRunning(false)
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-linear-to-r from-[#57A3CC] to-[#022172]">
          <UserCheck className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#022172] dark:text-white">
            {t('takeMissing')}
          </h1>
          <p className="text-muted-foreground">
            {t('takeMissing_subtitle')}
          </p>
        </div>
      </div>

      {/* Info */}
      <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/20">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
        <div className="text-sm text-blue-800 dark:text-blue-300">
          <p className="font-medium">{t('takeMissing_howItWorks')}</p>
          <p className="mt-1">{t('takeMissing_explanation')}</p>
        </div>
      </div>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="h-5 w-5 text-[#022172]" />
            Timeframe
          </CardTitle>
          <CardDescription>{t('recalculate_subtitle')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap gap-6">
            <div className="space-y-1.5">
              <Label>{t('recalculate_from')}</Label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-44"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('recalculate_to')}</Label>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-44"
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">{t('print_maxRange')}</p>

          <Button
            onClick={handleRun}
            disabled={running}
            className="bg-linear-to-r from-[#57A3CC] to-[#022172] text-white w-full"
          >
            {running ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Play className="mr-2 h-4 w-4" />
            )}
            {running ? t('takeMissing_processing') : t('takeMissing')}
          </Button>

          {lastResult && (
            <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-950/20">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
              <p className="text-sm text-green-800 dark:text-green-300">
                {t('takeMissing_generated', { total: lastResult.total, days: lastResult.days })}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
