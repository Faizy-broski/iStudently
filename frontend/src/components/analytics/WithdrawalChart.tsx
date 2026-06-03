'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts'
import {
  TrendingDown,
  TrendingUp,
  Minus,
  Calendar,
  Users,
  GitCompare,
  Loader2,
} from 'lucide-react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { AcademicYear } from '@/lib/api/academics'
import {
  WithdrawalDataPoint,
  WithdrawalComparisonData,
  WithdrawalSummary,
  getWithdrawalCumulative,
  getWithdrawalComparison,
  getWithdrawalSummary,
} from '@/lib/api/withdrawal-analytics'

// ── Color palette ─────────────────────────────────────────────────────────────

const PRIMARY_COLOR = '#ef4444'   // red-500 — primary year line
const COMPARE_COLOR = '#3b82f6'   // blue-500 — comparison year line
const AREA_FILL = '#fecaca'       // red-200 — area fill (single mode)

// ── Custom tooltip ────────────────────────────────────────────────────────────

function CustomTooltip({
  active,
  payload,
  label,
  tCumulative,
  tNew,
}: {
  active?: boolean
  payload?: any[]
  label?: string
  tCumulative: string
  tNew: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-background border rounded-lg shadow-lg p-3 text-xs space-y-1">
      <p className="font-semibold text-sm">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-medium">{entry.value}</span>
        </div>
      ))}
    </div>
  )
}

// ── Summary stat card ─────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon,
  highlight,
}: {
  label: string
  value: string | number
  sub?: string
  icon: React.ReactNode
  highlight?: 'red' | 'green' | 'default'
}) {
  const colors = {
    red: 'text-red-600 dark:text-red-400',
    green: 'text-green-600 dark:text-green-400',
    default: 'text-foreground',
  }
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={`text-2xl font-bold ${colors[highlight ?? 'default']}`}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
          </div>
          <div className="text-muted-foreground">{icon}</div>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-72 text-muted-foreground gap-3">
      <Users className="h-12 w-12 opacity-30" />
      <p className="font-medium text-base">{title}</p>
      <p className="text-sm text-center max-w-xs">{desc}</p>
    </div>
  )
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface WithdrawalChartProps {
  academicYears: AcademicYear[]
  campusId?: string
}

// ── Main Component ────────────────────────────────────────────────────────────

export function WithdrawalChart({ academicYears, campusId }: WithdrawalChartProps) {
  const t = useTranslations('withdrawal')

  // ── State ──────────────────────────────────────────────────────────────────

  const currentYear = academicYears.find((y) => y.is_current) ?? academicYears[0]

  const [selectedYearId, setSelectedYearId] = useState(currentYear?.id ?? '')
  const [granularity, setGranularity] = useState<'annual' | 'semester'>('annual')
  const [semester, setSemester] = useState<'1' | '2'>('1')
  const [comparisonMode, setComparisonMode] = useState(false)
  const [compareYearId, setCompareYearId] = useState('')

  const [chartData, setChartData] = useState<WithdrawalDataPoint[]>([])
  const [comparisonData, setComparisonData] = useState<WithdrawalComparisonData>({})
  const [summary, setSummary] = useState<WithdrawalSummary | null>(null)
  const [loading, setLoading] = useState(false)

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    if (!selectedYearId) return
    setLoading(true)
    try {
      const [cumulRes, summaryRes] = await Promise.all([
        getWithdrawalCumulative({
          academicYearId: selectedYearId,
          granularity,
          semester: granularity === 'semester' ? semester : undefined,
          campusId,
        }),
        getWithdrawalSummary({ academicYearId: selectedYearId, campusId }),
      ])

      if (cumulRes.success && cumulRes.data) setChartData(cumulRes.data)
      else setChartData([])

      if (summaryRes.success && summaryRes.data) setSummary(summaryRes.data)
      else setSummary(null)

      if (comparisonMode && compareYearId && compareYearId !== selectedYearId) {
        const compRes = await getWithdrawalComparison({
          academicYearIds: [selectedYearId, compareYearId],
          granularity,
          campusId,
        })
        if (compRes.success && compRes.data) setComparisonData(compRes.data)
        else setComparisonData({})
      } else {
        setComparisonData({})
      }
    } finally {
      setLoading(false)
    }
  }, [selectedYearId, granularity, semester, comparisonMode, compareYearId, campusId])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Comparison chart data (merge two series by position) ──────────────────

  const mergedComparisonData = (() => {
    const entries = Object.entries(comparisonData)
    if (entries.length < 2) return []
    const [nameA, seriesA] = entries[0]
    const [nameB, seriesB] = entries[1]
    const len = Math.max(seriesA.length, seriesB.length)
    return Array.from({ length: len }, (_, i) => ({
      label: seriesA[i]?.label ?? seriesB[i]?.label ?? `Month ${i + 1}`,
      [nameA]: seriesA[i]?.cumulative ?? null,
      [nameB]: seriesB[i]?.cumulative ?? null,
    }))
  })()

  const yearNames = Object.keys(comparisonData)
  const isComparison = comparisonMode && mergedComparisonData.length > 0

  // ── vs last year display ──────────────────────────────────────────────────

  const vsLabel = (() => {
    if (summary?.vsLastYear == null) return '—'
    const sign = summary.vsLastYear > 0 ? '+' : ''
    return `${sign}${summary.vsLastYear}%`
  })()

  const vsHighlight: 'red' | 'green' | 'default' =
    summary?.trend === 'up' ? 'red' : summary?.trend === 'down' ? 'green' : 'default'

  const TrendIcon =
    summary?.trend === 'up' ? TrendingUp : summary?.trend === 'down' ? TrendingDown : Minus

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* Summary stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label={t('totalWithdrawals')}
          value={summary?.total ?? '—'}
          icon={<Users className="h-5 w-5" />}
          highlight="red"
        />
        <StatCard
          label={t('vsLastYear')}
          value={vsLabel}
          icon={<TrendIcon className="h-5 w-5" />}
          highlight={vsHighlight}
          sub={summary?.vsLastYear == null ? undefined : summary.trend === 'up' ? t('trendUp') : summary.trend === 'down' ? t('trendDown') : t('trendStable')}
        />
        <StatCard
          label={t('peakMonth')}
          value={summary?.peakMonth ?? '—'}
          icon={<Calendar className="h-5 w-5" />}
        />
      </div>

      {/* Chart card */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-[#022172] dark:text-white">
                <TrendingDown className="h-5 w-5 text-red-500" />
                {t('chartTitle')}
              </CardTitle>
              <CardDescription className="mt-1">{t('chartSubtitle')}</CardDescription>
            </div>

            {/* Comparison mode toggle */}
            <Button
              variant={comparisonMode ? 'default' : 'outline'}
              size="sm"
              onClick={() => setComparisonMode(!comparisonMode)}
              className="gap-2"
            >
              <GitCompare className="h-4 w-4" />
              {t('comparisonMode')}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Filters row */}
          <div className="flex flex-wrap items-center gap-4">

            {/* Academic year */}
            <div className="flex items-center gap-2">
              <Label className="text-sm whitespace-nowrap">{t('academicYear')}:</Label>
              <Select value={selectedYearId} onValueChange={setSelectedYearId}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {academicYears.map((y) => (
                    <SelectItem key={y.id} value={y.id}>
                      {y.name}
                      {y.is_current && (
                        <Badge variant="secondary" className="ms-1.5 text-[10px] py-0">
                          Current
                        </Badge>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Granularity toggle */}
            <div className="flex items-center gap-2">
              <Label className="text-sm whitespace-nowrap">{t('granularityAnnual')} / {t('granularitySemester')}:</Label>
              <Tabs value={granularity} onValueChange={(v) => setGranularity(v as 'annual' | 'semester')}>
                <TabsList className="h-8">
                  <TabsTrigger value="annual" className="text-xs px-3">{t('granularityAnnual')}</TabsTrigger>
                  <TabsTrigger value="semester" className="text-xs px-3">{t('granularitySemester')}</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Semester selector (only when granularity = semester) */}
            {granularity === 'semester' && (
              <div className="flex items-center gap-2">
                <Label className="text-sm whitespace-nowrap">{t('semester')}:</Label>
                <Tabs value={semester} onValueChange={(v) => setSemester(v as '1' | '2')}>
                  <TabsList className="h-8">
                    <TabsTrigger value="1" className="text-xs px-3">{t('semesterOne')}</TabsTrigger>
                    <TabsTrigger value="2" className="text-xs px-3">{t('semesterTwo')}</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            )}

            {/* Comparison year selector */}
            {comparisonMode && (
              <div className="flex items-center gap-2">
                <Label className="text-sm whitespace-nowrap">{t('compareWith')}:</Label>
                <Select value={compareYearId} onValueChange={setCompareYearId}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Select year" />
                  </SelectTrigger>
                  <SelectContent>
                    {academicYears
                      .filter((y) => y.id !== selectedYearId)
                      .map((y) => (
                        <SelectItem key={y.id} value={y.id}>
                          {y.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Chart note */}
          <p className="text-xs text-muted-foreground">{t('chartNote')}</p>

          {/* Chart area */}
          {loading ? (
            <div className="flex items-center justify-center h-72 text-muted-foreground gap-2">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="text-sm">{t('loading')}</span>
            </div>
          ) : isComparison ? (
            /* ── Comparison mode: two lines ── */
            mergedComparisonData.length === 0 ? (
              <EmptyState title={t('emptyTitle')} desc={t('emptyDesc')} />
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={mergedComparisonData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11 }}
                      className="text-muted-foreground"
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      className="text-muted-foreground"
                      allowDecimals={false}
                    />
                    <Tooltip
                      content={
                        <CustomTooltip
                          tCumulative={t('tooltipCumulative')}
                          tNew={t('tooltipNew')}
                        />
                      }
                    />
                    <Legend />
                    {yearNames[0] && (
                      <Line
                        type="monotone"
                        dataKey={yearNames[0]}
                        stroke={PRIMARY_COLOR}
                        strokeWidth={2}
                        dot={{ r: 3, fill: PRIMARY_COLOR }}
                        activeDot={{ r: 5 }}
                        connectNulls
                      />
                    )}
                    {yearNames[1] && (
                      <Line
                        type="monotone"
                        dataKey={yearNames[1]}
                        stroke={COMPARE_COLOR}
                        strokeWidth={2}
                        dot={{ r: 3, fill: COMPARE_COLOR }}
                        activeDot={{ r: 5 }}
                        connectNulls
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )
          ) : chartData.length === 0 ? (
            /* ── Empty state ── */
            <EmptyState title={t('emptyTitle')} desc={t('emptyDesc')} />
          ) : (
            /* ── Single year area chart ── */
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <defs>
                    <linearGradient id="withdrawalGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={PRIMARY_COLOR} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={PRIMARY_COLOR} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11 }}
                    className="text-muted-foreground"
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    className="text-muted-foreground"
                    allowDecimals={false}
                  />
                  <Tooltip
                    content={
                      <CustomTooltip
                        tCumulative={t('tooltipCumulative')}
                        tNew={t('tooltipNew')}
                      />
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="cumulative"
                    name={t('tooltipCumulative')}
                    stroke={PRIMARY_COLOR}
                    strokeWidth={2.5}
                    fill="url(#withdrawalGrad)"
                    dot={{ r: 4, fill: PRIMARY_COLOR, strokeWidth: 0 }}
                    activeDot={{ r: 6 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
