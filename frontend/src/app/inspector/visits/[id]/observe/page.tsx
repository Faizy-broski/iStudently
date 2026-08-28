'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import {
  Loader2, ArrowLeft, Check, Camera, Mic, X, Send, AlertTriangle,
  TrendingUp, Image as ImageIcon,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { getVisit, type VisitDetail } from '@/lib/api/inspection-visits'
import {
  getOrCreateDraftEvaluation, getEvaluation, saveScore, submitEvaluation,
  uploadEvidence, removeEvidence, getEvidenceSignedUrl,
  listCoursePeriodsForTeacher, getGradeSampleForComparison,
  type EvaluationDetail, type CoursePeriodListItem, type GradeSampleRow,
} from '@/lib/api/inspection-evaluation'

export default function ObserveVisitPage() {
  const t = useTranslations('inspections.observe')
  const params = useParams()
  const router = useRouter()
  const visitId = params?.id as string

  const [visit, setVisit] = useState<VisitDetail | null>(null)
  const [loadingVisit, setLoadingVisit] = useState(true)
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null)

  const [evaluation, setEvaluation] = useState<EvaluationDetail | null>(null)
  const [loadingEval, setLoadingEval] = useState(false)
  const [savingCriterion, setSavingCriterion] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [uploadingFor, setUploadingFor] = useState<string | null>(null) // criterionId or 'general'
  const photoInputRef = useRef<HTMLInputElement>(null)
  const audioInputRef = useRef<HTMLInputElement>(null)
  const [pendingEvidenceCriterion, setPendingEvidenceCriterion] = useState<string | undefined>(undefined)

  const [coursePeriods, setCoursePeriods] = useState<CoursePeriodListItem[]>([])
  const [selectedCoursePeriod, setSelectedCoursePeriod] = useState('')
  const [gradeSample, setGradeSample] = useState<GradeSampleRow[] | null>(null)
  const [loadingSample, setLoadingSample] = useState(false)

  useEffect(() => {
    if (!visitId) return
    setLoadingVisit(true)
    getVisit(visitId).then((res) => {
      if (res.error) toast.error(res.error)
      setVisit(res.data)
      setLoadingVisit(false)
      if (res.data?.teachers.length === 1) {
        setSelectedTeacherId(res.data.teachers[0].teacher_profile_id)
      }
    })
  }, [visitId])

  const loadEvaluation = useCallback(() => {
    if (!visitId || !selectedTeacherId) return
    setLoadingEval(true)
    getOrCreateDraftEvaluation(visitId, selectedTeacherId).then((createRes) => {
      if (createRes.error || !createRes.data) {
        toast.error(createRes.error || t('err_load_failed'))
        setLoadingEval(false)
        return
      }
      getEvaluation(createRes.data.id).then((res) => {
        if (res.error) toast.error(res.error)
        setEvaluation(res.data)
        setLoadingEval(false)
      })
    })
  }, [visitId, selectedTeacherId, t])

  useEffect(() => { loadEvaluation() }, [loadEvaluation])

  useEffect(() => {
    if (!visit || !selectedTeacherId) return
    listCoursePeriodsForTeacher(selectedTeacherId, visit.school_id).then((res) => setCoursePeriods(res.data || []))
    setGradeSample(null)
    setSelectedCoursePeriod('')
  }, [visit, selectedTeacherId])

  const isDraft = evaluation?.status === 'draft'

  const scoreByCriterion = new Map((evaluation?.scores || []).map((s) => [s.criterion_id, s]))
  const allCriteria = (evaluation?.rubric_template?.categories || []).flatMap((c) => c.criteria)
  const missingCount = allCriteria.filter((c) => !scoreByCriterion.has(c.id)).length

  const handleScore = async (criterionId: string, score: number) => {
    if (!evaluation) return
    setSavingCriterion(criterionId)
    try {
      const res = await saveScore(evaluation.id, criterionId, score)
      if (res.error) {
        toast.error(res.error)
      } else if (res.data) {
        setEvaluation((prev) => {
          if (!prev) return prev
          const others = prev.scores.filter((s) => s.criterion_id !== criterionId)
          return { ...prev, scores: [...others, res.data!] }
        })
      }
    } finally {
      setSavingCriterion(null)
    }
  }

  const handleSubmit = async () => {
    if (!evaluation) return
    setSubmitting(true)
    try {
      const res = await submitEvaluation(evaluation.id)
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success(t('msg_submitted'))
        loadEvaluation()
      }
    } finally {
      setSubmitting(false)
    }
  }

  const triggerPhotoUpload = (criterionId?: string) => {
    setPendingEvidenceCriterion(criterionId)
    photoInputRef.current?.click()
  }
  const triggerAudioUpload = (criterionId?: string) => {
    setPendingEvidenceCriterion(criterionId)
    audioInputRef.current?.click()
  }

  const handleFileSelected = async (file: File | undefined) => {
    if (!file || !evaluation) return
    const key = pendingEvidenceCriterion || 'general'
    setUploadingFor(key)
    try {
      const res = await uploadEvidence(evaluation.id, file, pendingEvidenceCriterion)
      if (res.error) toast.error(res.error)
      else { toast.success(t('msg_evidence_added')); loadEvaluation() }
    } finally {
      setUploadingFor(null)
    }
  }

  const handleRemoveEvidence = async (evidenceId: string) => {
    const res = await removeEvidence(evidenceId)
    if (res.error) toast.error(res.error)
    else { toast.success(t('msg_evidence_removed')); loadEvaluation() }
  }

  const handleLoadSample = async () => {
    if (!selectedCoursePeriod) return
    setLoadingSample(true)
    try {
      const res = await getGradeSampleForComparison(selectedCoursePeriod)
      if (res.error) toast.error(res.error)
      else setGradeSample(res.data || [])
    } finally {
      setLoadingSample(false)
    }
  }

  if (loadingVisit) {
    return <div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
  }
  if (!visit) {
    return <div className="p-6 text-center text-gray-500">{t('visit_not_found')}</div>
  }

  return (
    <div className="p-3 sm:p-6 max-w-4xl mx-auto space-y-5 pb-24">
      <input
        ref={photoInputRef} type="file" accept="image/jpeg,image/png" capture="environment" className="hidden"
        onChange={(e) => { handleFileSelected(e.target.files?.[0]); e.target.value = '' }}
      />
      <input
        ref={audioInputRef} type="file" accept="audio/webm,audio/ogg" className="hidden"
        onChange={(e) => { handleFileSelected(e.target.files?.[0]); e.target.value = '' }}
      />

      <Link href={`/inspector/visits/${visitId}`} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4" /> {t('back_to_visit')}
      </Link>

      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{t('page_title')}</h1>
        <p className="text-sm text-gray-500">{visit.school?.name} · {visit.scheduled_date}</p>
      </div>

      {visit.teachers.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-gray-500">{t('no_teachers_on_visit')}</CardContent></Card>
      ) : visit.teachers.length > 1 ? (
        <div className="flex gap-2 flex-wrap">
          {visit.teachers.map((vt) => (
            <button
              key={vt.teacher_profile_id}
              onClick={() => setSelectedTeacherId(vt.teacher_profile_id)}
              className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                selectedTeacherId === vt.teacher_profile_id
                  ? 'bg-[#022172] text-white border-[#022172]'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {vt.teacher ? `${vt.teacher.first_name} ${vt.teacher.last_name}` : vt.teacher_profile_id}
            </button>
          ))}
        </div>
      ) : null}

      {selectedTeacherId && loadingEval && (
        <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      )}

      {selectedTeacherId && !loadingEval && evaluation && (
        <>
          {!isDraft && (
            <Card className="border-green-200 bg-green-50">
              <CardContent className="py-4 flex items-center gap-2 text-sm text-green-800">
                <Check className="h-4 w-4" />
                {t('already_submitted', { score: String(evaluation.overall_score ?? '—') })}
              </CardContent>
            </Card>
          )}

          {!evaluation.rubric_template ? (
            <Card><CardContent className="py-10 text-center text-sm text-gray-500">{t('no_rubric')}</CardContent></Card>
          ) : (
            <div className="space-y-4">
              {evaluation.rubric_template.categories.map((cat) => (
                <Card key={cat.id}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      {cat.name}
                      <Badge variant="outline" className="text-[10px]">{cat.weight}%</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {cat.criteria.map((crit) => {
                      const current = scoreByCriterion.get(crit.id)
                      return (
                        <div key={crit.id} className="border-b border-gray-100 last:border-0 pb-4 last:pb-0">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div>
                              <div className="text-sm font-medium text-gray-900">{crit.name}</div>
                              {crit.description && <div className="text-xs text-gray-500 mt-0.5">{crit.description}</div>}
                            </div>
                            {savingCriterion === crit.id && <Loader2 className="h-4 w-4 animate-spin text-gray-400 shrink-0" />}
                          </div>
                          <div className="flex items-center gap-2">
                            {[1, 2, 3, 4, 5].map((n) => (
                              <button
                                key={n}
                                disabled={!isDraft}
                                onClick={() => handleScore(crit.id, n)}
                                className={`h-11 w-11 sm:h-12 sm:w-12 rounded-full text-base font-semibold border-2 transition-colors disabled:cursor-not-allowed ${
                                  current?.score === n
                                    ? 'bg-[#022172] border-[#022172] text-white'
                                    : 'bg-white border-gray-200 text-gray-700 hover:border-[#022172]/40 disabled:hover:border-gray-200'
                                }`}
                              >
                                {n}
                              </button>
                            ))}
                            {isDraft && (
                              <div className="flex items-center gap-1 ml-2">
                                <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => triggerPhotoUpload(crit.id)} disabled={uploadingFor === crit.id}>
                                  {uploadingFor === crit.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                                </Button>
                                <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => triggerAudioUpload(crit.id)} disabled={uploadingFor === crit.id}>
                                  <Mic className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </div>
                          {evaluation.evidence.filter((e) => e.criterion_id === crit.id).length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {evaluation.evidence.filter((e) => e.criterion_id === crit.id).map((ev) => (
                                <EvidenceChip key={ev.id} id={ev.id} name={ev.file_name} type={ev.file_type} editable={isDraft} onRemove={handleRemoveEvidence} />
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </CardContent>
                </Card>
              ))}

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ImageIcon className="h-4 w-4 text-[#022172]" />
                    {t('general_evidence_title')}
                  </CardTitle>
                  <CardDescription>{t('general_evidence_desc')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {isDraft && (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="gap-2" onClick={() => triggerPhotoUpload(undefined)} disabled={uploadingFor === 'general'}>
                        {uploadingFor === 'general' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                        {t('btn_add_photo')}
                      </Button>
                      <Button variant="outline" size="sm" className="gap-2" onClick={() => triggerAudioUpload(undefined)} disabled={uploadingFor === 'general'}>
                        <Mic className="h-4 w-4" />
                        {t('btn_add_audio')}
                      </Button>
                    </div>
                  )}
                  {evaluation.evidence.filter((e) => !e.criterion_id).length === 0 ? (
                    <p className="text-xs text-gray-500">{t('no_general_evidence')}</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {evaluation.evidence.filter((e) => !e.criterion_id).map((ev) => (
                        <EvidenceChip key={ev.id} id={ev.id} name={ev.file_name} type={ev.file_type} editable={isDraft} onRemove={handleRemoveEvidence} />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-[#022172]" />
                    {t('grade_sample_title')}
                  </CardTitle>
                  <CardDescription>{t('grade_sample_desc')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {coursePeriods.length === 0 ? (
                    <p className="text-xs text-gray-500">{t('no_course_periods')}</p>
                  ) : (
                    <div className="flex gap-2">
                      <Select value={selectedCoursePeriod} onValueChange={setSelectedCoursePeriod}>
                        <SelectTrigger className="max-w-xs"><SelectValue placeholder={t('field_course_period_placeholder')} /></SelectTrigger>
                        <SelectContent>
                          {coursePeriods.map((cp) => (
                            <SelectItem key={cp.id} value={cp.id}>{cp.title || cp.short_name || cp.section_name || cp.id}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button size="sm" variant="outline" onClick={handleLoadSample} disabled={!selectedCoursePeriod || loadingSample} className="gap-2">
                        {loadingSample ? <Loader2 className="h-4 w-4 animate-spin" /> : <TrendingUp className="h-4 w-4" />}
                        {t('btn_load_sample')}
                      </Button>
                    </div>
                  )}
                  {gradeSample && (
                    gradeSample.length === 0 ? (
                      <p className="text-xs text-gray-500">{t('no_grades_found')}</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-left text-gray-500 border-b">
                              <th className="py-1.5 pr-3">{t('col_student')}</th>
                              <th className="py-1.5 pr-3">{t('col_assignment')}</th>
                              <th className="py-1.5 pr-3">{t('col_score')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {gradeSample.map((row, i) => (
                              <tr key={i} className="border-b border-gray-50">
                                <td className="py-1.5 pr-3">{row.student_name}</td>
                                <td className="py-1.5 pr-3">{row.assignment_title || '—'}</td>
                                <td className="py-1.5 pr-3">{row.letter_grade || row.points || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {isDraft && evaluation.rubric_template && (
            <div className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 p-3 sm:p-4 flex items-center justify-between gap-3 z-10">
              <div className="text-sm text-gray-600">
                {missingCount > 0 ? (
                  <span className="flex items-center gap-1.5 text-amber-700">
                    <AlertTriangle className="h-4 w-4" />
                    {t('missing_count', { count: String(missingCount) })}
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-green-700">
                    <Check className="h-4 w-4" />
                    {t('all_scored')}
                  </span>
                )}
              </div>
              <Button onClick={handleSubmit} disabled={submitting || missingCount > 0} className="gap-2">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {t('btn_submit_evaluation')}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function EvidenceChip({
  id, name, type, editable, onRemove,
}: {
  id: string
  name: string
  type: 'photo' | 'audio'
  editable: boolean
  onRemove: (id: string) => void
}) {
  const t = useTranslations('inspections.observe')
  const [loading, setLoading] = useState(false)

  const handleView = async () => {
    setLoading(true)
    try {
      const res = await getEvidenceSignedUrl(id)
      if (res.error) toast.error(res.error)
      else if (res.data) window.open(res.data.url, '_blank', 'noopener,noreferrer')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-full border bg-gray-50 text-xs">
      <button onClick={handleView} disabled={loading} className="flex items-center gap-1 text-gray-700 hover:text-[#022172]">
        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : type === 'photo' ? <Camera className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
        <span className="max-w-[100px] truncate">{name}</span>
      </button>
      {editable && (
        <button onClick={() => onRemove(id)} className="text-gray-400 hover:text-destructive" title={t('btn_remove_evidence')}>
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}
