'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { useAuth } from '@/context/AuthContext';
import { useCampus } from '@/context/CampusContext';
import {
  getDisciplineFields,
  getAllDisciplineReferrals,
  type DisciplineField,
  type DisciplineReferral,
} from '@/lib/api/discipline';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function studentFullName(r: DisciplineReferral): string {
  if (r.students) {
    const { first_name, last_name } = r.students;
    return `${first_name ?? ''} ${last_name ?? ''}`.trim() || r.students.student_number;
  }
  return r.student_id;
}

function formatFieldValue(val: unknown): string {
  if (val === null || val === undefined || val === '') return '-';
  if (val === 'Y' || val === true) return 'Y';
  if (val === 'N' || val === false) return 'N';
  if (Array.isArray(val)) return val.join(', ');
  const s = String(val).replace(/^\|+|\|+$/g, '').replace(/\|\|/g, ', ');
  return s || '-';
}

function groupByStudent(referrals: DisciplineReferral[]): Map<string, DisciplineReferral[]> {
  const map = new Map<string, DisciplineReferral[]>();
  for (const r of referrals) {
    const key = r.student_id;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(r);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface IncludeColumns {
  entry_date: boolean;
  reporter: boolean;
  [fieldId: string]: boolean;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DisciplineLogPage() {
  const t = useTranslations('discipline');
  const { user } = useAuth();
  const campusCtx = useCampus();
  const campusId = campusCtx?.selectedCampus?.id;
  const schoolId = user?.school_id || campusCtx?.selectedCampus?.parent_school_id || '';

  const printRef = useRef<HTMLDivElement>(null);

  // Discipline fields
  const [fields, setFields] = useState<DisciplineField[]>([]);
  const [loadingFields, setLoadingFields] = useState(true);

  // Filters
  const [reporterFilter, setReporterFilter] = useState('');
  const [incidentFrom, setIncidentFrom] = useState('');
  const [incidentTo, setIncidentTo] = useState(new Date().toISOString().slice(0, 10));
  const [studentSearch, setStudentSearch] = useState('');

  // Which columns to include in the log
  const [includeColumns, setIncludeColumns] = useState<IncludeColumns>({
    entry_date: true,
    reporter: true,
  });

  // Data
  const [referrals, setReferrals] = useState<DisciplineReferral[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  // Fetch discipline fields
  useEffect(() => {
    if (!schoolId) { setLoadingFields(false); return; }
    getDisciplineFields(schoolId)
      .then((res) => {
        const f = res.data ?? [];
        setFields(f);
        // Default: last field (comments/textarea) ticked; others not
        const initial: IncludeColumns = { entry_date: true, reporter: true };
        f.forEach((fld) => {
          initial[fld.id] = fld.field_type === 'textarea';
        });
        setIncludeColumns(initial);
      })
      .catch(() => toast.error(t('errors.loadFields')))
      .finally(() => setLoadingFields(false));
  }, [schoolId]);

  // Unique reporters extracted from loaded referrals
  const reporters = Array.from(
    new Map(
      referrals
        .filter((r) => r.reporter)
        .map((r) => [r.reporter!.id, r.reporter!.full_name])
    ).entries()
  );

  async function handleSearch() {
    if (!schoolId) return;
    setLoading(true);
    try {
      const res = await getAllDisciplineReferrals({
        school_id: schoolId,
        campus_id: campusId,
        start_date: incidentFrom || undefined,
        end_date: incidentTo || undefined,
      });
      setReferrals(res.data ?? []);
      setHasLoaded(true);
    } catch {
      toast.error(t('errors.loadReferrals'));
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setReporterFilter('');
    setIncidentFrom('');
    setIncidentTo(new Date().toISOString().slice(0, 10));
    setStudentSearch('');
    setReferrals([]);
    setHasLoaded(false);
  }

  function toggleColumn(key: string) {
    setIncludeColumns((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  // Apply client-side filters
  const filtered = referrals.filter((r) => {
    if (reporterFilter && reporterFilter !== 'all' && r.reporter?.id !== reporterFilter) return false;
    if (
      studentSearch.trim() &&
      !studentFullName(r).toLowerCase().includes(studentSearch.toLowerCase()) &&
      !(r.students?.student_number ?? '').includes(studentSearch)
    ) {
      return false;
    }
    return true;
  });

  const grouped = groupByStudent(filtered);

  // Active field columns
  const activeFields = fields.filter((f) => includeColumns[f.id]);

  function handlePrint() {
    window.print();
  }

  return (
    <div className="container mx-auto py-8 print:py-2">
      <div className="max-w-5xl mx-auto space-y-6 print:space-y-3">

        {/* Header */}
        <div className="flex items-start justify-between print:hidden">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <FileText className="h-7 w-7 text-primary" />
            {t('title')}
          </h1>
          {hasLoaded && filtered.length > 0 && (
            <Button variant="outline" onClick={handlePrint} className="gap-2">
              <Printer className="h-4 w-4" />
              {t('printLog')}
            </Button>
          )}
        </div>

        {/* Filter panel */}
        <Card className="print:hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              {t('filters')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Reporter */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>{t('reporter')}</Label>
                <Select value={reporterFilter} onValueChange={setReporterFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('notSpecified')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('allReporters')}</SelectItem>
                    {reporters.map(([id, name]) => (
                      <SelectItem key={id} value={id}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Incident date range */}
              <div className="space-y-1.5">
                <Label>{t('incidentDateMin')}</Label>
                <Input
                  type="date"
                  value={incidentFrom}
                  onChange={(e) => setIncidentFrom(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t('incidentDateMax')}</Label>
                <Input
                  type="date"
                  value={incidentTo}
                  onChange={(e) => setIncidentTo(e.target.value)}
                  className="h-9"
                />
              </div>
            </div>

            {/* Student search */}
            <div className="space-y-1.5">
              <Label>{t('studentSearch')}</Label>
              <div className="relative max-w-xs">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  className="pl-8 h-9"
                  placeholder={t('search_placeholder')}
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                />
              </div>
            </div>

            {/* Include in log checkboxes */}
            <div className="border rounded-md p-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('email.includeInLog')}
              </p>
              {loadingFields ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> {t('loadingFields')}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={includeColumns.entry_date}
                      onCheckedChange={() => toggleColumn('entry_date')}
                    />
                    {t('entryDate')}
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={includeColumns.reporter}
                      onCheckedChange={() => toggleColumn('reporter')}
                    />
                    {t('reporter')}
                  </label>
                  {fields.map((f) => (
                    <label key={f.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={!!includeColumns[f.id]}
                        onCheckedChange={() => toggleColumn(f.id)}
                      />
                      {f.name}
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button onClick={handleSearch} disabled={loading} size="sm">
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Search className="h-4 w-4 mr-2" />
                )}
                {t('search')}
              </Button>
              <Button variant="outline" size="sm" onClick={handleReset}>
                <RefreshCcw className="h-4 w-4 mr-2" />
                {t('reset')}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Print title */}
        <div className="hidden print:block">
          <h1 className="text-2xl font-bold mb-1">{t('title')}</h1>
          <p className="text-sm text-gray-500">
            {incidentFrom && incidentTo
              ? `${incidentFrom} ${t('to')} ${incidentTo}`
              : incidentTo
              ? `${t('upTo')} ${incidentTo}`
              : ''}
          </p>
        </div>

        {/* Results */}
        {hasLoaded && (
          <div ref={printRef} className="space-y-6 print:space-y-4">
            {grouped.size === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm print:hidden">
                {t('noStudentsMatchingFilters')}
              </div>
            ) : (
              Array.from(grouped.entries()).map(([studentId, studentReferrals]) => {
                const first = studentReferrals[0];
                const name = studentFullName(first);
                const studentNum = first.students?.student_number;
                const gradeLevel = first.students?.grade_level;

                return (
                  <Card key={studentId} className="print:shadow-none print:border">
                    {/* Student header */}
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-3 flex-wrap">
                        <CardTitle className="text-base">{name}</CardTitle>
                        {studentNum && (
                          <Badge variant="secondary" className="font-normal">
                            #{studentNum}
                          </Badge>
                        )}
                        {gradeLevel && (
                          <Badge variant="outline" className="font-normal">
                            {gradeLevel}
                          </Badge>
                        )}
                        <span className="ml-auto text-sm text-muted-foreground">
                          {t('referralsCount', { count: studentReferrals.length })}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              {includeColumns.entry_date && <TableHead>{t('incidentDate')}</TableHead>}
                              {includeColumns.reporter && <TableHead>{t('reporter')}</TableHead>}
                              {activeFields.map((f) => (
                                <TableHead key={f.id}>{f.name}</TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {studentReferrals
                              .sort(
                                (a, b) =>
                                  new Date(b.incident_date).getTime() -
                                  new Date(a.incident_date).getTime()
                              )
                              .map((r) => (
                                <TableRow key={r.id}>
                                  {includeColumns.entry_date && (
                                    <TableCell className="text-sm">
                                      {new Date(r.incident_date).toLocaleDateString()}
                                    </TableCell>
                                  )}
                                  {includeColumns.reporter && (
                                    <TableCell className="text-sm text-muted-foreground">
                                      {r.reporter?.full_name ?? '-'}
                                    </TableCell>
                                  )}
                                  {activeFields.map((f) => (
                                    <TableCell key={f.id} className="text-sm max-w-[200px]">
                                      {formatFieldValue(r.field_values?.[f.id])}
                                    </TableCell>
                                  ))}
                                </TableRow>
                              ))}
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
                {t('referralsAcrossStudents', { referrals: filtered.length, students: grouped.size })}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
