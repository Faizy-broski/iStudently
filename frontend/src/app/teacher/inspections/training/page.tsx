'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Loader2, GraduationCap, Sparkles, Check } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  listMyPrescriptions, completePrescription, type TrainingPrescription,
} from '@/lib/api/training-prescription'

export default function TeacherTrainingPage() {
  const t = useTranslations('inspections.training')
  const [prescriptions, setPrescriptions] = useState<TrainingPrescription[]>([])
  const [loading, setLoading] = useState(true)
  const [completingId, setCompletingId] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    listMyPrescriptions().then((res) => {
      if (res.error) toast.error(res.error)
      setPrescriptions(res.data || [])
      setLoading(false)
    })
  }

  useEffect(() => { load() }, [])

  const handleComplete = async (id: string) => {
    setCompletingId(id)
    try {
      const res = await completePrescription(id)
      if (res.error) toast.error(res.error)
      else { toast.success(t('msg_completed')); load() }
    } finally {
      setCompletingId(null)
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('page_title')}</h1>
        <p className="text-sm text-gray-500 mt-1">{t('page_subtitle')}</p>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : prescriptions.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-12">{t('no_prescriptions')}</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {prescriptions.map((p) => (
                <div key={p.id} className="p-4 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-full bg-[#022172]/10 flex items-center justify-center shrink-0">
                      <GraduationCap className="h-4 w-4 text-[#022172]" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        {p.auto_suggested && (
                          <Badge variant="outline" className="text-[10px] gap-1"><Sparkles className="h-2.5 w-2.5" />{t('auto_suggested_badge')}</Badge>
                        )}
                        <Badge variant="secondary" className="text-[10px]">{t(`status_${p.status}`)}</Badge>
                      </div>
                      {p.reason && <p className="text-sm text-gray-800">{p.reason}</p>}
                      {p.training_session && (
                        <p className="text-xs text-gray-500 mt-1">{t('linked_session_label')}: {p.training_session.title}</p>
                      )}
                    </div>
                  </div>
                  {(p.status === 'suggested' || p.status === 'assigned') && (
                    <Button
                      size="sm" variant="outline" className="gap-1.5 shrink-0"
                      onClick={() => handleComplete(p.id)}
                      disabled={completingId === p.id}
                    >
                      {completingId === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                      {t('btn_mark_complete')}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
