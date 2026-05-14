'use client';

import { useEffect, useState } from 'react';
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
import {
  previewSemesterRollover,
  executeSemesterRollover,
  type SemesterRolloverPreview,
  type SemesterRolloverResult,
  type SemesterInfo,
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

// What will happen to each status during semester rollover
const STATUS_ACTION: Record<string, string> = {
  pending:     'promoted to next grade (or graduated if no next grade)',
  promoted:    'promoted to next grade (or graduated if no next grade)',
  retained:    'no change — stays in same grade',
  dropped:     'enrollment closed at semester end date',
  graduated:   'enrollment closed at semester end date',
  transferred: 'enrollment closed at semester end date',
};

// ---------------------------------------------------------------------------
export default function SemesterRolloverPage() {
  const { user } = useAuth();
  const t = useTranslations("school.semester_rollover");
  const tCommon = useTranslations("common");
  const campusCtx = useCampus();
  const campusId = campusCtx?.selectedCampus?.id;

  const [allYears, setAllYears] = useState<AcademicYear[]>([]);
  const [selectedYearId, setSelectedYearId] = useState('');
  const [loading, setLoading] = useState(true);
  const [previewing, setPreviewing] = useState(false);
  const [executing, setExecuting] = useState(false);

  const [preview, setPreview] = useState<SemesterRolloverPreview | null>(null);
  const [selectedSemesterId, setSelectedSemesterId] = useState('');
  const [semesterEndDate, setSemesterEndDate] = useState('');
  const [result, setResult] = useState<SemesterRolloverResult | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  // Derived: selected semester object
  const selectedSemester: SemesterInfo | undefined =
    preview?.semesters.find((s) => s.id === selectedSemesterId);

  // Sync end date when semester is selected
  useEffect(() => {
    if (selectedSemester) {
      setSemesterEndDate(selectedSemester.end_date);
    }
  }, [selectedSemesterId, selectedSemester]);

  useEffect(() => {
    if (user) fetchYears();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  async function fetchYears() {
    setLoading(true);
    try {
      const years = await getAcademicYears();
      const sorted = [...years].sort(
        (a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
      );
      setAllYears(sorted);
      const current = sorted.find((y) => y.is_current);
      if (current) {
        setSelectedYearId(current.id);
        await loadPreview(current.id);
      }
    } catch {
      toast.error(tCommon("err_load_years") || 'Failed to load academic years');
    } finally {
      setLoading(false);
    }
  }

  async function loadPreview(yearId: string) {
    if (!user?.school_id || !yearId) return;
    setPreviewing(true);
    setPreview(null);
    setSelectedSemesterId('');
    setSemesterEndDate('');
    try {
      const data = await previewSemesterRollover(yearId, user.school_id, campusId);
      setPreview(data);
      // Auto-select first semester
      if (data.semesters.length > 0) {
        setSelectedSemesterId(data.semesters[0].id);
      }
    } catch {
      toast.error(t("rollover_failed"));
    } finally {
      setPreviewing(false);
    }
  }

  async function handleExecute() {
    if (!user?.school_id || !selectedYearId || !semesterEndDate) return;
    setExecuting(true);
    setShowConfirm(false);
    try {
      const res = await executeSemesterRollover({
        academic_year_id: selectedYearId,
        semester_end_date: semesterEndDate,
        school_id: user.school_id,
        campus_id: campusId,
      });
      setResult(res);
      if (res.success) {
        toast.success(t("rollover_complete"));
        await loadPreview(selectedYearId);
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
  const canExecute = !!selectedYearId && !!semesterEndDate && totalActive > 0 && !executing;

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
            <p>
              {t("how_it_works_desc")}
            </p>
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
              {/* Academic year */}
              <div className="space-y-1.5">
                <Label>{t("label_academic_year")}</Label>
                <Select
                  value={selectedYearId}
                  onValueChange={(id) => {
                    setSelectedYearId(id);
                    setResult(null);
                    loadPreview(id);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={tCommon("placeholder_select_year") || "Select year"} />
                  </SelectTrigger>
                  <SelectContent>
                    {allYears.map((y) => (
                      <SelectItem key={y.id} value={y.id}>
                        {y.name}{y.is_current ? ` (${tCommon("current") || 'current'})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Semester selector */}
              <div className="space-y-1.5">
                <Label>{t("label_semester")}</Label>
                <Select
                  value={selectedSemesterId}
                  disabled={!preview || preview.semesters.length === 0}
                  onValueChange={setSelectedSemesterId}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        previewing
                          ? t("placeholder_loading")
                          : preview?.semesters.length === 0
                          ? t("placeholder_no_semesters")
                          : t("placeholder_select_semester")
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {(preview?.semesters ?? []).map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {preview?.semesters.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    {t("no_marking_periods_desc")}
                  </p>
                )}
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

        {/* Preview */}
        {previewing && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("loading_preview")}
          </div>
        )}

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
            onClick={() => loadPreview(selectedYearId)}
            disabled={!selectedYearId || previewing || executing}
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
                variant="outline"
                className="min-w-20 font-semibold"
              >
                {tCommon("btn_ok") || "OK"}
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
