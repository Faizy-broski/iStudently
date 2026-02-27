'use client';

import { useEffect, useState } from 'react';
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
import { BarChart3, Loader2 } from 'lucide-react';
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

const CHARTABLE_TYPES = ['select', 'multiple_radio', 'multiple_checkbox', 'checkbox'];

// ---------------------------------------------------------------------------
// Compute option counts from referrals for a given field
// ---------------------------------------------------------------------------

function computeCounts(
  referrals: DisciplineReferral[],
  field: DisciplineField
): Array<{ name: string; value: number }> {
  const counts: Record<string, number> = {};

  // Pre-seed with known options (ensures zero counts appear)
  if (field.field_type === 'checkbox') {
    counts['Yes'] = 0;
    counts['No'] = 0;
  } else if (field.options) {
    for (const opt of field.options) {
      counts[opt] = 0;
    }
  }

  for (const r of referrals) {
    const val = r.field_values?.[field.id];
    if (val === null || val === undefined || val === '') continue;

    if (field.field_type === 'checkbox') {
      const k = val === 'Y' || val === true ? 'Yes' : 'No';
      counts[k] = (counts[k] ?? 0) + 1;
    } else if (field.field_type === 'multiple_checkbox' || Array.isArray(val)) {
      const arr: string[] = Array.isArray(val)
        ? val
        : String(val).replace(/^\|+|\|+$/g, '').split('||').filter(Boolean);
      for (const v of arr) {
        counts[v] = (counts[v] ?? 0) + 1;
      }
    } else {
      counts[String(val)] = (counts[String(val)] ?? 0) + 1;
    }
  }

  return Object.entries(counts).map(([name, value]) => ({ name, value }));
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CategoryBreakdownPage() {
  const { user } = useAuth();
  const campusCtx = useCampus();
  const campusId = campusCtx?.selectedCampus?.id;
  const schoolId = user?.school_id || campusCtx?.selectedCampus?.parent_school_id || '';

  const today = new Date().toISOString().slice(0, 10);

  const [fields, setFields] = useState<DisciplineField[]>([]);
  const [loadingFields, setLoadingFields] = useState(true);
  const [selectedFieldId, setSelectedFieldId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState(today);

  const [referrals, setReferrals] = useState<DisciplineReferral[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  // Fetch chartable discipline fields
  useEffect(() => {
    if (!schoolId) { setLoadingFields(false); return; }
    getDisciplineFields(schoolId)
      .then((res) => {
        const chartable = (res.data ?? []).filter((f) =>
          CHARTABLE_TYPES.includes(f.field_type)
        );
        setFields(chartable);
      })
      .catch(() => toast.error('Failed to load categories'))
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
      toast.error('Failed to load referrals');
    } finally {
      setLoading(false);
    }
  }

  const selectedField = fields.find((f) => f.id === selectedFieldId);
  const chartData = selectedField ? computeCounts(referrals, selectedField) : [];
  const total = chartData.reduce((s, d) => s + d.value, 0);

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <BarChart3 className="h-7 w-7 text-primary" />
          Category Breakdown
        </h1>

        {/* Controls */}
        <Card>
          <CardContent className="pt-5 pb-5 space-y-4">
            <div className="space-y-1.5">
              <Label>Category</Label>
              {loadingFields ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading categories…
                </div>
              ) : (
                <Select value={selectedFieldId} onValueChange={setSelectedFieldId}>
                  <SelectTrigger className="max-w-xs">
                    <SelectValue placeholder="Please choose a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {fields.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">
                        No chartable fields configured
                      </div>
                    ) : (
                      fields.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">
                  Report Timeframe: From
                </Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-40 h-8 text-sm"
                />
              </div>
              <div className="flex items-end gap-1.5">
                <span className="text-sm text-muted-foreground pb-1.5">to</span>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground sr-only">To</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-40 h-8 text-sm"
                  />
                </div>
              </div>
              <Button
                onClick={handleGo}
                disabled={!selectedFieldId || loading}
                size="sm"
                className="h-8"
              >
                {loading && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
                Go
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {hasLoaded && selectedField && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {selectedField.name} Breakdown
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({total} referral{total !== 1 ? 's' : ''})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {chartData.length === 0 ? (
                <p className="text-center py-10 text-muted-foreground text-sm">
                  No referrals found for the selected filters.
                </p>
              ) : (
                <Tabs defaultValue="column">
                  <TabsList>
                    <TabsTrigger value="column">Column</TabsTrigger>
                    <TabsTrigger value="pie">Pie</TabsTrigger>
                    <TabsTrigger value="list">List</TabsTrigger>
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
                        <Bar dataKey="value" name="Referrals" radius={[4, 4, 0, 0]}>
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
                            `${name.length > 20 ? name.slice(0, 20) + '…' : name} (${(percent * 100).toFixed(0)}%)`
                          }
                          labelLine={false}
                        >
                          {chartData.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v) => [`${v} referral(s)`, '']} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </TabsContent>

                  {/* List */}
                  <TabsContent value="list" className="pt-4">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Option</TableHead>
                          <TableHead className="text-right">Number of Referrals</TableHead>
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
                          <TableCell>Total</TableCell>
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
