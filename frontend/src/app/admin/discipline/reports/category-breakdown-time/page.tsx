'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { TrendingUp, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useCampus } from '@/context/CampusContext';
import {
  getDisciplineFields,
  getAllDisciplineReferrals,
  type DisciplineField,
  type DisciplineReferral,
} from '@/lib/api/discipline';
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

const CHARTABLE_TYPES = ['select', 'multiple_radio', 'multiple_checkbox', 'checkbox'];

// ---------------------------------------------------------------------------
// Helpers
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
  // School year starts in September (month 9)
  return month >= 9 ? String(year) : String(year - 1);
}

function formatYearLabel(yr: string): string {
  return `${yr}–${Number(yr) + 1}`;
}

/** Generate all month keys between start and end (inclusive) */
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
  for (let y = Number(start); y <= Number(end); y++) {
    result.push(String(y));
  }
  return result;
}

interface SeriesData {
  periodKey: string;
  label: string;
  [option: string]: string | number;
}

function buildTimeSeriesData(
  referrals: DisciplineReferral[],
  field: DisciplineField,
  timeframe: 'month' | 'year',
  startDate: string,
  endDate: string,
  yesLabel: string,
  noLabel: string
): SeriesData[] {
  // Determine options
  let options: string[] = [];
  if (field.field_type === 'checkbox') {
    options = [yesLabel, noLabel];
  } else {
    options = field.options ?? [];
  }

  // Get period range
  const startKey = timeframe === 'month' ? getMonthKey(startDate || endDate) : getSchoolYearKey(startDate || endDate);
  const endKey = timeframe === 'month' ? getMonthKey(endDate) : getSchoolYearKey(endDate);

  const periods = timeframe === 'month' ? monthRange(startKey, endKey) : yearRange(startKey, endKey);

  // Init map
  const map: Record<string, Record<string, number>> = {};
  for (const p of periods) {
    map[p] = {};
    for (const opt of options) map[p][opt] = 0;
  }

  // Tally referrals
  for (const r of referrals) {
    const periodKey =
      timeframe === 'month' ? getMonthKey(r.incident_date) : getSchoolYearKey(r.incident_date);
    if (!map[periodKey]) continue;

    const val = r.field_values?.[field.id];
    if (val === null || val === undefined || val === '') continue;

    if (field.field_type === 'checkbox') {
      const k = val === 'Y' || val === true ? yesLabel : noLabel;
      map[periodKey][k] = (map[periodKey][k] ?? 0) + 1;
    } else if (field.field_type === 'multiple_checkbox' || Array.isArray(val)) {
      const arr: string[] = Array.isArray(val)
        ? val
        : String(val).replace(/^\|+|\|+$/g, '').split('||').filter(Boolean);
      for (const v of arr) {
        if (map[periodKey][v] !== undefined) {
          map[periodKey][v]++;
        }
      }
    } else {
      const k = String(val);
      if (map[periodKey][k] !== undefined) {
        map[periodKey][k] = (map[periodKey][k] ?? 0) + 1;
      }
    }
  }

  return periods.map((p) => ({
    periodKey: p,
    label: timeframe === 'month' ? formatMonthLabel(p) : formatYearLabel(p),
    ...map[p],
  }));
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CategoryBreakdownTimePage() {
  const t = useTranslations('discipline');
  const { user } = useAuth();
  const campusCtx = useCampus();
  const campusId = campusCtx?.selectedCampus?.id;
  const schoolId = user?.school_id || campusCtx?.selectedCampus?.parent_school_id || '';

  const today = new Date().toISOString().slice(0, 10);

  const [fields, setFields] = useState<DisciplineField[]>([]);
  const [loadingFields, setLoadingFields] = useState(true);
  const [selectedFieldId, setSelectedFieldId] = useState('');
  const [timeframe, setTimeframe] = useState<'month' | 'year'>('month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState(today);

  const [referrals, setReferrals] = useState<DisciplineReferral[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    if (!schoolId) { setLoadingFields(false); return; }
    getDisciplineFields(schoolId)
      .then((res) => {
        const chartable = (res.data ?? []).filter((f) =>
          CHARTABLE_TYPES.includes(f.field_type)
        );
        setFields(chartable);
      })
      .catch(() => toast.error(t('errors.loadCategories')))
      .finally(() => setLoadingFields(false));
  }, [schoolId]);

  async function handleGo() {
    if (!schoolId || !selectedFieldId) return;
    setLoading(true);
    try {
      const res = await getAllDisciplineReferrals({
        school_id: schoolId,
        campus_id: campusId,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      });
      setReferrals(res.data ?? []);
      setHasLoaded(true);
    } catch {
      toast.error(t('errors.loadReferrals'));
    } finally {
      setLoading(false);
    }
  }

  const selectedField = fields.find((f) => f.id === selectedFieldId);
  const seriesData = selectedField
    ? buildTimeSeriesData(referrals, selectedField, timeframe, startDate, endDate, t('yes'), t('no'))
    : [];

  const options: string[] =
    selectedField?.field_type === 'checkbox'
      ? [t('yes'), t('no')]
      : (selectedField?.options ?? []);

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-5xl mx-auto space-y-6">

        <h1 className="text-3xl font-bold flex items-center gap-2">
          <TrendingUp className="h-7 w-7 text-primary" />
          {t('categoryBreakdownOverTime')}
        </h1>

        <Card>
          <CardContent className="pt-5 pb-5 space-y-4">
            {/* Category select */}
            <div className="space-y-1.5">
              <Label>{t('category')}</Label>
              {loadingFields ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> {t('loading')}
                </div>
              ) : (
                <Select value={selectedFieldId} onValueChange={setSelectedFieldId}>
                  <SelectTrigger className="max-w-xs">
                    <SelectValue placeholder={t('chooseCategory')} />
                  </SelectTrigger>
                  <SelectContent>
                    {fields.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Timeframe radio */}
            <div className="space-y-1.5">
              <Label>{t('timeframe')}</Label>
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
                  {t('month')}
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
                  {t('schoolYear')}
                </label>
              </div>
            </div>

            {/* Date range */}
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">{t('reportTimeframeFrom')}</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-40 h-8 text-sm"
                />
              </div>
              <div className="flex items-end gap-1.5">
                <span className="text-sm text-muted-foreground pb-1.5">{t('to')}</span>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-40 h-8 text-sm"
                />
              </div>
              <Button
                onClick={handleGo}
                disabled={!selectedFieldId || loading}
                size="sm"
                className="h-8"
              >
                {loading && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
                {t('go')}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {hasLoaded && selectedField && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {selectedField.name} {t('breakdownOverTime')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {seriesData.length === 0 ? (
                <p className="text-center py-10 text-muted-foreground text-sm">
                  {t('noDataForFilters')}
                </p>
              ) : (
                <Tabs defaultValue="column">
                  <TabsList>
                    <TabsTrigger value="column">{t('column')}</TabsTrigger>
                    <TabsTrigger value="list">{t('list')}</TabsTrigger>
                  </TabsList>

                  {/* Grouped bar chart */}
                  <TabsContent value="column" className="pt-6">
                    <ResponsiveContainer width="100%" height={360}>
                      <BarChart
                        data={seriesData}
                        margin={{ top: 5, right: 20, bottom: 50, left: 0 }}
                      >
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
                        {options.map((opt, i) => (
                          <Bar
                            key={opt}
                            dataKey={opt}
                            name={opt}
                            fill={CHART_COLORS[i % CHART_COLORS.length]}
                            radius={[3, 3, 0, 0]}
                          />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </TabsContent>

                  {/* Table */}
                  <TabsContent value="list" className="pt-4">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t('option')}</TableHead>
                            {seriesData.map((d) => (
                              <TableHead key={d.periodKey} className="text-center">
                                {d.label}
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {options.map((opt) => (
                            <TableRow key={opt}>
                              <TableCell className="font-medium">{opt}</TableCell>
                              {seriesData.map((d) => (
                                <TableCell key={d.periodKey} className="text-center">
                                  {d[opt] ?? 0}
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
