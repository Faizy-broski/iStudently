'use client';

import { useState } from 'react';
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
// Available staff fields for breakdown
// ---------------------------------------------------------------------------
const STAFF_FIELDS = [
  { value: 'role', label: 'Role' },
  { value: 'employment_type', label: 'Employment Type' },
  { value: 'department', label: 'Department' },
];

function computeByField(
  logs: StaffPerformanceLog[],
  field: string,
  notSpecifiedLabel: string
): Array<{ name: string; value: number }> {
  const counts: Record<string, number> = {};

  for (const log of logs) {
    let val: string | null | undefined;
    if (field === 'role') val = log.staff?.role;
    else if (field === 'employment_type') val = log.staff?.employment_type;
    else if (field === 'department') val = log.staff?.department;

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

export default function PerformanceBreakdownByStaffFieldPage() {
  const campusCtx = useCampus();
  const campusId = campusCtx?.selectedCampus?.id;

  const today = new Date().toISOString().slice(0, 10);

  const [selectedField, setSelectedField] = useState('role');
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

  const chartData = hasLoaded ? computeByField(logs, selectedField, 'Not Specified') : [];
  const total = chartData.reduce((s, d) => s + d.value, 0);
  const fieldLabel = STAFF_FIELDS.find((f) => f.value === selectedField)?.label ?? selectedField;

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-4xl mx-auto space-y-6">

        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Users className="h-7 w-7 text-primary" />
          Breakdown by Staff Field
        </h1>

        <Card>
          <CardContent className="pt-5 pb-5 space-y-4">
            <div className="space-y-1.5">
              <Label>Staff Field</Label>
              <Select value={selectedField} onValueChange={setSelectedField}>
                <SelectTrigger className="max-w-xs">
                  <SelectValue placeholder="Choose a staff field" />
                </SelectTrigger>
                <SelectContent>
                  {STAFF_FIELDS.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              <CardTitle className="text-base">
                {fieldLabel} Breakdown
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({total} log{total === 1 ? '' : 's'})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {chartData.length === 0 ? (
                <p className="text-center py-10 text-muted-foreground text-sm">
                  No performance logs for the selected filters.
                </p>
              ) : (
                <Tabs defaultValue="column">
                  <TabsList>
                    <TabsTrigger value="column">Column</TabsTrigger>
                    <TabsTrigger value="pie">Pie</TabsTrigger>
                    <TabsTrigger value="list">List</TabsTrigger>
                  </TabsList>

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
                        <Bar dataKey="value" name="Logs" radius={[4, 4, 0, 0]}>
                          {chartData.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </TabsContent>

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
                          label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                          labelLine={false}
                        >
                          {chartData.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v) => [`${v} logs`, '']} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </TabsContent>

                  <TabsContent value="list" className="pt-4">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{fieldLabel}</TableHead>
                          <TableHead className="text-right">Number of Logs</TableHead>
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
