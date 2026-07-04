'use client';

import { useRef, useState } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { FileText, Loader2, Printer, Search, RefreshCcw } from 'lucide-react';
import { useCampus } from '@/context/CampusContext';
import { getAllLogs, type StaffPerformanceLog } from '@/lib/api/performance';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function staffFullName(log: StaffPerformanceLog): string {
  const p = log.staff?.profiles;
  if (p) return `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || log.staff?.employee_number || log.staff_id;
  return log.staff?.employee_number || log.staff_id;
}

function reporterName(log: StaffPerformanceLog): string {
  if (!log.reporter) return '-';
  return `${log.reporter.first_name ?? ''} ${log.reporter.last_name ?? ''}`.trim() || '-';
}

function effectivePoints(log: StaffPerformanceLog): number {
  return log.custom_points != null ? log.custom_points : (log.action?.default_points ?? 0);
}

function effectiveFine(log: StaffPerformanceLog): number {
  return log.custom_fine != null ? log.custom_fine : (log.action?.default_fine ?? 0);
}

function groupByStaff(logs: StaffPerformanceLog[]): Map<string, StaffPerformanceLog[]> {
  const map = new Map<string, StaffPerformanceLog[]>();
  for (const log of logs) {
    if (!map.has(log.staff_id)) map.set(log.staff_id, []);
    map.get(log.staff_id)!.push(log);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PerformanceLogPage() {
  const locale = useLocale();
  const isAr = locale === 'ar';
  const campusCtx = useCampus();
  const campusId = campusCtx?.selectedCampus?.id;

  const printRef = useRef<HTMLDivElement>(null);

  const [incidentFrom, setIncidentFrom] = useState('');
  const [incidentTo, setIncidentTo] = useState(new Date().toISOString().slice(0, 10));
  const [staffSearch, setStaffSearch] = useState('');

  const [logs, setLogs] = useState<StaffPerformanceLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  async function handleSearch() {
    setLoading(true);
    try {
      const res = await getAllLogs({
        campusId,
        startDate: incidentFrom || undefined,
        endDate: incidentTo || undefined,
      });
      setLogs(res.data ?? []);
      setHasLoaded(true);
    } catch {
      toast.error('Failed to load performance logs');
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setIncidentFrom('');
    setIncidentTo(new Date().toISOString().slice(0, 10));
    setStaffSearch('');
    setLogs([]);
    setHasLoaded(false);
  }

  const filtered = logs.filter((log) => {
    if (!staffSearch.trim()) return true;
    const name = staffFullName(log).toLowerCase();
    return name.includes(staffSearch.toLowerCase()) || (log.staff?.employee_number ?? '').includes(staffSearch);
  });

  const grouped = groupByStaff(filtered);

  function handlePrint() {
    window.print();
  }

  return (
    <div className="container mx-auto py-8 print:py-2">
      <div className="max-w-5xl mx-auto space-y-6 print:space-y-3">

        <div className="flex items-start justify-between print:hidden">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <FileText className="h-7 w-7 text-primary" />
            Performance Log
          </h1>
          {hasLoaded && filtered.length > 0 && (
            <Button variant="outline" onClick={handlePrint} className="gap-2">
              <Printer className="h-4 w-4" />
              Print Log
            </Button>
          )}
        </div>

        <Card className="print:hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>From</Label>
                <Input
                  type="date"
                  value={incidentFrom}
                  onChange={(e) => setIncidentFrom(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label>To</Label>
                <Input
                  type="date"
                  value={incidentTo}
                  onChange={(e) => setIncidentTo(e.target.value)}
                  className="h-9"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Staff Search</Label>
              <div className="relative max-w-xs">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  className="pl-8 h-9"
                  placeholder="Search by name or employee number..."
                  value={staffSearch}
                  onChange={(e) => setStaffSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSearch} disabled={loading} size="sm">
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Search className="h-4 w-4 mr-2" />
                )}
                Search
              </Button>
              <Button variant="outline" size="sm" onClick={handleReset}>
                <RefreshCcw className="h-4 w-4 mr-2" />
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="hidden print:block">
          <h1 className="text-2xl font-bold mb-1">Performance Log</h1>
          <p className="text-sm text-gray-500">
            {incidentFrom && incidentTo ? `${incidentFrom} to ${incidentTo}` : incidentTo ? `Up to ${incidentTo}` : ''}
          </p>
        </div>

        {hasLoaded && (
          <div ref={printRef} className="space-y-6 print:space-y-4">
            {grouped.size === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm print:hidden">
                No staff match the selected filters.
              </div>
            ) : (
              Array.from(grouped.entries()).map(([staffId, staffLogs]) => {
                const first = staffLogs[0];
                const name = staffFullName(first);
                const employeeNumber = first.staff?.employee_number;
                const role = first.staff?.role;

                return (
                  <Card key={staffId} className="print:shadow-none print:border">
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-3 flex-wrap">
                        <CardTitle className="text-base">{name}</CardTitle>
                        {employeeNumber && (
                          <Badge variant="secondary" className="font-normal">#{employeeNumber}</Badge>
                        )}
                        {role && (
                          <Badge variant="outline" className="font-normal">{role}</Badge>
                        )}
                        <span className="ml-auto text-sm text-muted-foreground">
                          {staffLogs.length} log{staffLogs.length === 1 ? '' : 's'}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Date</TableHead>
                              <TableHead>Action</TableHead>
                              <TableHead className="text-right">Points</TableHead>
                              <TableHead className="text-right">Fine</TableHead>
                              <TableHead>Reporter</TableHead>
                              <TableHead>Notes</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {staffLogs
                              .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                              .map((log) => {
                                const pts = effectivePoints(log);
                                const fine = effectiveFine(log);
                                return (
                                  <TableRow key={log.id}>
                                    <TableCell className="text-sm">
                                      {new Date(log.created_at).toLocaleDateString()}
                                    </TableCell>
                                    <TableCell className="text-sm">
                                      {log.action ? (isAr ? log.action.action_name_ar : log.action.action_name_en) : '-'}
                                    </TableCell>
                                    <TableCell className={`text-right text-sm font-medium ${pts < 0 ? 'text-red-600' : pts > 0 ? 'text-green-600' : ''}`}>
                                      {pts > 0 ? `+${pts}` : pts}
                                    </TableCell>
                                    <TableCell className="text-right text-sm">
                                      {fine !== 0 ? fine.toFixed(2) : '-'}
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                      {reporterName(log)}
                                    </TableCell>
                                    <TableCell className="text-sm max-w-[200px] truncate">
                                      {log.notes || '-'}
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}

            {grouped.size > 0 && (
              <div className="text-xs text-muted-foreground text-right print:hidden">
                {filtered.length} log{filtered.length === 1 ? '' : 's'} across {grouped.size} staff member{grouped.size === 1 ? '' : 's'}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
