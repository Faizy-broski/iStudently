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
import { Users, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useCampus } from '@/context/CampusContext';
import {
  getAllDisciplineReferrals,
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
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

const CHART_COLORS = [
  '#0088FE', '#00C49F', '#FFBB28', '#FF8042',
  '#8884d8', '#82ca9d', '#ff7c7c', '#a4de6c',
  '#d0ed57', '#83a6ed', '#8dd1e1', '#a4262c',
];

// ---------------------------------------------------------------------------
// Available student fields for breakdown
// ---------------------------------------------------------------------------
const STUDENT_FIELDS = [
  { value: 'grade_level', label: 'gradeLevel' },
];

// ---------------------------------------------------------------------------
// Compute counts from referrals by student field
// ---------------------------------------------------------------------------

function computeByField(
  referrals: DisciplineReferral[],
  field: string,
  notSpecifiedLabel: string
): Array<{ name: string; value: number }> {
  const counts: Record<string, number> = {};

  for (const r of referrals) {
    let val: string | null | undefined;
    if (field === 'grade_level') {
      val = r.students?.grade_level;
    }
    const key = val?.trim() || notSpecifiedLabel;
    counts[key] = (counts[key] ?? 0) + 1;
  }

  return Object.entries(counts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, value]) => ({ name, value }));
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function BreakdownStudentFieldPage() {
  const t = useTranslations('discipline');
  const { user } = useAuth();
  const campusCtx = useCampus();
  const campusId = campusCtx?.selectedCampus?.id;
  const schoolId = user?.school_id || campusCtx?.selectedCampus?.parent_school_id || '';

  const today = new Date().toISOString().slice(0, 10);

  const [selectedField, setSelectedField] = useState('grade_level');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState(today);

  const [referrals, setReferrals] = useState<DisciplineReferral[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  async function handleGo() {
    if (!schoolId) return;
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

  const chartData = hasLoaded ? computeByField(referrals, selectedField, t('notSpecified')) : [];
  const total = chartData.reduce((s, d) => s + d.value, 0);
  const fieldLabelKey = STUDENT_FIELDS.find((f) => f.value === selectedField)?.label ?? selectedField;
  const fieldLabel = t(fieldLabelKey);

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-4xl mx-auto space-y-6">

        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Users className="h-7 w-7 text-primary" />
          {t('breakdownByStudentField')}
        </h1>

        <Card>
          <CardContent className="pt-5 pb-5 space-y-4">
            {/* Field select */}
            <div className="space-y-1.5">
              <Label>{t('studentField')}</Label>
              <Select value={selectedField} onValueChange={setSelectedField}>
                <SelectTrigger className="max-w-xs">
                  <SelectValue placeholder={t('chooseStudentField')} />
                </SelectTrigger>
                <SelectContent>
                  {STUDENT_FIELDS.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      {t(f.label)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date range + Go */}
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
                disabled={loading}
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
        {hasLoaded && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {fieldLabel} Breakdown
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({t('referralsCount', { count: total })})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {chartData.length === 0 ? (
                <p className="text-center py-10 text-muted-foreground text-sm">
                  {t('noReferralsForFilters')}
                </p>
              ) : (
                <Tabs defaultValue="column">
                  <TabsList>
                    <TabsTrigger value="column">{t('column')}</TabsTrigger>
                    <TabsTrigger value="pie">{t('pie')}</TabsTrigger>
                    <TabsTrigger value="list">{t('list')}</TabsTrigger>
                  </TabsList>

                  {/* Bar chart */}
                  <TabsContent value="column" className="pt-6">
                    <ResponsiveContainer width="100%" height={320}>
                      <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 40, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 12 }}
                          angle={-30}
                          textAnchor="end"
                          interval={0}
                        />
                        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Bar dataKey="value" name={t('referrals')} radius={[4, 4, 0, 0]}>
                          {chartData.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </TabsContent>

                  {/* Pie chart */}
                  <TabsContent value="pie" className="pt-6">
                    <ResponsiveContainer width="100%" height={320}>
                      <PieChart>
                        <Pie
                          data={chartData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={110}
                          label={({ name, percent }) =>
                            `${name} (${(percent * 100).toFixed(0)}%)`
                          }
                          labelLine={false}
                        >
                          {chartData.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v) => [`${v} ${t('referrals')}`, '']} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </TabsContent>

                  {/* List */}
                  <TabsContent value="list" className="pt-4">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{fieldLabel}</TableHead>
                          <TableHead className="text-right">{t('numberOfReferrals')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {chartData.map((row) => (
                          <TableRow key={row.name}>
                            <TableCell>{row.name}</TableCell>
                            <TableCell className="text-right font-medium">{row.value}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="border-t-2 font-semibold">
                          <TableCell>{t('total')}</TableCell>
                          <TableCell className="text-right">{total}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
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
