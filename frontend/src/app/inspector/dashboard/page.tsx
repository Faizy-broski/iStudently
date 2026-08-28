'use client';

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, ClipboardCheck, Building2, AlertTriangle, CalendarCheck, TrendingUp, MessageSquareWarning } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { BarChart, Bar, CartesianGrid, XAxis, YAxis } from 'recharts'
import { useAuth } from '@/context/AuthContext'
import { getMyAssignedSchools } from '@/lib/api/inspectors'
import { getInspectorDashboardStats, type DashboardStats } from '@/lib/api/inspection-analytics'
import { ScoreHeatmap } from '@/components/inspections/ScoreHeatmap'

const categoryChartConfig = {
  avgScore: { label: 'Avg Score', color: '#022172' },
}

// Inspector Dashboard — upgraded in Phase 6 with real stat cards, the avg
// rubric score by category chart, open appeals, and the cross-campus score
// heatmap. The "Assigned Campuses" section below is the original Phase 0
// shell content, left as-is.
export default function InspectorDashboard() {
  const t = useTranslations('inspections.dashboard')
  const { profile } = useAuth()
  const firstName = profile?.first_name || 'Inspector'

  const [schools, setSchools] = useState<Array<{ id: string; name: string }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loadingStats, setLoadingStats] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getMyAssignedSchools().then((res) => {
      if (cancelled) return
      if (res.error) {
        setError(res.error)
      } else {
        setSchools(res.data || [])
      }
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    setLoadingStats(true)
    getInspectorDashboardStats().then((res) => {
      setStats(res.data)
      setLoadingStats(false)
    })
  }, [])

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Welcome, {firstName}</h1>
        <p className="text-sm text-gray-500 mt-1">Your inspection dashboard</p>
      </div>

      {loadingStats ? (
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
              <CardDescription>{t('heatmap_desc_inspector')}</CardDescription>
            </CardHeader>
            <CardContent>
              <ScoreHeatmap rows={stats.heatmap} emptyLabel={t('heatmap_empty')} />
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-5 w-5 text-[#022172]" />
            Assigned Campuses
          </CardTitle>
          <CardDescription>Campuses you currently have inspection access to</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-gray-500 py-6">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading assigned campuses...
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 text-sm text-red-600 py-6">
              <AlertTriangle className="h-4 w-4" />
              {error}
            </div>
          ) : schools.length === 0 ? (
            <p className="text-sm text-gray-500 py-6">
              No campuses assigned yet. Contact your administrator to be assigned to a campus.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {schools.map((school) => (
                <li key={school.id} className="py-3 flex items-center gap-3">
                  <Building2 className="h-4 w-4 text-gray-400" />
                  <span className="text-sm font-medium text-gray-900">{school.name}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
