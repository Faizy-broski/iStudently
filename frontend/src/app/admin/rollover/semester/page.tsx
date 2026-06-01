'use client';

import { useEffect, useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Calendar,
  Users,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ArrowRight,
  Info,
  RotateCcw,
} from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useTranslations } from 'next-intl';
import { useCampus } from '@/context/CampusContext';
import { getAcademicYears, type AcademicYear } from '@/lib/api/academics';
import { getMarkingPeriods, type MarkingPeriod } from '@/lib/api/marking-periods';
import {
  previewSemesterRollover,
  executeSemesterRollover,
  type SemesterRolloverPreview,
  type SemesterRolloverResult,
} from '@/lib/api/rollover';

// ---------------------------------------------------------------------------
// Status badge colours
// ---------------------------------------------------------------------------
const STATUS_COLORS: Record<string, string> = {
  pending:     'bg-yellow-100 text-yellow-800',
  promoted:    'bg-blue-100 text-blue-800',
  retained:    'bg-gray-100 text-gray-700',
  dropped:     'bg-red-100 text-red-800',
  graduated:   'bg-green-100 text-green-800',
  transferred: 'bg-purple-100 text-purple-800',
};

// ---------------------------------------------------------------------------
/** Find the academic year whose date range best overlaps the FY marking period */
function matchAcademicYear(fy: MarkingPeriod, years: AcademicYear[]): AcademicYear | undefined {
  if (!fy.start_date || !fy.end_date) return undefined;
  const fyStart = new Date(fy.start_date).getTime();
  const fyEnd   = new Date(fy.end_date).getTime();
  // Prefer exact start_date match, then any overlap
  return (
    years.find((y) => new Date(y.start_date).getTime() === fyStart) ??
    years.find((y) => {
      const yStart = new Date(y.start_date).getTime();
      const yEnd   = new Date(y.end_date).getTime();
      return yStart < fyEnd && yEnd > fyStart; // overlap
    })
  );
}

// ---------------------------------------------------------------------------
export default function SemesterRolloverPage() {
  const { user } = useAuth();
  const t = useTranslations("school.semester_rollover");
  const tCommon = useTranslations("common");
  const campusCtx = useCampus();
  const campusId = campusCtx?.selectedCampus?.id;
  // Use parent_school_id when a campus is selected; fall back to user.school_id
  const schoolId = campusCtx?.selectedCampus?.parent_school_id ?? user?.school_id;

  // Raw data
  const [allMPs, setAllMPs]     = useState<MarkingPeriod[]>([]);
  const [allYears, setAllYears] = useState<AcademicYear[]>([]);
  const [loading, setLoading]   = useState(true);

  // Selections
  const [selectedFYId, setSelectedFYId]         = useState('');
  const [selectedSemesterId, setSelectedSemesterId] = useState('');
  const [semesterEndDate, setSemesterEndDate]    = useState('');

  // Async states
  const [previewing, setPreviewing] = useState(false);
  const [executing, setExecuting]   = useState(false);

  // Results
  const [preview, setPreview]   = useState<SemesterRolloverPreview | null>(null);
  const [result, setResult]     = useState<SemesterRolloverResult | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  // ---------------------------------------------------------------------------
  // Derived data from marking periods
  // ---------------------------------------------------------------------------
  const fyYears: MarkingPeriod[] = useMemo(
    () => [...allMPs.filter((mp) => mp.mp_type === 'FY')]
            .sort((a, b) => (a.start_date ?? '').localeCompare(b.start_date ?? '')),
    [allMPs]
  );

  const semestersForYear: MarkingPeriod[] = useMemo(
    () => allMPs
            .filter((mp) => mp.mp_type === 'SEM' && mp.parent_id === selectedFYId)
            .sort((a, b) => a.sort_order - b.sort_order),
    [allMPs, selectedFYId]
  );

  // The academic_year record that corresponds to the selected FY
  const matchedYear: AcademicYear | undefined = useMemo(() => {
    const fy = fyYears.find((f) => f.id === selectedFYId);
    if (!fy) return undefined;
    return matchAcademicYear(fy, allYears);
  }, [fyYears, selectedFYId, allYears]);

  // Selected semester MP object
  const selectedSemester: MarkingPeriod | undefined = useMemo(
    () => semestersForYear.find((s) => s.id === selectedSemesterId),
    [semestersForYear, selectedSemesterId]
  );

  // Sync end date when semester changes
  useEffect(() => {
    if (selectedSemester?.end_date) {
      setSemesterEndDate(selectedSemester.end_date);
    }
  }, [selectedSemesterId, selectedSemester]);

  // ---------------------------------------------------------------------------
  // Initial load
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (user) init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  async function init() {
    setLoading(true);
    try {
      const [mps, years] = await Promise.all([
        getMarkingPeriods(campusId),
        getAcademicYears(),
      ]);
      const sortedYears = [...years].sort(
        (a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
      );
      setAllMPs(mps);
      setAllYears(sortedYears);

      // Auto-select: prefer FY that matches the current academic year
      const currentYear = sortedYears.find((y) => y.is_current) ?? sortedYears[sortedYears.length - 1];
      const fyList = mps
        .filter((mp) => mp.mp_type === 'FY')
        .sort((a, b) => (a.start_date ?? '').localeCompare(b.start_date ?? ''));

      const autoFY = currentYear
        ? fyList.find((fy) => fy.start_date && new Date(fy.start_date).getTime() === new Date(currentYear.start_date).getTime())
          ?? fyList.find((fy) => {
            if (!fy.start_date || !fy.end_date) return false;
            return new Date(fy.start_date) < new Date(currentYear.end_date)
                && new Date(fy.end_date)   > new Date(currentYear.start_date);
          })
        : fyList[fyList.length - 1];

      if (autoFY) {
        setSelectedFYId(autoFY.id);
        const matched = matchAcademicYear(autoFY, sortedYears);
        if (matched) await loadPreview(matched.id);
      }
    } catch {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Load preview
  // ---------------------------------------------------------------------------
  async function loadPreview(academicYearId: string) {
    if (!schoolId || !academicYearId) return;
    setPreviewing(true);
    setPreview(null);
    setSelectedSemesterId('');
    setSemesterEndDate('');
    try {
      const data = await previewSemesterRollover(academicYearId, schoolId, campusId);
      setPreview(data);
    } catch {
      toast.error(t("rollover_failed"));
    } finally {
      setPreviewing(false);
    }
  }

  // Called when user picks a different FY year
  async function handleYearChange(fyId: string) {
    setSelectedFYId(fyId);
    setSelectedSemesterId('');
    setSemesterEndDate('');
    setResult(null);
    setPreview(null);

    const fy = allMPs.find((mp) => mp.id === fyId);
    if (!fy) return;
    const matched = matchAcademicYear(fy, allYears);
    if (matched) {
      await loadPreview(matched.id);
    } else {
      toast.warning('No matching academic year found for this period. Student preview unavailable.');
    }
  }

  // ---------------------------------------------------------------------------
  // Execute rollover
  // ---------------------------------------------------------------------------
  async function handleExecute() {
    if (!schoolId) {
      toast.error('School not found. Please reload.');
      return;
    }
    if (!matchedYear) {
      toast.error('No matching academic year for this period.');
      return;
    }
    if (!semesterEndDate) {
      toast.error('Please set a semester end date.');
      return;
    }
    setExecuting(true);
    setShowConfirm(false);
    try {
      const res = await executeSemesterRollover({
        academic_year_id: matchedYear.id,
        semester_end_date: semesterEndDate,
        school_id: schoolId,
        campus_id: campusId,
      });
      setResult(res);
      if (res.success) {
        toast.success(t("rollover_complete"));
        if (matchedYear) await loadPreview(matchedYear.id);
      } else {
        toast.error(t("rollover_failed"));
      }
    } catch (e: any) {
      toast.error(e?.message || t("rollover_failed"));
    } finally {
      setExecuting(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="container mx-auto py-8 flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const students = preview?.students;
  const totalActive = students?.total_active ?? 0;
  const canExecute = !!matchedYear && !!semesterEndDate && !executing;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="container mx-auto py-8">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold">{t("title")}</h1>
            <p className="text-muted-foreground mt-1">
              {t("subtitle")}
            </p>
          </div>
          <Link href="/admin/rollover">
            <Button variant="outline" size="sm">
              <ArrowRight className="h-4 w-4 mr-2 rotate-180" />
              {t("btn_year_end_rollover")}
            </Button>
          </Link>
        </div>

        {/* How it works */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>{t("how_it_works_title")}</AlertTitle>
          <AlertDescription className="text-sm space-y-1 mt-1">
            <p>{t("how_it_works_desc")}</p>
            <ul className="list-disc list-inside space-y-0.5 text-muted-foreground mt-1">
              <li>{t("item_pending_promoted")}</li>
              <li>{t("item_retained")}</li>
              <li>{t("item_dropped")}</li>
            </ul>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("how_it_works_footer")}
            </p>
          </AlertDescription>
        </Alert>

        {/* No FY periods warning */}
        {fyYears.length === 0 && (
          <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-500" />
            <span>
              No Full Year (FY) marking periods found. Create them in{' '}
              <Link href="/admin/marking-periods" className="underline font-medium">Marking Periods</Link>{' '}
              first.
            </span>
          </div>
        )}

        {/* Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              {t("config_title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

              {/* Academic year (FY marking periods) */}
              <div className="space-y-1.5">
                <Label>{t("label_academic_year")}</Label>
                <Select
                  value={selectedFYId}
                  onValueChange={handleYearChange}
                  disabled={previewing || fyYears.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select year" />
                  </SelectTrigger>
                  <SelectContent>
                    {fyYears.map((fy) => (
                      <SelectItem key={fy.id} value={fy.id}>
                        {fy.title}
                        {matchAcademicYear(fy, allYears)?.is_current ? ' (Current)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedFYId && !matchedYear && (
                  <p className="text-xs text-amber-600">
                    No matching academic year — student preview unavailable.
                  </p>
                )}
              </div>

              {/* Semester selector (children of selected FY) */}
              <div className="space-y-1.5">
                <Label>{t("label_semester")}</Label>
                <Select
                  value={selectedSemesterId}
                  disabled={previewing || !selectedFYId}
                  onValueChange={setSelectedSemesterId}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        !selectedFYId
                          ? 'Select a year first'
                          : previewing
                          ? t("placeholder_loading")
                          : semestersForYear.length === 0
                          ? 'No semesters — enter end date manually'
                          : t("placeholder_select_semester")
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {semestersForYear.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.title}
                      </SelectItem>
                    ))}
                    {semestersForYear.length === 0 && selectedFYId && (
                      <div className="px-3 py-4 text-xs text-muted-foreground text-center">
                        No SEM periods under this year.
                        <br />
                        Create them in{' '}
                        <strong>Marking Periods</strong> first,
                        or enter the end date manually.
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* End date */}
              <div className="space-y-1.5">
                <Label>{t("label_end_date")}</Label>
                <Input
                  type="date"
                  value={semesterEndDate}
                  onChange={(e) => setSemesterEndDate(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {t("end_date_desc")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Preview loading */}
        {previewing && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("loading_preview")}
          </div>
        )}

        {/* Preview results */}
        {preview && !previewing && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                {t("preview_title")}
                <span className="ml-auto text-sm font-normal text-muted-foreground">
                  {t("active_students", { count: totalActive })}
                </span>
              </CardTitle>
              <CardDescription>
                {t("preview_desc")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {totalActive === 0 ? (
                <p className="text-muted-foreground text-sm">
                  {t("no_enrollments", { campusId: !!campusId })}
                </p>
              ) : (
                <div className="divide-y">
                  {(
                    [
                      'pending',
                      'promoted',
                      'retained',
                      'dropped',
                      'graduated',
                      'transferred',
                    ] as const
                  ).map((status) => {
                    const count = students?.[status] ?? 0;
                    if (count === 0) return null;
                    return (
                      <div key={status} className="flex items-center justify-between py-3 text-sm">
                        <div className="flex items-center gap-3">
                          <Badge className={STATUS_COLORS[status]} variant="outline">
                            {tCommon(status) || status}
                          </Badge>
                          <span className="text-muted-foreground">{t(`action_${status}`)}</span>
                        </div>
                        <span className="font-semibold tabular-nums">{count}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Result */}
        {result?.success && (
          <Card className="border-green-200 bg-green-50">
            <CardHeader>
              <CardTitle className="text-green-900 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5" />
                {t("rollover_complete")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-sm">
                {(['promoted', 'retained', 'dropped', 'graduated', 'transferred'] as const).map(
                  (key) => (
                    <div key={key} className="text-center">
                      <p className="text-2xl font-bold text-green-900">{result[key]}</p>
                      <p className="text-green-700 capitalize">{tCommon(key) || key}</p>
                    </div>
                  )
                )}
              </div>
              <p className="text-xs text-green-700 mt-4 text-center">
                {t("total_processed", { count: result.total })}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => matchedYear && loadPreview(matchedYear.id)}
            disabled={!matchedYear || previewing || executing}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            {t("btn_refresh_preview")}
          </Button>
          <Button
            onClick={() => setShowConfirm(true)}
            disabled={!canExecute || previewing}
          >
            {executing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t("btn_running")}
              </>
            ) : (
              <>
                <TrendingUp className="h-4 w-4 mr-2" />
                {t("btn_execute")}
              </>
            )}
          </Button>
        </div>

        {/* Confirmation dialog */}
        <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
          <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
            <div className="border-b bg-muted/50 px-6 py-3">
              <DialogTitle className="text-center uppercase tracking-widest text-sm font-semibold">
                {t("confirm_title")}
              </DialogTitle>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="flex flex-col items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-teal-600 text-teal-600 text-2xl font-bold">
                  ?
                </div>
                <p className="text-center font-semibold text-sm">
                  {t("confirm_question")}
                </p>
                <p className="text-center text-xs text-muted-foreground">
                  {t("semester_end_date_confirm", { date: semesterEndDate })}
                  {selectedSemester && (
                    <> ({selectedSemester.title})</>
                  )}
                </p>
              </div>

              <div className="border-l-4 border-yellow-500 bg-yellow-50 px-4 py-3 text-sm">
                <p className="font-semibold flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4" /> {t("warning_title")}
                </p>
                <ul className="list-disc list-inside text-xs text-muted-foreground mt-1 space-y-0.5">
                  <li>{t("warning_item_1")}</li>
                  <li>{t("warning_item_2")}</li>
                  <li>{t("warning_item_3")}</li>
                  <li>{t("warning_item_4")}</li>
                </ul>
              </div>
            </div>

            <div className="border-t px-6 py-4 flex justify-center gap-3">
              <Button
                onClick={handleExecute}
                disabled={executing}
                variant="outline"
                className="min-w-20 font-semibold"
              >
                {executing ? <Loader2 className="h-4 w-4 animate-spin" /> : (tCommon("btn_ok") || "OK")}
              </Button>
              <Button
                onClick={() => setShowConfirm(false)}
                className="min-w-20 font-semibold bg-teal-700 hover:bg-teal-800 text-white"
              >
                {tCommon("btn_cancel") || "CANCEL"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

      </div>
    </div>
  );
}
