'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Loader2, ArrowLeft, FileText } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getVisit, type VisitDetail } from '@/lib/api/inspection-visits'
import { listEvaluationsForVisit } from '@/lib/api/inspection-evaluation'
import { getOrCreateReport, getReportForEvaluation } from '@/lib/api/inspection-report'
import { InspectionReportView } from '@/components/inspections/InspectionReportView'

type EvalListItem = { id: string; status: string; teacher: { id: string; first_name: string; last_name: string } }

export default function VisitReportPage() {
  const t = useTranslations('inspections.reports')
  const params = useParams()
  const visitId = params?.id as string

  const [visit, setVisit] = useState<VisitDetail | null>(null)
  const [evaluations, setEvaluations] = useState<EvalListItem[]>([])
  const [selectedEvalId, setSelectedEvalId] = useState<string | null>(null)
  const [reportId, setReportId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    if (!visitId) return
    setLoading(true)
    getVisit(visitId).then((res) => {
      setVisit(res.data)
      listEvaluationsForVisit(visitId).then((evalRes) => {
        const submitted = (evalRes.data || []).filter((e) => e.status !== 'draft')
        setEvaluations(submitted)
        if (submitted.length > 0) setSelectedEvalId(submitted[0].id)
        setLoading(false)
      })
    })
  }, [visitId])

  const loadReport = useCallback(() => {
    if (!selectedEvalId) return
    setReportId(null)
    getReportForEvaluation(selectedEvalId).then((res) => {
      if (res.error) toast.error(res.error)
      if (res.data) setReportId(res.data.id)
    })
  }, [selectedEvalId])

  useEffect(() => { loadReport() }, [loadReport])

  const handleGenerateReport = async () => {
    if (!selectedEvalId) return
    setGenerating(true)
    try {
      const res = await getOrCreateReport(selectedEvalId)
      if (res.error) toast.error(res.error)
      else if (res.data) setReportId(res.data.id)
    } finally {
      setGenerating(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
  }
  if (!visit) {
    return <div className="p-6 text-center text-gray-500">{t('visit_not_found')}</div>
  }

  return (
    <div className="p-3 sm:p-6 max-w-3xl mx-auto space-y-5">
      <Link href={`/inspector/visits/${visitId}`} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4" /> {t('back_to_visit')}
      </Link>

      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{t('page_title')}</h1>
        <p className="text-sm text-gray-500">{visit.school?.name} · {visit.scheduled_date}</p>
      </div>

      {evaluations.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-gray-500">{t('no_evaluations')}</CardContent></Card>
      ) : (
        <>
          {evaluations.length > 1 && (
            <div className="flex gap-2 flex-wrap">
              {evaluations.map((ev) => (
                <button
                  key={ev.id}
                  onClick={() => setSelectedEvalId(ev.id)}
                  className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                    selectedEvalId === ev.id ? 'bg-[#022172] text-white border-[#022172]' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {ev.teacher.first_name} {ev.teacher.last_name}
                </button>
              ))}
            </div>
          )}

          {!reportId ? (
            <Card>
              <CardContent className="py-10 text-center space-y-3">
                <p className="text-sm text-gray-500">{t('no_report_yet')}</p>
                <Button onClick={handleGenerateReport} disabled={generating} className="gap-2">
                  {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                  {t('btn_create_report')}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <InspectionReportView reportId={reportId} allowGeneratePdf />
          )}
        </>
      )}
    </div>
  )
}
