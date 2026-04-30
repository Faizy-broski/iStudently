'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import {Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from 'sonner';
import {
  Calendar,
  Users,
  UserCheck,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ArrowRight,
  Info,
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/context/AuthContext';
import { useTranslations } from 'next-intl';
import {
  previewRollover,
  executeRollover,
  checkRolloverPrerequisites,
  type RolloverPreview,
  type RolloverResult,
  type RolloverPrerequisiteCheck,
} from '@/lib/api/rollover';
import { getAcademicYears, type AcademicYear } from '@/lib/api/academics';

// ---------------------------------------------------------------------------
// Rollover item definitions (mirrors RosarioSIS checklist)
// ---------------------------------------------------------------------------
type RolloverItemDef = {
  key: string;
  label: string;
  indent?: boolean;       // sub-item (indented)
  info?: string;          // tooltip text for ℹ icon
  defaultOn?: boolean;    // initial checked state
  existingCount: (preview: RolloverPreview | null) => number;
};

// Rollover item definitions are now localized inside the component

// Keys that the backend actually processes today
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const BACKEND_SUPPORTED_KEYS = ['students', 'marking_periods', 'courses', 'course_periods'] as const;

// ---------------------------------------------------------------------------
// RolloverItemList – togglable checklist (RosarioSIS style)
// ---------------------------------------------------------------------------
type LocalRolloverOptions = Record<string, boolean>;

function RolloverItemList({
  preview,
  options,
  setOptions,
  items,
}: {
  preview: RolloverPreview | null;
  options: LocalRolloverOptions;
  setOptions: React.Dispatch<React.SetStateAction<LocalRolloverOptions>>;
  items: RolloverItemDef[];
}) {
  return (
    <div className="border rounded text-sm">
      {items.map((item, idx) => {
        const hasExisting = item.existingCount(preview) > 0;
        const enabled = !!options[item.key];
        return (
          <button
            key={item.key}
            type="button"
            className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-muted/40 ${
              idx > 0 ? 'border-t' : ''
            } ${hasExisting && enabled ? 'text-muted-foreground' : ''}`}
            onClick={() => setOptions((o) => ({ ...o, [item.key]: !enabled }))}
          >
            {/* Indentation for sub-items */}
            {item.indent && <span className="ml-4 text-muted-foreground text-xs select-none">↳</span>}
            {/* Checkbox – teal square, matching RosarioSIS */}
            <span
              className={`inline-flex h-4 w-4 items-center justify-center border-2 rounded-sm text-xs shrink-0 ${
                enabled
                  ? hasExisting
                    ? 'border-teal-600 bg-teal-600 text-white'
                    : 'border-teal-600 bg-teal-600 text-white'
                  : 'border-gray-400 bg-white dark:bg-background'
              }`}
            >
              {enabled && '✓'}
            </span>
            <span className={hasExisting && enabled ? 'text-muted-foreground' : ''}>
              {item.label}
            </span>
            {item.info && (
              <span className="text-orange-500 cursor-help" title={item.info}>
                <Info className="h-3.5 w-3.5" />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------

export default function RolloverPage() {
  const { user } = useAuth();
  const t = useTranslations("school.rollover");
  const tCommon = useTranslations("common");

  const ROLLOVER_ITEMS: RolloverItemDef[] = [
    { key: 'schools',                 label: t("rollover_items.schools"),                    defaultOn: false, existingCount: () => 0 },
    { key: 'users',                   label: t("rollover_items.users"),                      defaultOn: false, existingCount: () => 0 },
    { key: 'school_periods',          label: t("rollover_items.school_periods"),             defaultOn: true,  existingCount: () => 0 },
    { key: 'marking_periods',         label: t("rollover_items.marking_periods"),            defaultOn: true,  existingCount: (p) => p?.marking_periods?.next_year_existing ?? 0 },
    { key: 'calendars',               label: t("rollover_items.calendars"),                  defaultOn: true,  existingCount: () => 0 },
    { key: 'grading_scales',          label: t("rollover_items.grading_scales"),             defaultOn: true,  existingCount: () => 0 },
    { key: 'attendance_codes',        label: t("rollover_items.attendance_codes"),           defaultOn: true,  existingCount: () => 0 },
    { key: 'courses',                 label: t("rollover_items.courses"),        info: t("rollover_items.courses_info"), defaultOn: true,  existingCount: () => 0 },
    { key: 'course_periods',          label: t("rollover_items.course_periods"), indent: true, defaultOn: true,  existingCount: () => 0 },
    { key: 'enrollment_codes',        label: t("rollover_items.enrollment_codes"),   defaultOn: true,  existingCount: () => 0 },
    { key: 'students',                label: t("rollover_items.students"),      info: t("rollover_items.students_info"), defaultOn: true,  existingCount: () => 0 },
    { key: 'report_card_comments',    label: t("rollover_items.report_card_comments"), info: t("rollover_items.report_card_comments_info"), defaultOn: true,  existingCount: () => 0 },
    { key: 'school_configuration',    label: t("rollover_items.school_configuration"),       defaultOn: true,  existingCount: () => 0 },
    { key: 'eligibility_activities',  label: t("rollover_items.eligibility_activities"),     defaultOn: true,  existingCount: () => 0 },
    { key: 'food_service',            label: t("rollover_items.food_service"), defaultOn: true, existingCount: () => 0 },
    { key: 'referral_form',           label: t("rollover_items.referral_form"),              defaultOn: true,  existingCount: () => 0 },
  ];

  const [currentYear, setCurrentYear] = useState<AcademicYear | null>(null);
  const [nextYear, setNextYear] = useState<AcademicYear | null>(null);
  const [allYears, setAllYears] = useState<AcademicYear[]>([]);
  const [preview, setPreview] = useState<RolloverPreview | null>(null);
  const [prerequisiteCheck, setPrerequisiteCheck] = useState<RolloverPrerequisiteCheck | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewing, setPreviewing] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<RolloverResult | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  
  // Rollover options
  const [options, setOptions] = useState<LocalRolloverOptions>(() => {
    const initial: LocalRolloverOptions = {};
    ROLLOVER_ITEMS.forEach((item) => {
      initial[item.key] = item.defaultOn !== false;
    });
    return initial;
  });

  useEffect(() => {
    if (user) fetchAcademicYears();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  async function fetchAcademicYears() {
    try {
      setLoading(true);

      const data = await getAcademicYears();
      const sortedYears = [...data].sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());
      setAllYears(sortedYears);

      // Find current and next year
      const current = sortedYears.find((y) => y.is_current);
      // Prefer explicit is_next flag, fall back to chronological next after current
      const explicit = sortedYears.find((y) => y.is_next);
      const currentIndex = sortedYears.findIndex((y) => y.is_current);
      const chronoNext = currentIndex >= 0 && currentIndex < sortedYears.length - 1 ? sortedYears[currentIndex + 1] : null;
      const next = explicit || chronoNext;

      setCurrentYear(current || null);
      setNextYear(next || null);

      // Auto-fetch preview and prerequisites if both years exist
      if (current && next) {
        await loadPreviewAndCheck(current.id, next.id);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : tCommon("error");
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  async function loadPreviewAndCheck(currentYearId: string, nextYearId: string) {
    if (!user) return;
    try {
      setPreviewing(true);
      
      // Check prerequisites
      const checkResult = await checkRolloverPrerequisites(currentYearId, nextYearId, user.school_id);
      setPrerequisiteCheck(checkResult);

      // Load preview
      const previewData = await previewRollover(currentYearId, nextYearId, user.school_id);
      setPreview(previewData);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : tCommon("error");
      toast.error(message);
    } finally {
      setPreviewing(false);
    }
  }

  async function handleExecuteRollover() {
    if (!currentYear || !nextYear || !prerequisiteCheck?.is_valid) return;

    try {
      setExecuting(true);
      setShowConfirmDialog(false);

      // Only send backend-supported options
      const backendOptions = {
        students: !!options.students,
        marking_periods: !!options.marking_periods,
        teachers: !!options.courses, // courses toggle drives teacher assignments
      };

      const result = await executeRollover({
        current_year_id: currentYear.id,
        next_year_id: nextYear.id,
        school_id: user?.school_id ?? '',
        options: backendOptions,
      });

      setResult(result);

      if (result.success) {
        toast.success(t("rollover_complete"));
        // Reload preview to show updated data
        await loadPreviewAndCheck(currentYear.id, nextYear.id);
      } else {
        toast.error(result.error || tCommon("error"));
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : tCommon("error");
      toast.error(message);
    } finally {
      setExecuting(false);
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!currentYear || !nextYear) {
    return (
      <div className="container mx-auto py-8">
        <div className="max-w-2xl mx-auto space-y-4">
          <div>
            <h1 className="text-3xl font-bold">{t("title")}</h1>
            <p className="text-muted-foreground mt-1">{t("subtitle")}</p>
          </div>

          {allYears.length >= 2 ? (
            // Years exist but none is marked current — let admin pick manually
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="h-5 w-5 text-blue-500" />
                  {t("select_academic_years")}
                </CardTitle>
                <CardDescription>
                  {t("no_current_year_desc")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t("label_roll_from")}</Label>
                    <Select
                      value={currentYear?.id ?? ''}
                      onValueChange={(id) => {
                        const yr = allYears.find(y => y.id === id) ?? null;
                        setCurrentYear(yr);
                        setNextYear(null);
                        setPreview(null);
                        setPrerequisiteCheck(null);
                      }}
                    >
                      <SelectTrigger><SelectValue placeholder={tCommon("placeholder_select_year") || "Select year"} /></SelectTrigger>
                      <SelectContent>
                        {allYears.map(y => (
                          <SelectItem key={y.id} value={y.id}>{y.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t("label_roll_to_select")}</Label>
                    <Select
                      value={nextYear?.id ?? ''}
                      disabled={!currentYear}
                      onValueChange={(id) => {
                        const yr = allYears.find(y => y.id === id) ?? null;
                        setNextYear(yr);
                        setPreview(null);
                        setPrerequisiteCheck(null);
                        if (currentYear && yr) loadPreviewAndCheck(currentYear.id, yr.id);
                      }}
                    >
                      <SelectTrigger><SelectValue placeholder={tCommon("placeholder_select_year") || "Select year"} /></SelectTrigger>
                      <SelectContent>
                        {allYears
                          .filter(y => currentYear ? new Date(y.start_date) > new Date(currentYear.start_date) : true)
                          .map(y => (
                            <SelectItem key={y.id} value={y.id}>{y.name}</SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button variant="outline" onClick={() => window.location.href = '/admin/settings/academic-years'}>
                  Go to Academic Years Settings
                </Button>
              </CardContent>
            </Card>
          ) : (
            // No years at all or only one
            <>
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Rollover Not Available</AlertTitle>
                <AlertDescription className="space-y-2">
                  {allYears.length === 0 && <p>No academic years found for your school.</p>}
                  {allYears.length === 1 && (
                    <p>Only one academic year exists (<strong>{allYears[0].name}</strong>). Create a next academic year first.</p>
                  )}
                  {allYears.length > 1 && !currentYear && (
                    <p>No academic year is marked as current. Go to <strong>Settings → Academic Years</strong> and mark one as current.</p>
                  )}
                  {allYears.length > 1 && currentYear && !nextYear && (
                    <p>No next academic year found after <strong>{currentYear.name}</strong>. Create the next year first.</p>
                  )}
                </AlertDescription>
              </Alert>
              <Button variant="outline" onClick={() => window.location.href = '/admin/settings/academic-years'}>
                Go to Academic Years Settings
              </Button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold">{t("title")}</h1>
            <p className="text-muted-foreground mt-1">
              {t("subtitle_transition", { current: currentYear.name, next: nextYear.name })}
            </p>
          </div>
          <Link href="/admin/rollover/semester">
            <Button variant="outline" size="sm">
              {t("btn_semester_rollover")}
            </Button>
          </Link>
        </div>

        {/* Prerequisites Check */}
        {prerequisiteCheck && (
          <Alert variant={prerequisiteCheck.is_valid ? 'default' : 'destructive'}>
            {prerequisiteCheck.is_valid ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <AlertTriangle className="h-4 w-4" />
            )}
            <AlertTitle>
              {prerequisiteCheck.is_valid ? t("status_ready") : t("status_not_met")}
            </AlertTitle>
            <AlertDescription>{prerequisiteCheck.error_message || t("all_checks_passed")}</AlertDescription>
          </Alert>
        )}

        {/* Year Transition Visual */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center gap-8">
              <div className="text-center">
                <div className="text-sm font-medium text-muted-foreground mb-2">{t("label_current_year")}</div>
                <div className="px-6 py-3 bg-blue-100 text-blue-700 rounded-lg font-semibold text-lg">
                  {currentYear.name}
                </div>
                <div className="text-xs text-muted-foreground mt-2">
                  {new Date(currentYear.start_date).toLocaleDateString()} -{' '}
                  {new Date(currentYear.end_date).toLocaleDateString()}
                </div>
              </div>

              <ArrowRight className="h-8 w-8 text-muted-foreground" />

              <div className="text-center">
                <div className="text-sm font-medium text-muted-foreground mb-2">{t("label_roll_to")}</div>
                <div className="px-6 py-3 bg-green-100 text-green-700 rounded-lg font-semibold text-lg">
                  {nextYear.name}
                </div>
                <div className="text-xs text-muted-foreground mt-2">
                  {new Date(nextYear.start_date).toLocaleDateString()} -{' '}
                  {new Date(nextYear.end_date).toLocaleDateString()}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Preview Data */}
        {preview && (
          <div className="grid gap-4 md:grid-cols-2">
            {/* Students Card */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t("card_students")}</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{preview.students.total_active}</div>
                <p className="text-xs text-muted-foreground">{t("active_students_desc")}</p>
                <div className="mt-4 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("graduating")}:</span>
                    <span className="font-medium">{preview.students.graduating}</span>
                  </div>
                  {Object.entries(preview.students.by_status || {}).map(([status, count]) => (
                    <div key={status} className="flex justify-between">
                      <span className="text-muted-foreground capitalize">{status}:</span>
                      <span className="font-medium">{String(count)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Marking Periods Card */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t("card_marking_periods")}</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{preview.marking_periods.current_year_total}</div>
                <p className="text-xs text-muted-foreground">{t("to_be_rolled_over")}</p>
                {preview.marking_periods.next_year_existing > 0 && (
                  <Alert variant="destructive" className="mt-4">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      {t("marking_periods_exist_warning", { count: preview.marking_periods.next_year_existing, nextYear: nextYear.name })}
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* Teachers Card */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t("card_teacher_assignments")}</CardTitle>
                <UserCheck className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{preview.teachers.current_assignments}</div>
                <p className="text-xs text-muted-foreground">{t("teacher_subject_assignments")}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  <span className="inline mr-1"><Info className="h-3 w-3" /></span>
                  {t("section_assignments_cleared")}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Rollover Items Summary */}
        <Card>
          <CardHeader>
            <CardTitle>{t("card_data_to_roll")}</CardTitle>
            <CardDescription>
              {t("data_to_roll_desc", { current: currentYear.name, next: nextYear.name })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RolloverItemList preview={preview} options={options} setOptions={setOptions} items={ROLLOVER_ITEMS} />
          </CardContent>
        </Card>

        {/* Result Display */}
        {result && result.success && (
          <Card className="border-green-200 bg-green-50">
            <CardHeader>
              <CardTitle className="text-green-900">{t("rollover_complete")}</CardTitle>
              <CardDescription className="text-green-700">
                {t("completed_in", { ms: result.duration_ms })}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {result.students && (
                <div>
                  <h4 className="font-semibold text-green-900 mb-2">{t("card_students")}</h4>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-green-700">{t("promoted")}:</span>
                      <span className="font-bold ml-2">{result.students.promoted}</span>
                    </div>
                    <div>
                      <span className="text-green-700">{t("retained")}:</span>
                      <span className="font-bold ml-2">{result.students.retained}</span>
                    </div>
                    <div>
                      <span className="text-green-700">{t("graduated")}:</span>
                      <span className="font-bold ml-2">{result.students.graduated}</span>
                    </div>
                  </div>
                </div>
              )}

              {result.marking_periods && (
                <div>
                  <h4 className="font-semibold text-green-900 mb-2">{t("card_marking_periods")}</h4>
                  <div className="text-sm text-green-700">
                    {t("periods_created", { count: result.marking_periods.total })}
                  </div>
                </div>
              )}

              {result.teachers && (
                <div>
                  <h4 className="font-semibold text-green-900 mb-2">{t("card_teacher_assignments")}</h4>
                  <div className="text-sm text-green-700">
                    {t("assignments_rolled", { count: result.teachers.assignments })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-4">
          <Button variant="outline" onClick={() => window.location.reload()} disabled={executing}>
            {t("btn_refresh_preview")}
          </Button>
          <Button
            onClick={() => setShowConfirmDialog(true)}
            disabled={!prerequisiteCheck?.is_valid || executing || previewing}
          >
            {executing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("btn_executing")}
              </>
            ) : (
              <>
                <TrendingUp className="mr-2 h-4 w-4" />
                {t("btn_execute_rollover")}
              </>
            )}
          </Button>
        </div>

        {/* Confirmation Dialog – RosarioSIS style */}
        <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
            {/* Header bar */}
            <div className="border-b bg-muted/50 px-6 py-3">
              <DialogTitle className="text-center uppercase tracking-widest text-sm font-semibold">
                {t("confirm_title")}
              </DialogTitle>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Question mark icon + question */}
              <div className="flex flex-col items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-teal-600 text-teal-600 text-2xl font-bold">
                  ?
                </div>
                <p className="text-center font-semibold text-sm">
                  {t("confirm_question", { current: currentYear.name })}
                </p>
              </div>

              {/* Checklist – full RosarioSIS item list */}
              <div className="border rounded text-sm max-h-[340px] overflow-y-auto">
                {ROLLOVER_ITEMS.map((item, idx) => {
                  const hasExisting = item.existingCount(preview) > 0;
                  const enabled = !!options[item.key];
                  return (
                    <button
                      key={item.key}
                      type="button"
                      className={`w-full flex items-center gap-3 px-5 py-2 text-left transition-colors hover:bg-muted/40 ${
                        idx > 0 ? 'border-t border-muted' : ''
                      } ${hasExisting && enabled ? 'text-muted-foreground' : ''}`}
                      onClick={() => setOptions((o) => ({ ...o, [item.key]: !enabled }))}
                    >
                      {/* Indentation for sub-items */}
                      {item.indent && <span className="ml-3 text-muted-foreground text-xs select-none">↳</span>}
                      {/* Checkbox – teal square */}
                      <span
                        className={`inline-flex h-4 w-4 items-center justify-center border-2 rounded-sm text-[10px] font-bold shrink-0 ${
                          enabled
                            ? 'border-teal-600 bg-teal-600 text-white'
                            : 'border-gray-400 bg-white dark:bg-background'
                        }`}
                      >
                        {enabled && '✓'}
                      </span>
                      <span className={hasExisting && enabled ? 'text-muted-foreground' : ''}>
                        {item.label}
                      </span>
                      {item.info && (
                        <span className="text-orange-500 cursor-help" title={item.info}>
                          <Info className="h-3.5 w-3.5" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Note – green left-border like RosarioSIS */}
              <div className="border-l-4 border-green-600 bg-green-50 dark:bg-green-950/30 px-4 py-3 text-sm space-y-1">
                <p className="font-bold">{t("note_title")}</p>
                <ul className="list-disc list-inside space-y-0.5 text-muted-foreground text-xs">
                  <li>{t("note_greyed_desc")}</li>
                  <li>{t("note_overwrite_desc")}</li>
                </ul>
              </div>
            </div>

            {/* Footer – OK / CANCEL like RosarioSIS */}
            <div className="border-t px-6 py-4 flex justify-center gap-3">
              <Button
                onClick={handleExecuteRollover}
                variant="outline"
                className="min-w-20 font-semibold"
              >
                {tCommon("btn_ok") || "OK"}
              </Button>
              <Button
                onClick={() => setShowConfirmDialog(false)}
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
