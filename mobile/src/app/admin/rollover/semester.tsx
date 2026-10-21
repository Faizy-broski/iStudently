import type { AcademicYear, MarkingPeriod, SemesterRolloverResult } from '@studently/api-client';
import { router, Stack } from 'expo-router';
import { AlertTriangle, ArrowLeft, Calendar, CheckCircle2, Info, RotateCcw, TrendingUp, Users } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { DateField } from '@/components/app/date-field';
import { Picker } from '@/components/app/picker';
import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { useSession } from '@/features/auth/session';
import { useCampus } from '@/features/campus/campus';
import { adminAcademics, adminGrades, adminRollover } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

const STATUS_TONE: Record<string, string> = {
  pending: 'bg-warning-soft text-warning',
  promoted: 'bg-info-soft text-brand dark:text-brand-secondary',
  retained: 'bg-muted text-muted-foreground',
  dropped: 'bg-destructive-soft text-destructive',
  graduated: 'bg-success-soft text-success',
  transferred: 'bg-chart-6/10 text-chart-6',
};
const STATUSES = ['pending', 'promoted', 'retained', 'dropped', 'graduated', 'transferred'] as const;

/** The academic year whose dates best match a Full Year marking period (web: matchAcademicYear). */
function matchYear(fy: MarkingPeriod | undefined, years: AcademicYear[]) {
  if (!fy?.start_date || !fy.end_date) return undefined;
  const s = new Date(fy.start_date).getTime();
  const e = new Date(fy.end_date).getTime();
  return years.find((y) => new Date(y.start_date).getTime() === s) ?? years.find((y) => new Date(y.start_date).getTime() < e && new Date(y.end_date).getTime() > s);
}

/** Mid-year rollover inside one academic year (web: /admin/rollover/semester). */
export default function SemesterRollover() {
  const { t } = useTranslation();
  const s = (k: string, o?: Record<string, unknown>) => t(`school.semester_rollover.${k}`, o);
  const a = (k: string, o?: Record<string, unknown>) => t(`app.ro_${k}`, o);
  const toast = useToast();
  const { me } = useSession();
  const { campus, campusId } = useCampus();
  const schoolId = campus?.parent_school_id ?? (me.status === 'ready' ? me.me.profile.school_id : null) ?? '';
  const mps = useApi(['admin', 'marking-periods', campusId ?? 'school'], () => adminGrades.markingPeriods(campusId));
  const yearsRes = useApi(['admin', 'academic-years', 'all'], () => adminAcademics.academicYears(true));
  const years = useMemo(() => [...(yearsRes.data ?? [])].sort((x, y) => x.start_date.localeCompare(y.start_date)), [yearsRes.data]);
  const fyList = useMemo(() => (mps.data ?? []).filter((m) => m.mp_type === 'FY').sort((x, y) => (x.start_date ?? '').localeCompare(y.start_date ?? '')), [mps.data]);
  const [fyId, setFyId] = useState('');
  const [semId, setSemId] = useState('');
  const [endDate, setEndDate] = useState('');
  const [result, setResult] = useState<SemesterRolloverResult | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [executing, setExecuting] = useState(false);

  // Auto-select the FY matching the current academic year (web: init).
  const ready = !!mps.data && !!yearsRes.data;
  useEffect(() => {
    if (!ready || fyId) return;
    const cur = years.find((y) => y.is_current) ?? years[years.length - 1];
    const auto = cur
      ? (fyList.find((f) => f.start_date && new Date(f.start_date).getTime() === new Date(cur.start_date).getTime()) ??
        fyList.find((f) => !!f.start_date && !!f.end_date && new Date(f.start_date) < new Date(cur.end_date) && new Date(f.end_date) > new Date(cur.start_date)))
      : fyList[fyList.length - 1];
    if (auto) setFyId(auto.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const fy = fyList.find((f) => f.id === fyId);
  const matched = matchYear(fy, years);
  const semesters = (mps.data ?? []).filter((m) => m.mp_type === 'SEM' && m.parent_id === fyId).sort((x, y) => (x.sort_order ?? 0) - (y.sort_order ?? 0));
  const sem = semesters.find((x) => x.id === semId);
  const semEnd = sem?.end_date ?? null;
  useEffect(() => {
    if (semEnd) setEndDate(semEnd);
  }, [semId, semEnd]);

  const yearId = matched?.id ?? null;
  const preview = useApi(yearId && schoolId ? ['admin', 'sem-rollover', yearId, schoolId, campusId ?? ''] : null, ([, , y, sc]) => adminRollover.semesterPreview({ academic_year_id: String(y), school_id: String(sc), campus_id: campusId }));
  const students = preview.data?.students;
  const total = students?.total_active ?? 0;

  function changeYear(id: string) {
    setFyId(id);
    setSemId('');
    setEndDate('');
    setResult(null);
    if (!matchYear(fyList.find((f) => f.id === id), years)) toast.info(a('no_match_year'));
  }

  async function execute() {
    if (!schoolId) return toast.error(a('no_school'));
    if (!matched) return toast.error(a('no_match_period'));
    if (!endDate) return toast.error(a('set_end_date'));
    setConfirmOpen(false);
    setExecuting(true);
    try {
      const r = await adminRollover.semesterExecute({ academic_year_id: matched.id, semester_end_date: endDate, school_id: schoolId, campus_id: campusId });
      if (!r.success || !r.data) return toast.error(r.error || s('rollover_failed'));
      setResult(r.data);
      if (r.data.success) {
        toast.success(s('rollover_complete'));
        preview.mutate();
      } else toast.error(s('rollover_failed'));
    } finally {
      setExecuting(false);
    }
  }

  if (mps.isLoading || yearsRes.isLoading) return <LoadingList />;
  const canExecute = !!matched && !!endDate && !executing;

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: s('title') }} />
      <ScrollView contentContainerClassName="gap-4 p-4 pb-10">
        <Text className="text-muted-foreground text-sm">{s('subtitle')}</Text>
        <Button size="sm" variant="outline" className="self-start" onPress={() => router.push('/admin/rollover')}>
          <Icon flipRtl as={ArrowLeft} className="text-foreground size-4" />
          <Text>{s('btn_year_end_rollover')}</Text>
        </Button>

        <View className="border-info-soft dark:border-border gap-1 rounded-xl border p-3">
          <View className="flex-row items-center gap-2">
            <Icon as={Info} className="text-foreground size-4" />
            <Text className="font-semibold">{s('how_it_works_title')}</Text>
          </View>
          <Text className="text-sm">{s('how_it_works_desc')}</Text>
          <Text className="text-muted-foreground text-sm">• {s('item_pending_promoted')}</Text>
          <Text className="text-muted-foreground text-sm">• {s('item_retained')}</Text>
          <Text className="text-muted-foreground text-sm">• {s('item_dropped')}</Text>
          <Text className="text-muted-foreground text-xs">{s('how_it_works_footer')}</Text>
        </View>

        {!fyList.length ? (
          <View className="flex-row gap-2 rounded-xl border border-warning/30 bg-warning-soft p-3">
            <Icon as={AlertTriangle} className="size-4 text-warning" />
            <Text className="flex-1 text-sm text-warning ">{a('no_fy')}</Text>
            <Button size="sm" variant="outline" onPress={() => router.push('/admin/marking-periods')}>
              <Text>{t('school.marking_periods.title')}</Text>
            </Button>
          </View>
        ) : null}

        <Card>
          <CardContent className="gap-3 pt-4">
            <View className="flex-row items-center gap-2">
              <Icon as={Calendar} className="text-primary size-4" />
              <Text className="font-semibold">{s('config_title')}</Text>
            </View>
            <Label>{s('label_academic_year')}</Label>
            <Picker value={fyId} onChange={changeYear} placeholder={a('select_year')} options={fyList.map((f) => ({ value: f.id, label: `${f.title}${matchYear(f, years)?.is_current ? ` ${t('app.tr_current')}` : ''}` }))} />
            {fyId && !matched ? <Text className="text-xs text-warning">{a('no_match_year')}</Text> : null}
            <Label>{s('label_semester')}</Label>
            {semesters.length ? (
              <Picker value={semId} onChange={setSemId} placeholder={s('placeholder_select_semester')} options={semesters.map((x) => ({ value: x.id, label: x.title }))} />
            ) : (
              <Text className="text-muted-foreground text-xs">{fyId ? a('no_semesters') : a('select_year_first')}</Text>
            )}
            <DateField label={s('label_end_date')} value={endDate} onChange={setEndDate} clearable />
            <Text className="text-muted-foreground text-xs">{s('end_date_desc')}</Text>
          </CardContent>
        </Card>

        {preview.isLoading ? (
          <Text className="text-muted-foreground text-sm">{s('loading_preview')}</Text>
        ) : preview.data ? (
          <Card>
            <CardContent className="gap-2 pt-4">
              <View className="flex-row items-center gap-2">
                <Icon as={Users} className="text-primary size-4" />
                <Text className="flex-1 font-semibold">{s('preview_title')}</Text>
                <Text className="text-muted-foreground text-sm">{s('active_students', { count: total })}</Text>
              </View>
              <Text className="text-muted-foreground text-xs">{s('preview_desc')}</Text>
              {total === 0 ? (
                <Text className="text-muted-foreground text-sm">{s('no_enrollments', { campusId: !!campusId })}</Text>
              ) : (
                STATUSES.map((st) => {
                  const count = students?.[st] ?? 0;
                  if (!count) return null;
                  return (
                    <View key={st} className="flex-row items-center gap-2 py-1">
                      <View className={cn('rounded-full px-2 py-0.5', STATUS_TONE[st])}>
                        <Text className={cn('text-xs', STATUS_TONE[st])}>{t(`common.${st}`)}</Text>
                      </View>
                      <Text className="text-muted-foreground flex-1 text-sm">{s(`action_${st}`)}</Text>
                      <Text className="font-semibold">{count}</Text>
                    </View>
                  );
                })
              )}
            </CardContent>
          </Card>
        ) : null}

        {result?.success ? (
          <Card className="border-success/30 bg-success-soft ">
            <CardContent className="gap-3 pt-4">
              <View className="flex-row items-center gap-2">
                <Icon as={CheckCircle2} className="size-5 text-success" />
                <Text className="font-semibold text-success ">{s('rollover_complete')}</Text>
              </View>
              <View className="flex-row flex-wrap justify-around gap-3">
                {(['promoted', 'retained', 'dropped', 'graduated', 'transferred'] as const).map((k) => (
                  <View key={k} className="items-center">
                    <Text className="text-2xl font-bold text-success ">{result[k]}</Text>
                    <Text className="text-xs text-success">{t(`common.${k}`)}</Text>
                  </View>
                ))}
              </View>
              <Text className="text-center text-xs text-success">{s('total_processed', { count: result.total })}</Text>
            </CardContent>
          </Card>
        ) : null}

        <View className="flex-row justify-end gap-2">
          <Button variant="outline" disabled={!matched || preview.isLoading || executing} onPress={() => preview.mutate()}>
            <Icon as={RotateCcw} className="text-foreground size-4" />
            <Text>{s('btn_refresh_preview')}</Text>
          </Button>
          <Button onPress={() => setConfirmOpen(true)} disabled={!canExecute || preview.isLoading}>
            <Icon as={TrendingUp} className="text-primary-foreground size-4" />
            <Text>{executing ? s('btn_running') : s('btn_execute')}</Text>
          </Button>
        </View>
      </ScrollView>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="w-[94vw] max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">{s('confirm_title')}</DialogTitle>
          </DialogHeader>
          <Text className="text-center text-sm font-semibold">{s('confirm_question')}</Text>
          <Text className="text-muted-foreground text-center text-xs">
            {s('semester_end_date_confirm', { date: endDate })}
            {sem ? ` (${sem.title})` : ''}
          </Text>
          <View className="gap-1 border-s-4 border-warning bg-warning-soft p-3 ">
            <View className="flex-row items-center gap-1">
              <Icon as={AlertTriangle} className="size-4 text-warning" />
              <Text className="text-sm font-semibold">{s('warning_title')}</Text>
            </View>
            {[1, 2, 3, 4].map((i) => (
              <Text key={i} className="text-muted-foreground text-xs">
                • {s(`warning_item_${i}`)}
              </Text>
            ))}
          </View>
          <View className="flex-row justify-center gap-3">
            <Button variant="outline" onPress={execute} disabled={executing}>
              <Text>{t('common.btn_ok')}</Text>
            </Button>
            <Button onPress={() => setConfirmOpen(false)}>
              <Text>{t('common.btn_cancel')}</Text>
            </Button>
          </View>
        </DialogContent>
      </Dialog>
    </View>
  );
}
