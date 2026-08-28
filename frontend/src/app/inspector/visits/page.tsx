'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Loader2, Plus, Calendar, Building2, ChevronRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { listMyVisits, type InspectionVisit, type VisitStatus } from '@/lib/api/inspection-visits'

const TABS: { key: string; statuses: VisitStatus[] }[] = [
  { key: 'upcoming', statuses: ['scheduled', 'confirmed', 'in_progress'] },
  { key: 'completed', statuses: ['completed'] },
  { key: 'cancelled', statuses: ['cancelled', 'rescheduled'] },
]

const STATUS_STYLES: Record<VisitStatus, string> = {
  scheduled: 'bg-amber-100 text-amber-800',
  confirmed: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-purple-100 text-purple-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  rescheduled: 'bg-gray-100 text-gray-600',
}

export default function InspectorVisitsPage() {
  const t = useTranslations('inspections.visits')
  const [visits, setVisits] = useState<InspectionVisit[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('upcoming')

  useEffect(() => {
    setLoading(true)
    listMyVisits().then((res) => {
      setVisits(res.data || [])
      setLoading(false)
    })
  }, [])

  const activeTab = TABS.find((x) => x.key === tab) || TABS[0]
  const filtered = visits.filter((v) => activeTab.statuses.includes(v.status))

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('page_title')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('page_subtitle')}</p>
        </div>
        <Button asChild className="gap-2">
          <Link href="/inspector/visits/new">
            <Plus className="h-4 w-4" />
            {t('btn_new_visit')}
          </Link>
        </Button>
      </div>

      <div className="flex gap-2 border-b border-gray-200">
        {TABS.map((tb) => (
          <button
            key={tb.key}
            onClick={() => setTab(tb.key)}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === tb.key ? 'border-[#022172] text-[#022172]' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t(`tab_${tb.key}`)}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-12">{t('no_visits')}</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {filtered.map((v) => (
                <Link
                  key={v.id}
                  href={`/inspector/visits/${v.id}`}
                  className="flex items-center justify-between gap-3 p-4 hover:bg-gray-50 transition-colors"
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
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge className={STATUS_STYLES[v.status]} variant="outline">{t(`status_${v.status}`)}</Badge>
                    <ChevronRight className="h-4 w-4 text-gray-300" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
