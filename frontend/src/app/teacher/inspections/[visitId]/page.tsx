'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Loader2, ArrowLeft, Camera, Mic, TrendingUp, MessageSquareWarning } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger,
} from '@/components/ui/dialog'
import { getEvaluationForTeacher, getEvidenceSignedUrl, type EvaluationDetail } from '@/lib/api/inspection-evaluation'
import { createAppeal } from '@/lib/api/inspection-appeal'

export default function TeacherEvaluationPage() {
  const t = useTranslations('inspections.teacherView')
  const params = useParams()
  const router = useRouter()
  const visitId = params?.visitId as string

  const [evaluation, setEvaluation] = useState<EvaluationDetail | null>(null)
  const [loading, setLoading] = useState(true)

  const [appealOpen, setAppealOpen] = useState(false)
  const [appealReason, setAppealReason] = useState('')
  const [filingAppeal, setFilingAppeal] = useState(false)

  useEffect(() => {
    if (!visitId) return
    setLoading(true)
    getEvaluationForTeacher(visitId).then((res) => {
      if (res.error) toast.error(res.error)
      setEvaluation(res.data)
      setLoading(false)
    })
  }, [visitId])

  const handleViewEvidence = async (id: string) => {
    const res = await getEvidenceSignedUrl(id)
    if (res.error) toast.error(res.error)
    else if (res.data) window.open(res.data.url, '_blank', 'noopener,noreferrer')
  }

  const handleFileAppeal = async () => {
    if (!evaluation || !appealReason.trim()) return
    setFilingAppeal(true)
    try {
      const res = await createAppeal(evaluation.id, appealReason.trim())
      if (res.error) {
        toast.error(res.error)
      } else if (res.data) {
        toast.success(t('msg_appeal_filed'))
        router.push(`/teacher/inspections/appeals/${res.data.id}`)
      }
    } finally {
      setFilingAppeal(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
  }

  if (!evaluation) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-4">
        <Link href="/teacher/inspections" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-4 w-4" /> {t('back')}
        </Link>
        <p className="text-sm text-gray-500 text-center py-12">{t('not_available')}</p>
      </div>
    )
  }

  const scoreByCriterion = new Map(evaluation.scores.map((s) => [s.criterion_id, s]))

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
      <Link href="/teacher/inspections" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4" /> {t('back')}
      </Link>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-lg">{t('page_title')}</CardTitle>
            {evaluation.overall_score !== null && (
              <div className="flex items-center gap-1.5 text-[#022172]">
                <TrendingUp className="h-4 w-4" />
                <span className="text-xl font-bold">{evaluation.overall_score}</span>
                <span className="text-xs text-gray-500">/ 100</span>
              </div>
            )}
          </div>
        </CardHeader>
      </Card>

      {(evaluation.rubric_template?.categories || []).map((cat) => (
        <Card key={cat.id}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              {cat.name}
              <Badge variant="outline" className="text-[10px]">{cat.weight}%</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {cat.criteria.map((crit) => {
              const score = scoreByCriterion.get(crit.id)
              return (
                <div key={crit.id} className="flex items-center justify-between gap-3 border-b border-gray-100 last:border-0 pb-3 last:pb-0">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{crit.name}</div>
                    {score?.comment && <div className="text-xs text-gray-500 mt-0.5">{score.comment}</div>}
                  </div>
                  <div className="h-8 w-8 rounded-full bg-[#022172]/10 flex items-center justify-center text-sm font-semibold text-[#022172] shrink-0">
                    {score?.score ?? '—'}
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      ))}

      {evaluation.evidence.length > 0 && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">{t('evidence_title')}</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {evaluation.evidence.map((ev) => (
                <button
                  key={ev.id}
                  onClick={() => handleViewEvidence(ev.id)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border bg-gray-50 text-xs text-gray-700 hover:text-[#022172]"
                >
                  {ev.file_type === 'photo' ? <Camera className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
                  <span className="max-w-[120px] truncate">{ev.file_name}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {evaluation.inspector_notes && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">{t('notes_title')}</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-gray-700">{evaluation.inspector_notes}</p></CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <Dialog open={appealOpen} onOpenChange={setAppealOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="gap-2 text-destructive">
              <MessageSquareWarning className="h-4 w-4" />
              {t('btn_file_appeal')}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('dialog_appeal_title')}</DialogTitle>
              <DialogDescription>{t('dialog_appeal_desc')}</DialogDescription>
            </DialogHeader>
            <div className="py-2 space-y-1.5">
              <Textarea rows={4} value={appealReason} onChange={(e) => setAppealReason(e.target.value)} placeholder={t('field_appeal_reason_placeholder')} />
            </div>
            <DialogFooter>
              <Button onClick={handleFileAppeal} disabled={filingAppeal || !appealReason.trim()} className="gap-2">
                {filingAppeal ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquareWarning className="h-4 w-4" />}
                {t('btn_submit_appeal')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
