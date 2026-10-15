import type { AcademicYear, RolloverCheck, RolloverPreview, RolloverResult } from '@studently/api-client';
import { router, Stack } from 'expo-router';
import { AlertTriangle, ArrowDown, Building2, Calendar, CheckCircle2, Info, TrendingUp, UserCheck, Users } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';

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
import { adminAcademics, adminRollover } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

type Item = { key: string; indent?: boolean; info?: boolean; defaultOn: boolean; existing?: (p: RolloverPreview | null) => number };
const ITEMS: Item[] = [
  { key: 'schools', defaultOn: false },
  { key: 'users', defaultOn: false },
  { key: 'school_periods', defaultOn: true },
  { key: 'marking_periods', defaultOn: true, existing: (p) => p?.marking_periods?.next_year_existing ?? 0 },
  { key: 'calendars', defaultOn: true },
  { key: 'grading_scales', defaultOn: true },
  { key: 'attendance_codes', defaultOn: true },
  { key: 'courses', info: true, defaultOn: true },
  { key: 'course_periods', indent: true, defaultOn: true },
  { key: 'enrollment_codes', defaultOn: true },
  { key: 'students', info: true, defaultOn: true },
  { key: 'report_card_comments', info: true, defaultOn: true },
  { key: 'school_configuration', defaultOn: true },
  { key: 'eligibility_activities', defaultOn: true },
  { key: 'food_service', defaultOn: true },
  { key: 'referral_form', defaultOn: true },
];

/** Year-end rollover: prerequisites, preview, items checklist, campus scope, execute (web: /admin/rollover). */
export default function Rollover() {
  const { t, i18n } = useTranslation();
  const r = (k: string, o?: Record<string, unknown>) => t(`school.rollover.${k}`, o);
  const toast = useToast();
  const { me } = useSession();
  const { campus, campuses } = useCampus();
  const schoolId = campus?.parent_school_id ?? (me.status === 'ready' ? me.me.profile.school_id : null) ?? '';
  const yearsRes = useApi(['admin', 'academic-years', 'all'], () => adminAcademics.academicYears(true));
  const years = [...(yearsRes.data ?? [])].sort((a, b) => a.start_date.localeCompare(b.start_date));
  const [current, setCurrent] = useState<AcademicYear | null>(null);
  const [next, setNext] = useState<AcademicYear | null>(null);
  const [scope, setScope] = useState('all');
  const [options, setOptions] = useState<Record<string, boolean>>(() => Object.fromEntries(ITEMS.map((i) => [i.key, i.defaultOn])));
  const [result, setResult] = useState<RolloverResult | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [executing, setExecuting] = useState(false);

  const loadedKey = yearsRes.data ? yearsRes.data.length : null;
  useEffect(() => {
    if (loadedKey == null) return;
    const cur = years.find((y) => y.is_current) ?? null;
    const idx = years.findIndex((y) => y.is_current);
    setCurrent(cur);
    setNext(years.find((y) => y.is_next) ?? (idx >= 0 && idx < years.length - 1 ? years[idx + 1] : null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedKey]);

  const curId = current?.id ?? null;
  const nextId = next?.id ?? null;
  const campusScope = scope === 'all' ? null : scope;
  const pairKey = curId && nextId && schoolId ? ['admin', 'rollover', curId, nextId, schoolId, scope] : null;
  const check = useApi(pairKey, ([, , c, n, s, sc]) => adminRollover.check({ current_year_id: String(c), next_year_id: String(n), school_id: String(s), campus_id: sc === 'all' ? null : String(sc) }));
  const preview = useApi(pairKey ? [...pairKey, 'preview'] : null, ([, , c, n, s, sc]) => adminRollover.preview({ current_year_id: String(c), next_year_id: String(n), school_id: String(s), campus_id: sc === 'all' ? null : String(sc) }));
  const pc: RolloverCheck | undefined = check.data;
  const pv = preview.data ?? null;
  const previewing = check.isLoading || preview.isLoading;
  const day = (s: string) => new Date(s).toLocaleDateString(i18n.language);

  async function execute() {
    if (!curId || !nextId || !pc?.is_valid) return;
    setConfirmOpen(false);
    setExecuting(true);
    try {
      const res = await adminRollover.execute({
        current_year_id: curId,
        next_year_id: nextId,
        school_id: schoolId,
        campus_id: campusScope ?? undefined,
        options: { students: !!options.students, marking_periods: !!options.marking_periods, teachers: !!options.courses },
      });
      if (!res.success || !res.data) return toast.error(res.error || t('common.error'));
      setResult(res.data);
      if (res.data.success) {
        toast.success(r('rollover_complete'));
        check.mutate();
        preview.mutate();
      } else toast.error(res.data.error || t('common.error'));
    } finally {
      setExecuting(false);
    }
  }

  const checklist = (
    <View className="border-border rounded-md border">
      {ITEMS.map((item, i) => {
        const on = !!options[item.key];
        const has = (item.existing?.(pv) ?? 0) > 0;
        return (
          <Pressable key={item.key} onPress={() => setOptions((o) => ({ ...o, [item.key]: !on }))} className={cn('flex-row items-center gap-3 px-4 py-2.5', i > 0 && 'border-border border-t')}>
            {item.indent ? <Text className="text-muted-foreground ms-3 text-xs">↳</Text> : null}
            <View className={cn('size-4 items-center justify-center rounded-sm border-2', on ? 'border-teal-600 bg-teal-600' : 'border-gray-400')}>{on ? <Text className="text-[10px] font-bold text-white">✓</Text> : null}</View>
            <Text className={cn('flex-1 text-sm', has && on && 'text-muted-foreground')}>{r(`rollover_items.${item.key}`)}</Text>
            {item.info ? (
              <Pressable onPress={() => toast.info(r(`rollover_items.${item.key}_info`))} hitSlop={8}>
                <Icon as={Info} className="size-4 text-orange-500" />
              </Pressable>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );

  if (yearsRes.isLoading) return <LoadingList />;

  if (!current || !next) {
    return (
      <View className="bg-background flex-1">
        <Stack.Screen options={{ title: r('title') }} />
        <ScrollView contentContainerClassName="gap-4 p-4">
          <Text className="text-muted-foreground text-sm">{r('subtitle')}</Text>
          {years.length >= 2 ? (
            <Card>
              <CardContent className="gap-3 pt-4">
                <View className="flex-row items-center gap-2">
                  <Icon as={Info} className="size-5 text-blue-500" />
                  <Text className="font-semibold">{r('select_academic_years')}</Text>
                </View>
                <Text className="text-muted-foreground text-sm">{r('no_current_year_desc')}</Text>
                <Label>{r('label_roll_from')}</Label>
                <Picker
                  value={current?.id ?? ''}
                  onChange={(id) => {
                    setCurrent(years.find((y) => y.id === id) ?? null);
                    setNext(null);
                  }}
                  placeholder={t('common.placeholder_select_year')}
                  options={years.map((y) => ({ value: y.id, label: y.name }))}
                />
                <Label>{r('label_roll_to_select')}</Label>
                <Picker
                  value={next?.id ?? ''}
                  onChange={(id) => setNext(years.find((y) => y.id === id) ?? null)}
                  placeholder={t('common.placeholder_select_year')}
                  options={years.filter((y) => !current || y.start_date > current.start_date).map((y) => ({ value: y.id, label: y.name }))}
                />
              </CardContent>
            </Card>
          ) : (
            <View className="border-destructive/50 bg-destructive/5 gap-1 rounded-md border p-3">
              <Text className="text-destructive font-semibold">{t('app.ro_not_available')}</Text>
              {years.length === 0 ? <Text className="text-sm">{t('app.ro_no_years')}</Text> : null}
              {years.length === 1 ? <Text className="text-sm">{t('app.ro_one_year', { name: years[0].name })}</Text> : null}
            </View>
          )}
          <Button variant="outline" onPress={() => router.push('/admin/settings/academic-years')}>
            <Text>{t('app.ro_go_years')}</Text>
          </Button>
        </ScrollView>
      </View>
    );
  }

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: r('title') }} />
      <ScrollView contentContainerClassName="gap-4 p-4 pb-10">
        <Text className="text-muted-foreground text-sm">{r('subtitle_transition', { current: current.name, next: next.name })}</Text>
        <Button size="sm" variant="outline" className="self-start" onPress={() => router.push('/admin/rollover/semester')}>
          <Text>{r('btn_semester_rollover')}</Text>
        </Button>

        {pc ? (
          <View className={cn('flex-row gap-2 rounded-md border p-3', pc.is_valid ? 'border-green-500/50 bg-green-50 dark:bg-green-950/20' : 'border-destructive/50 bg-destructive/5')}>
            <Icon as={pc.is_valid ? CheckCircle2 : AlertTriangle} className={pc.is_valid ? 'size-4 text-green-600' : 'text-destructive size-4'} />
            <View className="flex-1">
              <Text className="font-semibold">{pc.is_valid ? r('status_ready') : r('status_not_met')}</Text>
              <Text className="text-sm">{pc.error_message || r('all_checks_passed')}</Text>
            </View>
          </View>
        ) : null}

        <Card>
          <CardContent className="items-center gap-2 pt-4">
            <Text className="text-muted-foreground text-sm">{r('label_current_year')}</Text>
            <View className="rounded-lg bg-blue-100 px-6 py-2 dark:bg-blue-950/40">
              <Text className="text-lg font-semibold text-blue-700 dark:text-blue-300">{current.name}</Text>
            </View>
            <Text className="text-muted-foreground text-xs">
              {day(current.start_date)} - {day(current.end_date)}
            </Text>
            <Icon as={ArrowDown} className="text-muted-foreground size-6" />
            <Text className="text-muted-foreground text-sm">{r('label_roll_to')}</Text>
            <View className="rounded-lg bg-green-100 px-6 py-2 dark:bg-green-950/40">
              <Text className="text-lg font-semibold text-green-700 dark:text-green-300">{next.name}</Text>
            </View>
            <Text className="text-muted-foreground text-xs">
              {day(next.start_date)} - {day(next.end_date)}
            </Text>
          </CardContent>
        </Card>

        {campuses.length > 0 ? (
          <Card>
            <CardContent className="gap-2 pt-4">
              <View className="flex-row items-center gap-2">
                <Icon as={Building2} className="text-muted-foreground size-4" />
                <Text className="text-sm font-medium">{r('label_campus_scope')}</Text>
              </View>
              <Picker value={scope} onChange={setScope} options={[{ value: 'all', label: r('campus_all') }, ...campuses.map((c) => ({ value: c.id, label: c.name }))]} />
              {scope !== 'all' ? <Text className="text-xs font-medium text-amber-600">{r('campus_scope_warning')}</Text> : null}
            </CardContent>
          </Card>
        ) : null}

        {previewing ? (
          <LoadingList rows={3} />
        ) : pv ? (
          <View className="gap-3">
            <Card>
              <CardContent className="gap-1 pt-4">
                <View className="flex-row items-center justify-between">
                  <Text className="text-sm font-medium">{r('card_students')}</Text>
                  <Icon as={Users} className="text-muted-foreground size-4" />
                </View>
                <Text className="text-2xl font-bold">{pv.students.total_active}</Text>
                <Text className="text-muted-foreground text-xs">{r('active_students_desc')}</Text>
                <View className="mt-2 flex-row justify-between">
                  <Text className="text-muted-foreground text-sm">{r('graduating')}:</Text>
                  <Text className="text-sm font-medium">{pv.students.graduating}</Text>
                </View>
                {Object.entries(pv.students.by_status ?? {}).map(([k, v]) => (
                  <View key={k} className="flex-row justify-between">
                    <Text className="text-muted-foreground text-sm capitalize">{k}:</Text>
                    <Text className="text-sm font-medium">{String(v)}</Text>
                  </View>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="gap-1 pt-4">
                <View className="flex-row items-center justify-between">
                  <Text className="text-sm font-medium">{r('card_marking_periods')}</Text>
                  <Icon as={Calendar} className="text-muted-foreground size-4" />
                </View>
                <Text className="text-2xl font-bold">{pv.marking_periods.current_year_total}</Text>
                <Text className="text-muted-foreground text-xs">{r('to_be_rolled_over')}</Text>
                {pv.marking_periods.next_year_existing > 0 ? (
                  <View className="mt-2 flex-row gap-2 rounded-md border border-amber-300 bg-amber-50 p-2 dark:border-amber-700 dark:bg-amber-950/30">
                    <Icon as={AlertTriangle} className="size-3.5 text-amber-500" />
                    <Text className="flex-1 text-xs text-amber-800 dark:text-amber-300">{r('marking_periods_exist_warning', { count: pv.marking_periods.next_year_existing, nextYear: next.name })}</Text>
                  </View>
                ) : null}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="gap-1 pt-4">
                <View className="flex-row items-center justify-between">
                  <Text className="text-sm font-medium">{r('card_teacher_assignments')}</Text>
                  <Icon as={UserCheck} className="text-muted-foreground size-4" />
                </View>
                <Text className="text-2xl font-bold">{pv.teachers.current_assignments}</Text>
                <Text className="text-muted-foreground text-xs">{r('teacher_subject_assignments')}</Text>
                <Text className="text-muted-foreground mt-1 text-xs">{r('section_assignments_cleared')}</Text>
              </CardContent>
            </Card>
          </View>
        ) : null}

        <Card>
          <CardContent className="gap-2 pt-4">
            <Text className="font-semibold">{r('card_data_to_roll')}</Text>
            <Text className="text-muted-foreground text-xs">{r('data_to_roll_desc', { current: current.name, next: next.name })}</Text>
            {checklist}
          </CardContent>
        </Card>

        {result?.success ? (
          <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
            <CardContent className="gap-2 pt-4">
              <Text className="font-semibold text-green-900 dark:text-green-300">{r('rollover_complete')}</Text>
              <Text className="text-xs text-green-700">{r('completed_in', { ms: result.duration_ms })}</Text>
              {result.students ? (
                <Text className="text-sm">
                  {r('card_students')}: {r('promoted')} {result.students.promoted} · {r('retained')} {result.students.retained} · {r('graduated')} {result.students.graduated}
                </Text>
              ) : null}
              {result.marking_periods ? <Text className="text-sm">{r('periods_created', { count: result.marking_periods.total })}</Text> : null}
              {result.teachers ? <Text className="text-sm">{r('assignments_rolled', { count: result.teachers.assignments })}</Text> : null}
            </CardContent>
          </Card>
        ) : null}

        <View className="flex-row justify-end gap-2">
          <Button
            variant="outline"
            disabled={executing}
            onPress={() => {
              yearsRes.mutate();
              check.mutate();
              preview.mutate();
            }}>
            <Text>{r('btn_refresh_preview')}</Text>
          </Button>
          <Button onPress={() => setConfirmOpen(true)} disabled={!pc?.is_valid || executing || previewing}>
            <Icon as={TrendingUp} className="text-primary-foreground size-4" />
            <Text>{executing ? r('btn_executing') : r('btn_execute_rollover')}</Text>
          </Button>
        </View>
      </ScrollView>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-h-[90%] w-[94vw] max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center uppercase">{r('confirm_title')}</DialogTitle>
          </DialogHeader>
          <ScrollView className="max-h-[440px]" contentContainerClassName="gap-3">
            <Text className="text-center text-sm font-semibold">{r('confirm_question', { current: current.name })}</Text>
            {checklist}
            <View className="gap-1 border-s-4 border-green-600 bg-green-50 p-3 dark:bg-green-950/30">
              <Text className="text-sm font-bold">{r('note_title')}</Text>
              <Text className="text-muted-foreground text-xs">• {r('note_greyed_desc')}</Text>
              <Text className="text-muted-foreground text-xs">• {r('note_overwrite_desc')}</Text>
            </View>
          </ScrollView>
          <View className="flex-row justify-center gap-3">
            <Button variant="outline" onPress={execute}>
              <Text>{t('common.confirm')}</Text>
            </Button>
            <Button onPress={() => setConfirmOpen(false)}>
              <Text>{t('common.cancel')}</Text>
            </Button>
          </View>
        </DialogContent>
      </Dialog>
    </View>
  );
}
