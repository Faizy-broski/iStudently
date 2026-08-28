'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Loader2, Calendar, Building2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { listVisitsForTeacher, type InspectionVisit, type VisitStatus } from '@/lib/api/inspection-visits'

const STATUS_STYLES: Record<VisitStatus, string> = {
  scheduled: 'bg-amber-100 text-amber-800',
  confirmed: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-purple-100 text-purple-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  rescheduled: 'bg-gray-100 text-gray-600',
}

export default function TeacherInspectionsPage() {
  const t = useTranslations('inspections.visits')
  const [visits, setVisits] = useState<InspectionVisit[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listVisitsForTeacher().then((res) => {
      setVisits(res.data || [])
      setLoading(false)
    })
  }, [])

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('teacher_page_title')}</h1>
        <p className="text-sm text-gray-500 mt-1">{t('teacher_page_subtitle')}</p>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : visits.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-12">{t('no_visits')}</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {visits.map((v) => {
                const canOpen = v.status === 'completed' || v.status === 'in_progress'
                const Wrapper = canOpen ? Link : 'div'
                const wrapperProps = canOpen ? { href: `/teacher/inspections/${v.id}` } : {}
                return (
                  <Wrapper
                    key={v.id}
                    {...(wrapperProps as any)}
                    className={`flex items-center justify-between gap-3 p-4 ${canOpen ? 'hover:bg-gray-50 transition-colors' : ''}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-9 w-9 rounded-full bg-[#022172]/10 flex items-center justify-center shrink-0">
                        <Building2 className="h-4 w-4 text-[#022172]" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">{v.school?.name || v.school_id}</div>
                        <div className="text-xs text-gray-500 flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {v.scheduled_date}
                          {v.scheduled_start_time ? ` · ${v.scheduled_start_time}` : ''}
                        </div>
                      </div>
                    </div>
                    <Badge className={STATUS_STYLES[v.status]} variant="outline">{t(`status_${v.status}`)}</Badge>
                  </Wrapper>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
