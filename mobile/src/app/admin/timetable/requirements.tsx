import { ROOM_TYPES, type RoomType, type TimetableRequirement } from '@studently/api-client';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { AlertTriangle, BookOpen, CheckCircle2, DoorOpen, Info, ListChecks, PlayCircle, Settings, Sparkles, Trash2, Wand2 } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { useConfirm } from '@/components/app/confirm';
import { Picker } from '@/components/app/picker';
import { SearchBar } from '@/components/app/search-bar';
import { EmptyState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { CheckRow } from '@/features/admin/attendance';
import { useTeacherOptions } from '@/features/admin/timetable';
import { useAcademicYear } from '@/features/admin/use-academic-year';
import { useCampus } from '@/features/campus/campus';
import { adminAcademics, adminGenerator } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';
import { useResetOn } from '@/lib/use-reset-on';

const ANY = '__any__';
const NONE = '__none__';

/** Periods/week per subject for a section (or a grade without sections); the generator's input (web: /admin/timetable/requirements). */
export default function Requirements() {
  const { t } = useTranslation();
  const q = (k: string, o?: Record<string, unknown>) => t(`app.tr_${k}`, o);
  const typeLabel = (x: RoomType) => t(`app.rm_type_${x}`);
  const toast = useToast();
  const confirm = useConfirm();
  const params = useLocalSearchParams<{ section_id?: string; grade_level_id?: string }>();
  const { campusId } = useCampus();
  const years = useAcademicYear();
  const yearId = years.id;
  const [gradeId, setGradeId] = useState(params.grade_level_id ?? '');
  const [sectionId, setSectionId] = useState(params.section_id ?? '');
  const grades = useApi(['admin', 'grades', campusId ?? 'school'], () => adminAcademics.grades(campusId));
  const gradeList = (grades.data ?? []).filter((g) => g.is_active !== false).sort((x, y) => (x.order_index ?? 0) - (y.order_index ?? 0));
  const allSections = useApi(['admin', 'sections', campusId ?? 'school', 'all'], () => adminAcademics.sections(campusId));
  const sections = (allSections.data ?? []).filter((s) => s.is_active !== false && s.grade_level_id === gradeId);

  // Opened from the generator with ?section_id=: select its grade too.
  const paramSection = params.section_id ?? null;
  const sectionGrade = paramSection ? ((allSections.data ?? []).find((s) => s.id === paramSection)?.grade_level_id ?? null) : null;
  useEffect(() => {
    if (sectionGrade && !gradeId) setGradeId(sectionGrade);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionGrade]);

  const gradeOnly = !!gradeId && !allSections.isLoading && sections.length === 0;
  const scope: { id: string; mode: 'section' | 'grade' } | null = gradeOnly ? { id: gradeId, mode: 'grade' } : sectionId && sections.some((s) => s.id === sectionId) ? { id: sectionId, mode: 'section' } : null;
  const gradeName = gradeList.find((g) => g.id === gradeId)?.name;
  const scopeName = scope?.mode === 'grade' ? gradeName : sections.find((s) => s.id === sectionId)?.name;

  const subjectsRes = useApi(['admin', 'tt-subjects', campusId ?? 'school', gradeId || 'all'], ([, , , g]) => adminAcademics.subjects(campusId, g === 'all' ? undefined : g));
  const subjects = subjectsRes.data ?? [];
  const teachers = useTeacherOptions();
  const scopeKey = scope ? `${scope.mode}:${scope.id}` : null;
  // Scope ids are read back from the key ("section:<id>" / "grade:<id>").
  const reqs = useApi(scope && yearId ? ['admin', 'tt-reqs', yearId, scopeKey] : null, ([, , y, k]) => {
    const [mode, id] = String(k).split(':');
    return adminGenerator.requirements(y, mode === 'section' ? id : undefined, mode === 'grade' ? id : undefined);
  });
  const coverage = useApi(scope && yearId ? ['admin', 'tt-coverage', yearId, scopeKey] : null, ([, , y, k]) => {
    const [mode, id] = String(k).split(':');
    return adminGenerator.coverage(id, y, mode as 'section' | 'grade');
  }, { shouldRetryOnError: false });
  const list = reqs.data ?? [];

  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkPeriods, setBulkPeriods] = useState('');
  const [seeding, setSeeding] = useState(false);
  const [adding, setAdding] = useState(false);
  const [nSubject, setNSubject] = useState('');
  const [nTeacher, setNTeacher] = useState(ANY);
  const [nPeriods, setNPeriods] = useState('5');
  const [nDouble, setNDouble] = useState(false);
  const [nRoom, setNRoom] = useState(NONE);
  const [nGap, setNGap] = useState('0');
  useResetOn(String(scopeKey), () => setSelected(new Set()));

  const term = search.trim().toLowerCase();
  const filtered = term ? list.filter((r) => (r.subject_name || '').toLowerCase().includes(term) || (r.teacher_name || '').toLowerCase().includes(term)) : list;
  const totalRequired = list.reduce((s, r) => s + r.periods_per_week, 0);
  const dupWarnings = useMemo(() => {
    const by = new Map<string, TimetableRequirement[]>();
    for (const r of list) if (r.teacher_id) by.set(r.teacher_id, [...(by.get(r.teacher_id) ?? []), r]);
    return [...by.values()].filter((l) => l.length > 1).map((l) => q(scope?.mode === 'grade' ? 'dup_teacher_grade' : 'dup_teacher_section', { name: l[0].teacher_name || l[0].teacher_id, count: l.length }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list, scope?.mode]);

  const refresh = () => {
    reqs.mutate();
    coverage.mutate();
  };

  async function add() {
    if (!nSubject) return toast.error(q('err_subject'));
    const periods = parseInt(nPeriods, 10);
    if (!periods || periods < 1) return toast.error(q('err_periods'));
    if (!scope || !yearId) return;
    setAdding(true);
    try {
      const r = await adminGenerator.createRequirement({
        academic_year_id: yearId,
        ...(scope.mode === 'section' ? { section_id: scope.id } : { grade_level_id: scope.id }),
        subject_id: nSubject,
        teacher_id: nTeacher === ANY ? null : nTeacher,
        periods_per_week: periods,
        double_period: nDouble,
        preferred_room_type: nRoom === NONE ? null : (nRoom as RoomType),
        min_gap_days: parseInt(nGap, 10) || 0,
      });
      if (!r.success) return toast.error(r.error || q('add_failed'));
      setNSubject('');
      setNTeacher(ANY);
      setNPeriods('5');
      setNDouble(false);
      setNRoom(NONE);
      setNGap('0');
      toast.success(q('added'));
      refresh();
    } finally {
      setAdding(false);
    }
  }

  async function patch(id: string, body: Parameters<typeof adminGenerator.updateRequirement>[1]) {
    reqs.mutate((cur) => cur?.map((r) => (r.id === id ? { ...r, ...body } : r)), { revalidate: false });
    const r = await adminGenerator.updateRequirement(id, body);
    if (!r.success) {
      toast.error(r.error || q('update_failed'));
      return reqs.mutate();
    }
    coverage.mutate();
  }

  async function remove(id: string) {
    if (!(await confirm({ title: q('delete_title'), body: scope?.mode === 'grade' ? q('delete_body_grade') : q('delete_body_section'), confirmLabel: t('common.delete'), destructive: true }))) return;
    const r = await adminGenerator.deleteRequirement(id);
    if (!r.success) return toast.error(r.error || q('delete_failed'));
    toast.success(q('removed'));
    refresh();
  }

  async function seed() {
    if (!yearId) return;
    setSeeding(true);
    try {
      const r = await adminGenerator.seedRequirements(yearId, scope?.mode === 'section' ? scope.id : undefined);
      if (!r.success) return toast.error(r.error || q('seed_failed'));
      toast.success(q('seeded', { count: r.data?.length ?? 0 }));
      refresh();
    } finally {
      setSeeding(false);
    }
  }

  async function bulkSet() {
    const periods = parseInt(bulkPeriods, 10);
    if (!periods || periods < 1) return toast.error(q('err_bulk_periods'));
    const ids = [...selected];
    if (!ids.length) return;
    const results = await Promise.all(ids.map((id) => adminGenerator.updateRequirement(id, { periods_per_week: periods })));
    if (results.some((r) => !r.success)) {
      toast.error(results.find((r) => !r.success)?.error || q('bulk_failed'));
      return refresh();
    }
    toast.success(q('bulk_updated', { count: ids.length }));
    setSelected(new Set());
    setBulkPeriods('');
    refresh();
  }

  const toggleOne = (id: string) =>
    setSelected((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const allChecked = filtered.length > 0 && selected.size === filtered.length;
  const cov = coverage.data;
  const teacherOptions = [{ value: ANY, label: q('any_teacher') }, ...teachers];
  const roomOptions = [{ value: NONE, label: q('any_room') }, ...ROOM_TYPES.map((x) => ({ value: x, label: typeLabel(x) }))];
  const seedBtn = (
    <Button size="sm" variant="outline" onPress={seed} disabled={seeding || !yearId || !scope || gradeOnly}>
      <Icon as={Wand2} className="text-foreground size-4" />
      <Text>{q('seed')}</Text>
    </Button>
  );

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: q('title') }} />
      <ScrollView contentContainerClassName="gap-4 p-4 pb-10" keyboardShouldPersistTaps="handled">
        <Text className="text-muted-foreground text-sm">{q('subtitle')}</Text>
        <View className="flex-row flex-wrap gap-2">
          <Button size="sm" variant="outline" onPress={() => router.push('/admin/timetable/rooms')}>
            <Icon as={DoorOpen} className="text-foreground size-4" />
            <Text>{t('app.tt_rooms')}</Text>
          </Button>
          <Button size="sm" variant="outline" onPress={() => router.push('/admin/timetable/settings')}>
            <Icon as={Settings} className="text-foreground size-4" />
            <Text>{q('constraints')}</Text>
          </Button>
          <Button size="sm" onPress={() => router.push('/admin/timetable/generate')}>
            <Icon as={PlayCircle} className="text-primary-foreground size-4" />
            <Text>{q('generate')}</Text>
          </Button>
        </View>

        <Card>
          <CardContent className="gap-3 pt-4">
            <View className="gap-1">
              <Label>{q('f_year')}</Label>
              <Picker value={yearId ?? ''} onChange={years.pick} placeholder={q('ph_year')} options={years.years.map((y) => ({ value: y.id, label: `${y.name}${y.is_current ? ` ${q('current')}` : ''}` }))} />
            </View>
            <View className="gap-1">
              <Label>{q('f_grade')}</Label>
              <Picker
                value={gradeId}
                onChange={(v) => {
                  setGradeId(v);
                  setSectionId('');
                }}
                placeholder={q('ph_grade')}
                options={gradeList.map((g) => ({ value: g.id, label: g.name }))}
              />
            </View>
            {gradeId && !allSections.isLoading && !gradeOnly ? (
              <View className="gap-1">
                <Label>{q('f_section')}</Label>
                <Picker value={sectionId} onChange={setSectionId} placeholder={q('ph_section')} options={sections.map((s) => ({ value: s.id, label: s.name }))} />
              </View>
            ) : null}
            {gradeOnly ? (
              <View className="flex-row items-center gap-2 rounded-md bg-blue-50 p-2 dark:bg-blue-950/30">
                <Icon as={Info} className="size-4 text-blue-700 dark:text-blue-300" />
                <Text className="flex-1 text-xs text-blue-700 dark:text-blue-300">{q('grade_mode', { grade: gradeName })}</Text>
              </View>
            ) : null}
            <View className="self-start">{seedBtn}</View>
            {gradeOnly ? <Text className="text-muted-foreground text-xs">{q('seed_grade_hint')}</Text> : null}
          </CardContent>
        </Card>

        {grades.isLoading || allSections.isLoading ? (
          <LoadingList />
        ) : !gradeId ? (
          <EmptyState icon={ListChecks} title={q('pick_grade')} body={q('pick_grade_body')} />
        ) : !scope ? (
          <EmptyState icon={ListChecks} title={q('pick_section')} body={q('pick_section_body')} />
        ) : (
          <>
            {cov ? (
              <View className={cn('flex-row items-center gap-2 rounded-md border p-3', cov.is_over_capacity ? 'border-destructive/50 bg-destructive/5' : 'border-green-500/50 bg-green-50 dark:bg-green-950/20')}>
                <Icon as={cov.is_over_capacity ? AlertTriangle : CheckCircle2} className={cov.is_over_capacity ? 'text-destructive size-4' : 'size-4 text-green-600'} />
                <Text className={cn('flex-1 text-sm font-medium', cov.is_over_capacity ? 'text-destructive' : 'text-green-700 dark:text-green-400')}>
                  {q('coverage', { used: cov.required_periods_per_week ?? totalRequired, available: cov.available_periods_per_week, name: scopeName })}
                  {cov.is_over_capacity ? q('over_capacity') : ''}
                </Text>
                <View className={cn('rounded-full px-2 py-0.5', cov.is_over_capacity ? 'bg-destructive' : 'bg-green-600')}>
                  <Text className="text-xs text-white">{q('req_count', { count: cov.requirement_count })}</Text>
                </View>
              </View>
            ) : null}
            {dupWarnings.length ? (
              <View className="gap-1 rounded-md border border-amber-500/50 bg-amber-50 p-3 dark:bg-amber-950/20">
                {dupWarnings.map((w) => (
                  <Text key={w} className="text-sm text-amber-800 dark:text-amber-400">
                    {w}
                  </Text>
                ))}
              </View>
            ) : null}

            <Card>
              <CardContent className="gap-3 pt-4">
                <Text className="font-semibold">{q('add_title')}</Text>
                <Text className="text-muted-foreground text-xs">
                  {q('add_desc', { name: scopeName })}
                  {gradeOnly ? ` ${q('grade_level_tag')}` : ''}
                </Text>
                <View className="gap-1">
                  <Label>{q('f_subject')} *</Label>
                  <Picker value={nSubject} onChange={setNSubject} placeholder={q('f_subject')} options={subjects.map((s) => ({ value: s.id, label: `${s.name}${s.code ? ` (${s.code})` : ''}` }))} />
                </View>
                <View className="gap-1">
                  <Label>{q('f_teacher')}</Label>
                  <Picker value={nTeacher} onChange={setNTeacher} options={teacherOptions} />
                </View>
                <View className="flex-row gap-2">
                  <View className="flex-1 gap-1">
                    <Label>{q('f_periods')} *</Label>
                    <Input value={nPeriods} onChangeText={(v) => setNPeriods(v.replace(/\D/g, ''))} keyboardType="number-pad" />
                  </View>
                  <View className="flex-1 gap-1">
                    <Label>{q('f_gap')}</Label>
                    <Input value={nGap} onChangeText={(v) => setNGap(v.replace(/\D/g, ''))} keyboardType="number-pad" />
                  </View>
                </View>
                <View className="gap-1">
                  <Label>{q('f_room_type')}</Label>
                  <Picker value={nRoom} onChange={setNRoom} options={roomOptions} />
                </View>
                <View className="flex-row items-center gap-3">
                  <Switch checked={nDouble} onCheckedChange={setNDouble} />
                  <Label className="flex-1" onPress={() => setNDouble(!nDouble)}>
                    {q('f_double')}
                  </Label>
                </View>
                <Button onPress={add} disabled={adding} className="self-end">
                  <Icon as={Sparkles} className="text-primary-foreground size-4" />
                  <Text>{q('add_btn')}</Text>
                </Button>
              </CardContent>
            </Card>

            <View className="gap-2">
              <Text className="font-semibold">{q('list_title', { count: filtered.length })}</Text>
              <SearchBar value={search} onChangeText={setSearch} placeholder={q('search_ph')} />
              {filtered.length ? <CheckRow checked={allChecked} onPress={() => setSelected(allChecked ? new Set() : new Set(filtered.map((r) => r.id)))} label={q('select_all')} /> : null}
              {selected.size ? (
                <View className="flex-row items-center gap-2">
                  <Input className="w-28" value={bulkPeriods} onChangeText={(v) => setBulkPeriods(v.replace(/\D/g, ''))} keyboardType="number-pad" placeholder={q('f_periods')} />
                  <Button size="sm" variant="outline" onPress={bulkSet}>
                    <Text>{q('bulk_set', { count: selected.size })}</Text>
                  </Button>
                </View>
              ) : null}
            </View>
            {reqs.isLoading ? (
              <LoadingList />
            ) : list.length === 0 ? (
              <Card>
                <CardContent className="items-center gap-3 py-8">
                  <Icon as={BookOpen} className="text-muted-foreground/40 size-12" />
                  <Text className="text-muted-foreground text-center font-medium">{q('empty_title', { name: scopeName })}</Text>
                  <Text className="text-muted-foreground text-center text-sm">{gradeOnly ? q('empty_body_grade') : q('empty_body_section')}</Text>
                  <Button onPress={seed} disabled={seeding}>
                    <Icon as={Wand2} className="text-primary-foreground size-4" />
                    <Text>{q('seed')}</Text>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              filtered.map((r) => <RequirementCard key={r.id} req={r} checked={selected.has(r.id)} onCheck={() => toggleOne(r.id)} teacherOptions={teacherOptions} roomOptions={roomOptions} onPatch={(b) => patch(r.id, b)} onDelete={() => remove(r.id)} />)
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function RequirementCard({
  req,
  checked,
  onCheck,
  teacherOptions,
  roomOptions,
  onPatch,
  onDelete,
}: {
  req: TimetableRequirement;
  checked: boolean;
  onCheck: () => void;
  teacherOptions: { value: string; label: string }[];
  roomOptions: { value: string; label: string }[];
  onPatch: (b: Parameters<typeof adminGenerator.updateRequirement>[1]) => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const q = (k: string) => t(`app.tr_${k}`);
  const [periods, setPeriods] = useState(String(req.periods_per_week));
  const [gap, setGap] = useState(String(req.min_gap_days));
  useEffect(() => setPeriods(String(req.periods_per_week)), [req.periods_per_week]);
  useEffect(() => setGap(String(req.min_gap_days)), [req.min_gap_days]);
  return (
    <Card className={cn(!req.is_active && 'opacity-60')}>
      <CardContent className="gap-3 pt-4">
        <View className="flex-row items-center gap-2">
          <CheckRow checked={checked} onPress={onCheck} label="" />
          <Text className="flex-1 font-medium" numberOfLines={1}>
            {req.subject_name || req.subject_id}
            {req.subject_code ? <Text className="text-muted-foreground text-xs"> ({req.subject_code})</Text> : null}
          </Text>
          <Button size="icon" variant="ghost" onPress={onDelete} accessibilityLabel={t('common.delete')}>
            <Icon as={Trash2} className="text-destructive size-4" />
          </Button>
        </View>
        <View className="gap-1">
          <Label>{q('f_teacher')}</Label>
          <Picker value={req.teacher_id ?? ANY} onChange={(v) => onPatch({ teacher_id: v === ANY ? null : v })} options={teacherOptions} />
        </View>
        <View className="flex-row gap-2">
          <View className="flex-1 gap-1">
            <Label>{q('f_periods')}</Label>
            <Input
              value={periods}
              keyboardType="number-pad"
              onChangeText={(v) => setPeriods(v.replace(/\D/g, ''))}
              onBlur={() => {
                const n = parseInt(periods, 10);
                if (n && n >= 1 && n !== req.periods_per_week) onPatch({ periods_per_week: n });
                else setPeriods(String(req.periods_per_week));
              }}
            />
          </View>
          <View className="flex-1 gap-1">
            <Label>{q('f_gap')}</Label>
            <Input
              value={gap}
              keyboardType="number-pad"
              onChangeText={(v) => setGap(v.replace(/\D/g, ''))}
              onBlur={() => {
                const n = parseInt(gap, 10) || 0;
                if (n !== req.min_gap_days) onPatch({ min_gap_days: n });
              }}
            />
          </View>
        </View>
        <View className="gap-1">
          <Label>{q('f_room_type')}</Label>
          <Picker value={req.preferred_room_type ?? NONE} onChange={(v) => onPatch({ preferred_room_type: v === NONE ? null : (v as RoomType) })} options={roomOptions} />
        </View>
        <View className="flex-row flex-wrap gap-5">
          <View className="flex-row items-center gap-2">
            <Switch checked={req.double_period} onCheckedChange={(v) => onPatch({ double_period: v })} />
            <Text className="text-sm">{q('double')}</Text>
          </View>
          <View className="flex-row items-center gap-2">
            <Switch checked={req.is_active} onCheckedChange={(v) => onPatch({ is_active: v })} />
            <Text className="text-sm">{t('common.active')}</Text>
          </View>
        </View>
      </CardContent>
    </Card>
  );
}
