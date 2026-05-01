'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/context/AuthContext'
import { useCampus } from '@/context/CampusContext'
import * as api from '@/lib/api/staff-absences'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { BarChart3, Filter } from 'lucide-react'

const COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#6366f1',
]

export default function BreakdownPage() {
  const t = useTranslations('staffAbsences')
  const { profile } = useAuth()
  const campusCtx = useCampus()
  const schoolId = profile?.school_id || ''
  const campusId = campusCtx?.selectedCampus?.id

  const currentYear = new Date().getFullYear()
  const [startDate, setStartDate] = useState(`${currentYear}-01-01`)
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10))

  const { data, isLoading, mutate } = useSWR(
    schoolId ? ['absence-breakdown', schoolId, campusId, startDate, endDate] : null,
    () =>
      api.getAbsenceBreakdown({
        school_id: schoolId,
        campus_id: campusId,
        start_date: startDate,
        end_date: endDate,
      })
  )

  const rows = data?.data || []

  // Transform into recharts-friendly format: [{month, StaffA: days, StaffB: days}]
  const staffNames = Array.from(new Set(rows.map((r) => r.staff_name)))
  const monthMap: Record<string, Record<string, number>> = {}

  for (const row of rows) {
    if (!monthMap[row.month]) monthMap[row.month] = {}
    monthMap[row.month][row.staff_name] =
      (monthMap[row.month][row.staff_name] || 0) + row.days_absent
  }

  const chartData = Object.entries(monthMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, values]) => ({
      month: new Date(month + '-01').toLocaleDateString(undefined, {
        month: 'short', year: '2-digit',
      }),
      ...values,
    }))

  // Summary table: total per staff
  const staffTotals = staffNames.map((name) => ({
    name,
    total: rows
      .filter((r) => r.staff_name === name)
      .reduce((sum, r) => sum + r.days_absent, 0),
  })).sort((a, b) => b.total - a.total)

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3">
        <BarChart3 className="h-6 w-6 text-muted-foreground" />
        <h1 className="text-2xl font-semibold">{t('breakdown.title')}</h1>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">{t('filters.from')}</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-36"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">{t('filters.to')}</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-36"
              />
            </div>
            <Button variant="outline" onClick={() => mutate()}>
              <Filter className="h-4 w-4 mr-2" />
              {t('refresh')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <Card>
          <CardContent className="pt-4">
            <Skeleton className="h-72 w-full" />
          </CardContent>
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            {t('empty.breakdown')}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Bar Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('breakdown.staffAbsenceByMonth')}</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis
                    label={{
                      value: t('table.days'),
                      angle: -90,
                      position: 'insideLeft',
                      style: { fontSize: 11 },
                    }}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {staffNames.map((name, idx) => (
                    <Bar
                      key={name}
                      dataKey={name}
                      stackId="a"
                      fill={COLORS[idx % COLORS.length]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Summary table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('breakdown.totalDaysAbsentByStaff')}</CardTitle>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium">{t('table.staffMember')}</th>
                    <th className="text-right py-2 font-medium">{t('breakdown.totalDays')}</th>
                  </tr>
                </thead>
                <tbody>
                  {staffTotals.map((row) => (
                    <tr key={row.name} className="border-b last:border-0">
                      <td className="py-2">{row.name}</td>
                      <td className="py-2 text-right font-mono">
                        {Math.round(row.total * 10) / 10}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
