'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, AlertTriangle, Download, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { listReports, getReportDownloadUrl, generateReport, type FinaReport } from '@/lib/api/fina-reports'

export default function AdminFinaReportsPage() {
  const t = useTranslations('fina.reports')
  const [reports, setReports] = useState<FinaReport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)

  const load = () => {
    setLoading(true)
    listReports().then((res) => {
      if (res.error) setError(res.error)
      else setReports(res.data || [])
      setLoading(false)
    })
  }

  useEffect(() => {
    load()
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

  const handleGenerate = async () => {
    setGenerating(true)
    const res = await generateReport()
    setGenerating(false)
    if (res.error) {
      toast.error(res.error)
      return
    }
    toast.success(t('generate_button'))
    load()
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('page_title')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('page_subtitle')}</p>
        </div>
        <Button onClick={handleGenerate} disabled={generating} className="gap-2">
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
          {generating ? t('generating') : t('generate_button')}
        </Button>
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
                  <TableHead>{t('col_period')}</TableHead>
                  <TableHead>{t('col_generated')}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell className="font-medium text-gray-900">{report.period}</TableCell>
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
