'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, AlertTriangle, Download } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { listReports, getReportDownloadUrl, type FinaReport } from '@/lib/api/fina-reports'
import { getSupervisorOverview } from '@/lib/api/fina-supervisor'

export default function FinaSupervisorReportsPage() {
  const t = useTranslations('fina.reports')
  const [reports, setReports] = useState<FinaReport[]>([])
  const [schoolNames, setSchoolNames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getSupervisorOverview().then((res) => {
      if (cancelled || !res.data) return
      setSchoolNames(Object.fromEntries(res.data.schools.map((s) => [s.id, s.name])))
    })
    listReports().then((res) => {
      if (cancelled) return
      if (res.error) setError(res.error)
      else setReports(res.data || [])
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [])

  const handleDownload = async (report: FinaReport) => {
    setDownloadingId(report.id)
    const res = await getReportDownloadUrl(report.id)
    setDownloadingId(null)
    if (res.error || !res.data) {
      toast.error(res.error || 'Failed to get download link')
      return
    }
    window.open(res.data.url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('page_title')}</h1>
        <p className="text-sm text-gray-500 mt-1">{t('page_subtitle')}</p>
      </div>

      <Card>
        <CardContent className="pt-5">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 text-sm text-red-600 py-6">
              <AlertTriangle className="h-4 w-4" />
              {error}
            </div>
          ) : reports.length === 0 ? (
            <p className="text-sm text-gray-500 py-6">{t('empty')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('col_school')}</TableHead>
                  <TableHead>{t('col_period')}</TableHead>
                  <TableHead>{t('col_generated')}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell className="font-medium text-gray-900">{schoolNames[report.school_id] || report.school_id}</TableCell>
                    <TableCell>{report.period}</TableCell>
                    <TableCell className="text-gray-500 text-xs">{new Date(report.generated_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-2"
                        disabled={downloadingId === report.id}
                        onClick={() => handleDownload(report)}
                      >
                        {downloadingId === report.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                        {t('download_button')}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
