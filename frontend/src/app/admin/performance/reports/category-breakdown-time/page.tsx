'use client';

import { useState } from 'react';
import { useLocale } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { TrendingUp, Loader2 } from 'lucide-react';
import { useCampus } from '@/context/CampusContext';
import { getAllLogs, type StaffPerformanceLog } from '@/lib/api/performance';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

const CHART_COLORS = [
  '#0088FE', '#00C49F', '#FFBB28', '#FF8042',
  '#8884d8', '#82ca9d', '#ff7c7c', '#a4de6c',
  '#d0ed57', '#83a6ed', '#8dd1e1', '#a4262c',
];

// ---------------------------------------------------------------------------
// Helpers — month/school-year bucketing (mirrors discipline/reports/category-breakdown-time)
// ---------------------------------------------------------------------------

function getMonthKey(dateStr: string): string {
  return dateStr.slice(0, 7); // "YYYY-MM"
}

function formatMonthLabel(ym: string): string {
  const [year, month] = ym.split('-');
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

function getSchoolYearKey(dateStr: string): string {
  const year = Number(dateStr.slice(0, 4));
  const month = Number(dateStr.slice(5, 7));
  return month >= 9 ? String(year) : String(year - 1);
}

function formatYearLabel(yr: string): string {
  return `${yr}–${Number(yr) + 1}`;
}

function monthRange(start: string, end: string): string[] {
  const result: string[] = [];
  const s = new Date(start + '-01');
  const e = new Date(end + '-01');
  while (s <= e) {
    result.push(`${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, '0')}`);
    s.setMonth(s.getMonth() + 1);
  }
  return result;
}

function yearRange(start: string, end: string): string[] {
  const result: string[] = [];
  for (let y = Number(start); y <= Number(end); y++) result.push(String(y));
  return result;
}

interface SeriesData {
  periodKey: string;
  label: string;
  [action: string]: string | number;
}

function buildTimeSeriesData(
  logs: StaffPerformanceLog[],
  timeframe: 'month' | 'year',
  startDate: string,
  endDate: string,
  isAr: boolean
): { series: SeriesData[]; actions: string[] } {
  const actions = Array.from(
    new Set(logs.map((l) => (l.action ? (isAr ? l.action.action_name_ar : l.action.action_name_en) : null)).filter(Boolean) as string[])
  );

  const startKey = timeframe === 'month' ? getMonthKey(startDate || endDate) : getSchoolYearKey(startDate || endDate);
  const endKey = timeframe === 'month' ? getMonthKey(endDate) : getSchoolYearKey(endDate);
  const periods = timeframe === 'month' ? monthRange(startKey, endKey) : yearRange(startKey, endKey);

  const map: Record<string, Record<string, number>> = {};
  for (const p of periods) {
    map[p] = {};
    for (const a of actions) map[p][a] = 0;
  }

  for (const log of logs) {
    if (!log.action) continue;
    const periodKey = timeframe === 'month' ? getMonthKey(log.created_at) : getSchoolYearKey(log.created_at);
    if (!map[periodKey]) continue;
    const name = isAr ? log.action.action_name_ar : log.action.action_name_en;
    map[periodKey][name] = (map[periodKey][name] ?? 0) + 1;
  }

  const series = periods.map((p) => ({
    periodKey: p,
    label: timeframe === 'month' ? formatMonthLabel(p) : formatYearLabel(p),
    ...map[p],
  }));

  return { series, actions };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PerformanceCategoryBreakdownTimePage() {
  const locale = useLocale();
  const isAr = locale === 'ar';
  const campusCtx = useCampus();
  const campusId = campusCtx?.selectedCampus?.id;

  const today = new Date().toISOString().slice(0, 10);

  const [timeframe, setTimeframe] = useState<'month' | 'year'>('month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState(today);

  const [logs, setLogs] = useState<StaffPerformanceLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  async function handleGo() {
    setLoading(true);
    try {
      const res = await getAllLogs({
        campusId,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      setLogs(res.data ?? []);
      setHasLoaded(true);
    } catch {
      toast.error('Failed to load performance logs');
    } finally {
      setLoading(false);
    }
  }

  const { series, actions } = hasLoaded
    ? buildTimeSeriesData(logs, timeframe, startDate, endDate, isAr)
    : { series: [] as SeriesData[], actions: [] as string[] };

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-5xl mx-auto space-y-6">

        <h1 className="text-3xl font-bold flex items-center gap-2">
          <TrendingUp className="h-7 w-7 text-primary" />
          Breakdown Over Time
        </h1>

        <Card>
          <CardContent className="pt-5 pb-5 space-y-4">
            <div className="space-y-1.5">
              <Label>Timeframe</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="timeframe"
                    value="month"
                    checked={timeframe === 'month'}
                    onChange={() => setTimeframe('month')}
                    className="accent-primary"
                  />
                  Month
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="timeframe"
                    value="year"
                    checked={timeframe === 'year'}
                    onChange={() => setTimeframe('year')}
                    className="accent-primary"
                  />
                  School Year
                </label>
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">From</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-40 h-8 text-sm"
                />
              </div>
              <div className="flex items-end gap-1.5">
                <span className="text-sm text-muted-foreground pb-1.5">to</span>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-40 h-8 text-sm"
                />
              </div>
              <Button onClick={handleGo} disabled={loading} size="sm" className="h-8">
                {loading && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
                Go
              </Button>
            </div>
          </CardContent>
        </Card>

        {hasLoaded && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Breakdown Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              {series.length === 0 ? (
                <p className="text-center py-10 text-muted-foreground text-sm">
                  No data for the selected filters.
                </p>
              ) : (
                <Tabs defaultValue="column">
                  <TabsList>
                    <TabsTrigger value="column">Column</TabsTrigger>
                    <TabsTrigger value="list">List</TabsTrigger>
                  </TabsList>

                  <TabsContent value="column" className="pt-6">
                    <ResponsiveContainer width="100%" height={360}>
                      <BarChart data={series} margin={{ top: 5, right: 20, bottom: 50, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 11 }}
                          angle={-30}
                          textAnchor="end"
                          interval={0}
                        />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Legend verticalAlign="top" />
                        {actions.map((action, i) => (
                          <Bar
                            key={action}
                            dataKey={action}
                            name={action}
                            fill={CHART_COLORS[i % CHART_COLORS.length]}
                            radius={[3, 3, 0, 0]}
                          />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </TabsContent>

                  <TabsContent value="list" className="pt-4">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Action</TableHead>
                            {series.map((d) => (
                              <TableHead key={d.periodKey} className="text-center">
                                {d.label}
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {actions.map((action) => (
                            <TableRow key={action}>
                              <TableCell className="font-medium">{action}</TableCell>
                              {series.map((d) => (
                                <TableCell key={d.periodKey} className="text-center">
                                  {d[action] ?? 0}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </TabsContent>
                </Tabs>
              )}
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  );
}
