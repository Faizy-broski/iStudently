'use client'

import { useEffect, useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, ClipboardCheck, CalendarCheck, TrendingUp, MessageSquareWarning } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { BarChart, Bar, CartesianGrid, XAxis, YAxis } from 'recharts'
import { useCampus } from '@/context/CampusContext'
import { getSchoolDashboardStats, type DashboardStats } from '@/lib/api/inspection-analytics'
import { ScoreHeatmap } from '@/components/inspections/ScoreHeatmap'

const categoryChartConfig = {
  avgScore: { label: 'Avg Score', color: '#022172' },
}

export default function AdminInspectionDashboardPage() {
  const t = useTranslations('inspections.dashboard')
  const campusCtx = useCampus()
  const schoolId = campusCtx?.selectedCampus?.id

  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    if (!schoolId) return
    setLoading(true)
    getSchoolDashboardStats(schoolId).then((res) => {
      setStats(res.data)
      setLoading(false)
    })
  }, [schoolId])

  useEffect(() => { load() }, [load])

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('admin_page_title')}</h1>
        <p className="text-sm text-gray-500 mt-1">{t('admin_page_subtitle')}</p>
      </div>

      {!schoolId ? (
        <Card><CardContent className="py-10 text-center text-sm text-gray-500">{t('select_campus_prompt')}</CardContent></Card>
      ) : loading ? (
        <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : stats && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card>
              <CardContent className="pt-5">
                <div className="flex items-center gap-2 text-gray-500 text-xs mb-1"><CalendarCheck className="h-3.5 w-3.5" />{t('stat_visits_scheduled')}</div>
                <div className="text-2xl font-bold text-gray-900">{stats.visitsScheduled}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <div className="flex items-center gap-2 text-gray-500 text-xs mb-1"><ClipboardCheck className="h-3.5 w-3.5" />{t('stat_visits_completed')}</div>
                <div className="text-2xl font-bold text-gray-900">{stats.visitsCompleted}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <div className="flex items-center gap-2 text-gray-500 text-xs mb-1"><TrendingUp className="h-3.5 w-3.5" />{t('stat_avg_score')}</div>
                <div className="text-2xl font-bold text-gray-900">{stats.avgOverallScore !== null ? stats.avgOverallScore : '—'}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <div className="flex items-center gap-2 text-gray-500 text-xs mb-1"><MessageSquareWarning className="h-3.5 w-3.5" />{t('stat_open_appeals')}</div>
                <div className="text-2xl font-bold text-gray-900">{stats.openAppealsCount}</div>
              </CardContent>
            </Card>
          </div>

          {stats.avgScoreByCategory.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('chart_title')}</CardTitle>
                <CardDescription>{t('chart_desc')}</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={categoryChartConfig} className="h-64 w-full">
                  <BarChart data={stats.avgScoreByCategory} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="category" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 11 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} domain={[0, 100]} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="avgScore" fill="#022172" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('heatmap_title')}</CardTitle>
              <CardDescription>{t('heatmap_desc_admin')}</CardDescription>
            </CardHeader>
            <CardContent>
              <ScoreHeatmap rows={stats.heatmap} emptyLabel={t('heatmap_empty')} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
