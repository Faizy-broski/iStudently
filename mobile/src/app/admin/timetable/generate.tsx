import type { AdminTimetableEntry, RequirementCoverage } from '@studently/api-client';
import { toCsv } from '@studently/shared-utils';
import { router, Stack } from 'expo-router';
import { AlertTriangle, ArrowRight, Ban, CheckCircle2, Clock, Download, PlayCircle, Printer, RefreshCw, RotateCcw, XCircle } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { useConfirm } from '@/components/app/confirm';
import { FilterChips } from '@/components/app/filter-chips';
import { Picker } from '@/components/app/picker';
import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { CheckRow } from '@/features/admin/attendance';
import { usePrintContext } from '@/features/admin/print-context';
import { entryAt, periodTime, periodTitle, sortPeriods, TimetableBuilder, TimetableGrid, TT_DAYS } from '@/features/admin/timetable';
import { useAcademicYear } from '@/features/admin/use-academic-year';
import { useCampus } from '@/features/campus/campus';
import { adminAcademics, adminGenerator, adminPeriods, adminTimetable } from '@/lib/api';
import { useApi } from '@/lib/data';
import { buildPrintHtml, escapeHtml, sharePdf } from '@/lib/print';
import { shareTextFile } from '@/lib/share-file';
import { cn } from '@/lib/utils';

type Step = 'scope' | 'generating' | 'results' | 'review';
interface Preflight {
  kind: 'section' | 'grade';
  id: string;
  name: string;
  gradeName?: string;
  requirementCount: number;
  coverage: RequirementCoverage | null;
}
const FINISHED = ['completed', 'failed', 'cancelled'];

/** Auto-generate timetables: scope + pre-flight, live job, results, review/rollback/export (web: /admin/timetable/generate). */
export default function Generate() {
  const { t } = useTranslation();
  const g = (k: string, o?: Record<string, unknown>) => t(`app.tg_${k}`, o);
  const toast = useToast();
  const confirm = useConfirm();
  const print = usePrintContext();
  const { campusId } = useCampus();
  const years = useAcademicYear();
  const yearId = years.id;
  const [step, setStep] = useState<Step>('scope');
  const [scope, setScope] = useState<'all' | 'sections'>('sections');
  const [secIds, setSecIds] = useState<Set<string>>(new Set());
  const [gradeIds, setGradeIds] = useState<Set<string>>(new Set());
  const [starting, setStarting] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef<number | null>(null);
  const [reviewTarget, setReviewTarget] = useState<string | null>(null);
  const [rollingBack, setRollingBack] = useState(false);
  const [exportView, setExportView] = useState<'section' | 'teacher' | 'room'>('section');
  const [exportId, setExportId] = useState('');

  const grades = useApi(['admin', 'grades', campusId ?? 'school'], () => adminAcademics.grades(campusId));
  const gradeList = grades.data ?? [];
  const sectionsRes = useApi(['admin', 'sections', campusId ?? 'school', 'all'], () => adminAcademics.sections(campusId));
  const sections = (sectionsRes.data ?? []).filter((s) => s.is_active !== false);
  const periodsRes = useApi(['admin', 'bell-periods', campusId ?? 'school'], () => adminPeriods.list(campusId));
  const periods = useMemo(() => sortPeriods(periodsRes.data ?? []), [periodsRes.data]);
  const gradeName = (id?: string) => gradeList.find((x) => x.id === id)?.name;
  const sectionless = useMemo(() => {
    if (sectionsRes.isLoading) return [];
    const withSections = new Set(sections.map((s) => s.grade_level_id));
    return gradeList.filter((x) => x.is_active !== false && !withSections.has(x.id));
  }, [sectionsRes.isLoading, sections, gradeList]);

  // ── pre-flight (requirements + coverage per target) ──
  const targetSections = scope === 'all' ? sections : sections.filter((s) => secIds.has(s.id));
  const targetGrades = scope === 'all' ? sectionless : sectionless.filter((x) => gradeIds.has(x.id));
  const preKey = step === 'scope' && yearId ? ['admin', 'tt-preflight', yearId, targetSections.map((s) => s.id).join(','), targetGrades.map((x) => x.id).join(',')] : null;
  const pre = useApi(preKey, async ([, , y, sIds, gIds]) => {
    const sec = String(sIds).split(',').filter(Boolean);
    const grd = String(gIds).split(',').filter(Boolean);
    const rows: Preflight[] = await Promise.all([
      ...sec.map(async (id) => {
        const s = sections.find((x) => x.id === id);
        const [reqs, cov] = await Promise.all([adminGenerator.requirements(String(y), id), adminGenerator.coverage(id, String(y))]);
        return { kind: 'section' as const, id, name: s?.name ?? id, gradeName: gradeName(s?.grade_level_id), requirementCount: reqs.data?.length ?? 0, coverage: cov.data ?? null };
      }),
      ...grd.map(async (id) => {
        const [reqs, cov] = await Promise.all([adminGenerator.requirements(String(y), undefined, id), adminGenerator.coverage(id, String(y), 'grade')]);
        const name = gradeName(id) ?? id;
        return { kind: 'grade' as const, id, name, gradeName: name, requirementCount: reqs.data?.length ?? 0, coverage: cov.data ?? null };
      }),
    ]);
    return { success: true, data: rows };
  });
  const preflight = pre.data ?? [];
  const noReqs = preflight.filter((p) => p.requirementCount === 0);
  const overCap = preflight.filter((p) => p.coverage?.is_over_capacity);
  const canGenerate = (scope === 'all' || secIds.size > 0 || gradeIds.size > 0) && !!yearId;
  const targetLabel = (p: Preflight) => (p.kind === 'section' ? `${p.gradeName} - ${p.name}` : g('grade_level', { name: p.name }));

  async function start() {
    if (noReqs.length) return toast.error(g('err_no_reqs', { count: noReqs.length }));
    if (!yearId) return;
    setStarting(true);
    try {
      const r = await adminGenerator.start({ campus_id: campusId, academic_year_id: yearId, scope, section_ids: scope === 'sections' ? [...secIds] : undefined, grade_level_ids: scope === 'sections' ? [...gradeIds] : undefined });
      const existing = r.status === 409 ? (r.errorData?.existing_job_id as string | undefined) : undefined;
      if (existing) {
        toast.error(r.error || g('already_running'));
        setJobId(existing);
      } else if (!r.success || !r.data) {
        return toast.error(r.error || g('start_failed'));
      } else {
        setJobId(r.data.job_id);
        toast.success(g('started'));
      }
      startedAt.current = Date.now();
      setStep('generating');
    } finally {
      setStarting(false);
    }
  }

  // ── job polling ──
  const jobRes = useApi(jobId ? ['admin', 'tt-job', jobId] : null, ([, , id]) => adminGenerator.job(String(id)), {
    refreshInterval: (latest) => (latest && FINISHED.includes(latest.status) ? 0 : 2000),
    revalidateOnFocus: false,
  });
  const job = jobRes.data ?? null;
  const jobStatus = job?.status ?? null;
  useEffect(() => {
    if (jobStatus && FINISHED.includes(jobStatus) && step === 'generating') setStep('results');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobStatus]);
  useEffect(() => {
    if (step !== 'generating') return;
    const iv = setInterval(() => startedAt.current && setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [step]);

  async function cancel() {
    if (!jobId) return;
    const r = await adminGenerator.cancel(jobId);
    if (!r.success) return toast.error(r.error || g('cancel_failed'));
    toast.success(g('cancel_requested'));
    jobRes.mutate();
  }

  // ── review ──
  const affectedSections = !job ? [] : job.scope === 'all' ? sections.map((s) => s.id) : (job.section_ids ?? []);
  const affectedGrades = !job || job.scope !== 'sections' ? [] : (job.grade_level_ids ?? []);
  const reviewKey = step === 'review' && yearId ? ['admin', 'tt-review', yearId, affectedSections.join(','), affectedGrades.join(',')] : null;
  const review = useApi(reviewKey, async ([, , y, sIds, gIds]) => {
    const sec = String(sIds).split(',').filter(Boolean);
    const grd = String(gIds).split(',').filter(Boolean);
    const [s, gr] = await Promise.all([
      Promise.all(sec.map(async (id) => [id, (await adminTimetable.bySection(id, String(y))).data ?? []] as const)),
      Promise.all(grd.map(async (id) => [id, (await adminTimetable.byGrade(id, String(y))).data ?? []] as const)),
    ]);
    return { success: true, data: { sections: Object.fromEntries(s) as Record<string, AdminTimetableEntry[]>, grades: Object.fromEntries(gr) as Record<string, AdminTimetableEntry[]> } };
  });
  const sectionEntries = review.data?.sections ?? {};
  const gradeEntries = review.data?.grades ?? {};
  const target = reviewTarget ?? (affectedSections[0] ? `section:${affectedSections[0]}` : affectedGrades[0] ? `grade:${affectedGrades[0]}` : null);
  const reviewSectionId = target?.startsWith('section:') ? target.slice(8) : null;
  const reviewGradeId = target?.startsWith('grade:') ? target.slice(6) : null;
  const reviewSection = sections.find((s) => s.id === reviewSectionId);
  const allEntries = useMemo(() => [...Object.values(sectionEntries).flat(), ...Object.values(gradeEntries).flat()], [sectionEntries, gradeEntries]);
  const teacherOpts = useMemo(() => [...new Map(allEntries.filter((e) => e.teacher_id).map((e) => [e.teacher_id, e.teacher_name || e.teacher_id])).entries()].map(([value, label]) => ({ value, label })), [allEntries]);
  const roomOpts = useMemo(() => [...new Set(allEntries.map((e) => e.room_number).filter(Boolean) as string[])].map((r) => ({ value: r, label: r })), [allEntries]);

  async function rollback() {
    if (!jobId) return;
    if (!(await confirm({ title: g('rollback_title'), body: g('rollback_body'), confirmLabel: g('rollback'), destructive: true }))) return;
    setRollingBack(true);
    try {
      const r = await adminGenerator.rollback(jobId);
      if (!r.success) return toast.error(r.error || g('rollback_failed'));
      toast.success(g('rolled_back', { count: r.data?.rolled_back_count ?? 0 }));
      review.mutate();
    } finally {
      setRollingBack(false);
    }
  }

  const sectionLabel = (e: AdminTimetableEntry) => `${e.subject_name || 'Subject'} (${e.teacher_name || 'Teacher'})${e.room_number ? ` [${e.room_number}]` : ''}`;
  const teacherLabel = (e: AdminTimetableEntry) => `${e.section_name || 'Section'} - ${e.subject_name || 'Subject'}${e.room_number ? ` [${e.room_number}]` : ''}`;
  const roomLabel = (e: AdminTimetableEntry) => `${e.section_name || 'Section'} - ${e.subject_name || 'Subject'} (${e.teacher_name || 'Teacher'})`;
  const exportSet = (): { title: string; file: string; entries: AdminTimetableEntry[]; label: (e: AdminTimetableEntry) => string } | null => {
    if (exportView === 'section' && reviewSectionId) return { title: `Timetable — ${reviewSection?.name ?? ''}`, file: `timetable_${reviewSection?.name || 'section'}`, entries: sectionEntries[reviewSectionId] ?? [], label: sectionLabel };
    if (exportView === 'section' && reviewGradeId) return { title: `Timetable — ${gradeName(reviewGradeId) ?? ''}`, file: `timetable_${gradeName(reviewGradeId) || 'grade'}`, entries: gradeEntries[reviewGradeId] ?? [], label: sectionLabel };
    if (exportView === 'teacher' && exportId) {
      const name = teacherOpts.find((x) => x.value === exportId)?.label || 'teacher';
      return { title: `Teacher Schedule — ${name}`, file: `timetable_teacher_${name}`, entries: allEntries.filter((e) => e.teacher_id === exportId), label: teacherLabel };
    }
    if (exportView === 'room' && exportId) return { title: `Room Schedule — ${exportId}`, file: `timetable_room_${exportId}`, entries: allEntries.filter((e) => e.room_number === exportId), label: roomLabel };
    return null;
  };

  async function exportCsv() {
    const x = exportSet();
    if (!x) return toast.error(g('select_export'));
    const rows = periods.map((p) => [periodTitle(p), p.start_time && p.end_time ? `${p.start_time}-${p.end_time}` : '', ...TT_DAYS.map((_, i) => {
      const e = entryAt(x.entries, i, p.id);
      return e ? x.label(e) : '-';
    })]);
    await shareTextFile(`${x.file}.csv`, toCsv([x.title], [[], ['Period', 'Time', ...TT_DAYS], ...rows]), 'text/csv', 'public.comma-separated-values-text');
  }

  async function printCurrent() {
    const x = exportSet();
    if (!x) return toast.error(g('select_export'));
    const head = `<tr><th>Period</th>${TT_DAYS.map((d) => `<th>${escapeHtml(t(`school.timetable.days.${d}`))}</th>`).join('')}</tr>`;
    const body = periods.map((p) => `<tr><td><b>${escapeHtml(periodTitle(p))}</b><br/>${escapeHtml(periodTime(p, t('school.timetable.unit_min')))}</td>${TT_DAYS.map((_, i) => `<td>${escapeHtml(entryAt(x.entries, i, p.id) ? x.label(entryAt(x.entries, i, p.id)!) : '-')}</td>`).join('')}</tr>`).join('');
    const css = `.tt{width:100%;border-collapse:collapse;font-size:10px}.tt th{background:#022172;color:#fff;padding:5px}.tt td{border:1px solid #ccc;padding:5px;text-align:center}`;
    try {
      await sharePdf(buildPrintHtml({ title: x.title, pages: [`<h2>${escapeHtml(x.title)}</h2><table class="tt">${head}${body}</table>`], school: print.school, layout: print.layout, withHeader: print.withHeader, extraCss: css }), `${x.file}.pdf`, { width: 842, height: 595 });
    } catch {
      toast.error(t('app.tt_pdf_failed'));
    }
  }

  const reset = () => {
    setStep('scope');
    setJobId(null);
    setElapsed(0);
    startedAt.current = null;
    setReviewTarget(null);
  };
  const toggle = (set: Set<string>, id: string) => {
    const n = new Set(set);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  };
  const steps: { key: Step; label: string }[] = [
    { key: 'scope', label: g('step_scope') },
    { key: 'generating', label: g('step_generating') },
    { key: 'results', label: g('step_results') },
    { key: 'review', label: g('step_review') },
  ];
  const stepIdx = steps.findIndex((s) => s.key === step);
  const fixLink = (p: { kind: 'section' | 'grade'; id: string }, label: string) => (
    <Button size="sm" variant="ghost" className="self-start" onPress={() => router.push({ pathname: '/admin/timetable/requirements', params: p.kind === 'section' ? { section_id: p.id } : { grade_level_id: p.id } })}>
      <Text>{label} →</Text>
    </Button>
  );

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: g('title') }} />
      <ScrollView contentContainerClassName="gap-4 p-4 pb-10">
        <Text className="text-muted-foreground text-sm">{g('subtitle')}</Text>
        <View className="flex-row flex-wrap items-center gap-2">
          {steps.map((s, i) => (
            <View key={s.key} className="flex-row items-center gap-1.5">
              <View className={cn('size-6 items-center justify-center rounded-full', i < stepIdx ? 'bg-green-600' : i === stepIdx ? 'bg-primary' : 'bg-muted')}>
                {i < stepIdx ? <Icon as={CheckCircle2} className="size-3.5 text-white" /> : <Text className={cn('text-xs font-semibold', i === stepIdx ? 'text-primary-foreground' : 'text-muted-foreground')}>{i + 1}</Text>}
              </View>
              <Text className={cn('text-xs', i === stepIdx ? 'font-medium' : 'text-muted-foreground')}>{s.label}</Text>
            </View>
          ))}
        </View>

        {step === 'scope' ? (
          <>
            <Card>
              <CardContent className="gap-3 pt-4">
                <View className="gap-1">
                  <Label>{t('app.tr_f_year')}</Label>
                  <Picker value={yearId ?? ''} onChange={years.pick} options={years.years.map((y) => ({ value: y.id, label: `${y.name}${y.is_current ? ` ${t('app.tr_current')}` : ''}` }))} />
                </View>
                <Label>{g('scope')}</Label>
                <FilterChips
                  value={scope}
                  onChange={setScope}
                  options={[
                    { value: 'sections', label: g('scope_sections') },
                    { value: 'all', label: g('scope_all') },
                  ]}
                />
                {scope === 'sections' ? (
                  <View className="gap-2">
                    <Label>{g('select_sections', { count: secIds.size })}</Label>
                    {sectionsRes.isLoading ? (
                      <LoadingList rows={2} />
                    ) : (
                      <View className="flex-row flex-wrap gap-x-4">
                        {sections.map((s) => (
                          <CheckRow key={s.id} checked={secIds.has(s.id)} onPress={() => setSecIds((p) => toggle(p, s.id))} label={`${gradeName(s.grade_level_id) ?? ''} - ${s.name}`} />
                        ))}
                      </View>
                    )}
                    {sectionless.length ? (
                      <>
                        <Label>{g('select_grades', { count: gradeIds.size })}</Label>
                        <View className="flex-row flex-wrap gap-x-4">
                          {sectionless.map((x) => (
                            <CheckRow key={x.id} checked={gradeIds.has(x.id)} onPress={() => setGradeIds((p) => toggle(p, x.id))} label={g('grade_level', { name: x.name })} />
                          ))}
                        </View>
                      </>
                    ) : null}
                  </View>
                ) : null}
              </CardContent>
            </Card>

            {pre.isLoading ? (
              <Text className="text-muted-foreground text-sm">{g('preflight_running')}</Text>
            ) : (
              <>
                {noReqs.length ? (
                  <View className="border-destructive/50 bg-destructive/5 gap-1 rounded-md border p-3">
                    <Text className="text-destructive font-medium">{g('no_reqs_title', { count: noReqs.length })}</Text>
                    {noReqs.map((p) => (
                      <View key={p.id}>
                        <Text className="text-sm">{targetLabel(p)}</Text>
                        {fixLink(p, g('define_reqs'))}
                      </View>
                    ))}
                  </View>
                ) : null}
                {overCap.length ? (
                  <View className="gap-1 rounded-md border border-amber-500/50 bg-amber-50 p-3 dark:bg-amber-950/20">
                    <Text className="font-medium text-amber-800 dark:text-amber-400">{g('over_cap_title', { count: overCap.length })}</Text>
                    {overCap.map((p) => (
                      <View key={p.id}>
                        <Text className="text-sm">
                          {targetLabel(p)}: {p.coverage?.required_periods_per_week}/{p.coverage?.available_periods_per_week} {g('per_week')}
                        </Text>
                        {fixLink(p, g('adjust_reqs'))}
                      </View>
                    ))}
                  </View>
                ) : null}
                {preflight.length && !noReqs.length && !overCap.length ? (
                  <View className="flex-row items-center gap-2 rounded-md border border-green-500/50 bg-green-50 p-3 dark:bg-green-950/20">
                    <Icon as={CheckCircle2} className="size-4 text-green-600" />
                    <Text className="flex-1 text-sm text-green-700 dark:text-green-400">{g('ready', { count: preflight.length })}</Text>
                  </View>
                ) : null}
              </>
            )}
            <Button onPress={start} disabled={!canGenerate || starting || noReqs.length > 0}>
              <Icon as={PlayCircle} className="text-primary-foreground size-4" />
              <Text>{g('generate_btn')}</Text>
            </Button>
          </>
        ) : null}

        {step === 'generating' ? (
          <Card>
            <CardContent className="items-center gap-3 py-10">
              <LoadingList rows={1} />
              <Text className="text-lg font-medium">{job?.status === 'queued' ? g('queued') : g('solving')}</Text>
              <Text className="text-muted-foreground text-center text-sm">{g('solving_desc')}</Text>
              {job?.total_activities ? (
                <View className="w-full gap-1">
                  <Progress value={job.progress_percent} />
                  <Text className="text-muted-foreground text-center text-xs">{g('placed_of', { placed: job.placed_activities ?? 0, total: job.total_activities })}</Text>
                </View>
              ) : null}
              <View className="flex-row items-center gap-1">
                <Icon as={Clock} className="text-muted-foreground size-4" />
                <Text className="text-muted-foreground text-sm">{g('elapsed', { seconds: elapsed })}</Text>
              </View>
              <Button variant="outline" onPress={cancel}>
                <Icon as={Ban} className="text-foreground size-4" />
                <Text>{t('common.cancel')}</Text>
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {step === 'results' && job ? (
          <Card>
            <CardContent className="gap-3 pt-4">
              {job.status === 'failed' ? (
                <>
                  <View className="flex-row items-center gap-2">
                    <Icon as={XCircle} className="text-destructive size-5" />
                    <Text className="text-destructive font-semibold">{g('failed_title')}</Text>
                  </View>
                  <Text className="text-sm">{job.error_message || g('unknown_error')}</Text>
                  <Button variant="outline" className="self-start" onPress={reset}>
                    <Icon as={RefreshCw} className="text-foreground size-4" />
                    <Text>{g('retry')}</Text>
                  </Button>
                </>
              ) : job.status === 'cancelled' ? (
                <>
                  <View className="flex-row items-center gap-2">
                    <Icon as={Ban} className="text-foreground size-5" />
                    <Text className="font-semibold">{g('cancelled_title')}</Text>
                  </View>
                  <Text className="text-muted-foreground text-sm">{g('cancelled_desc')}</Text>
                  <View className="flex-row gap-2">
                    <Button variant="outline" onPress={reset}>
                      <Icon as={RefreshCw} className="text-foreground size-4" />
                      <Text>{g('start_over')}</Text>
                    </Button>
                    <Button onPress={() => setStep('review')}>
                      <Text>{g('review_grid')}</Text>
                      <Icon as={ArrowRight} className="text-primary-foreground size-4 rtl:rotate-180" />
                    </Button>
                  </View>
                </>
              ) : (
                <>
                  <View className="flex-row items-center gap-2">
                    <Icon as={CheckCircle2} className="size-5 text-green-600" />
                    <Text className="font-semibold">{g('complete_title')}</Text>
                  </View>
                  <View className="flex-row flex-wrap gap-2">
                    <Stat label={g('placed')} value={job.placed_activities ?? 0} tone="good" />
                    <Stat label={g('unplaced')} value={job.unplaced_activities ?? 0} tone={(job.unplaced_activities ?? 0) > 0 ? 'warn' : 'good'} />
                    <Stat label={g('hard_violations')} value={job.hard_violations} tone={job.hard_violations > 0 ? 'bad' : 'good'} />
                    <Stat label={g('soft_score')} value={job.soft_score ?? 0} tone="neutral" />
                  </View>
                  {job.hard_violations > 0 ? (
                    <View className="border-destructive/50 bg-destructive/5 rounded-md border p-3">
                      <Text className="text-destructive text-sm">{g('hard_warning', { count: job.hard_violations })}</Text>
                    </View>
                  ) : null}
                  {job.result_summary?.unplaced?.length ? (
                    <View className="gap-2">
                      <View className="flex-row items-center gap-2">
                        <Icon as={AlertTriangle} className="size-4 text-amber-600" />
                        <Text className="text-sm font-medium">{g('unplaced_title')}</Text>
                      </View>
                      <View className="border-border rounded-md border">
                        {job.result_summary.unplaced.map((u, i) => (
                          <View key={`${u.activity_id}-${i}`}>
                            {i > 0 ? <Separator /> : null}
                            <View className="gap-0.5 p-2">
                              <Text className="text-sm font-medium">
                                {u.section_name || g('section')} · {u.subject_name || g('subject')}
                                {u.teacher_name ? ` · ${u.teacher_name}` : ''}
                              </Text>
                              <Text className="text-muted-foreground text-xs">{u.reason}</Text>
                              {u.section_id ? fixLink({ kind: 'section', id: u.section_id }, g('fix_reqs')) : null}
                            </View>
                          </View>
                        ))}
                      </View>
                    </View>
                  ) : null}
                  {job.result_summary?.warnings?.length ? (
                    <View className="gap-1 rounded-md border border-amber-500/50 bg-amber-50 p-3 dark:bg-amber-950/20">
                      {job.result_summary.warnings.map((w, i) => (
                        <Text key={i} className="text-sm">
                          {w}
                        </Text>
                      ))}
                    </View>
                  ) : null}
                  <View className="flex-row gap-2">
                    <Button variant="outline" onPress={reset}>
                      <Icon as={RefreshCw} className="text-foreground size-4" />
                      <Text>{g('run_another')}</Text>
                    </Button>
                    <Button onPress={() => setStep('review')}>
                      <Text>{g('review_grid')}</Text>
                      <Icon as={ArrowRight} className="text-primary-foreground size-4 rtl:rotate-180" />
                    </Button>
                  </View>
                </>
              )}
            </CardContent>
          </Card>
        ) : null}

        {step === 'review' ? (
          <>
            <Card>
              <CardContent className="gap-3 pt-4">
                <Label>{g('reviewing')}</Label>
                <Picker
                  value={target ?? ''}
                  onChange={setReviewTarget}
                  options={[
                    ...affectedSections.map((id) => {
                      const s = sections.find((x) => x.id === id);
                      return { value: `section:${id}`, label: `${gradeName(s?.grade_level_id) ?? ''} - ${s?.name || id}` };
                    }),
                    ...affectedGrades.map((id) => ({ value: `grade:${id}`, label: g('grade_level', { name: gradeName(id) ?? id }) })),
                  ]}
                />
                <Button variant="destructive" className="self-start" disabled={!jobId || rollingBack} onPress={rollback}>
                  <Icon as={RotateCcw} className="size-4 text-white" />
                  <Text>{g('rollback_btn')}</Text>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="gap-3 pt-4">
                <Text className="font-semibold">{g('export_title')}</Text>
                <Text className="text-muted-foreground text-xs">{g('export_desc')}</Text>
                <FilterChips
                  value={exportView}
                  onChange={(v) => {
                    setExportView(v);
                    setExportId('');
                  }}
                  options={[
                    { value: 'section', label: g('view_section') },
                    { value: 'teacher', label: g('view_teacher') },
                    { value: 'room', label: g('view_room') },
                  ]}
                />
                {exportView === 'teacher' ? <Picker value={exportId} onChange={setExportId} placeholder={g('select_teacher')} options={teacherOpts} /> : null}
                {exportView === 'room' ? <Picker value={exportId} onChange={setExportId} placeholder={g('select_room')} options={roomOpts} /> : null}
                <View className="flex-row gap-2">
                  <Button size="sm" variant="outline" onPress={exportCsv}>
                    <Icon as={Download} className="text-foreground size-4" />
                    <Text>{g('export_csv')}</Text>
                  </Button>
                  <Button size="sm" variant="outline" onPress={printCurrent}>
                    <Icon as={Printer} className="text-foreground size-4" />
                    <Text>{g('print_current')}</Text>
                  </Button>
                </View>
              </CardContent>
            </Card>

            {review.isLoading ? (
              <LoadingList />
            ) : reviewSectionId && reviewSection && yearId ? (
              <TimetableBuilder
                key={reviewSectionId}
                sectionId={reviewSectionId}
                sectionName={reviewSection.name}
                gradeId={reviewSection.grade_level_id}
                gradeName={gradeName(reviewSection.grade_level_id)}
                periods={periods}
                entries={sectionEntries[reviewSectionId] ?? []}
                academicYearId={yearId}
                orientation="vertical"
                loading={false}
                onChange={() => review.mutate()}
              />
            ) : reviewGradeId ? (
              <Card>
                <CardContent className="gap-2 pt-4">
                  <Text className="font-semibold">{g('grade_level', { name: gradeName(reviewGradeId) ?? '' })}</Text>
                  <Text className="text-muted-foreground text-xs">{g('grade_readonly')}</Text>
                  {periods.length ? (
                    <TimetableGrid
                      periods={periods}
                      orientation="vertical"
                      renderCell={(_d, i, p) => {
                        const e = entryAt(gradeEntries[reviewGradeId] ?? [], i, p.id);
                        return (
                          <View className="min-h-12 justify-center p-1">
                            {e ? (
                              <>
                                <Text className="text-primary text-[11px] font-medium" numberOfLines={1}>
                                  {e.subject_name}
                                </Text>
                                <Text className="text-muted-foreground text-[10px]" numberOfLines={1}>
                                  {e.teacher_name}
                                </Text>
                              </>
                            ) : (
                              <Text className="text-muted-foreground text-center text-xs">-</Text>
                            )}
                          </View>
                        );
                      }}
                    />
                  ) : (
                    <Text className="text-muted-foreground text-center text-sm">{g('no_periods')}</Text>
                  )}
                </CardContent>
              </Card>
            ) : null}
            <Button variant="outline" onPress={reset}>
              <Icon as={RefreshCw} className="text-foreground size-4" />
              <Text>{g('start_over')}</Text>
            </Button>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: 'good' | 'bad' | 'warn' | 'neutral' }) {
  const cls = { good: 'border-green-500/40 bg-green-50 dark:bg-green-950/20', bad: 'border-destructive/40 bg-destructive/5', warn: 'border-amber-500/40 bg-amber-50 dark:bg-amber-950/20', neutral: 'border-border bg-muted/30' }[tone];
  return (
    <View className={cn('min-w-[45%] flex-1 rounded-md border p-3', cls)}>
      <Text className="text-2xl font-bold">{value}</Text>
      <Text className="text-xs">{label}</Text>
    </View>
  );
}
