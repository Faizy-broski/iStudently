import type { GenerationSettings } from '@studently/api-client';
import { Stack } from 'expo-router';
import { Save, SlidersHorizontal } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { Picker } from '@/components/app/picker';
import { SearchBar } from '@/components/app/search-bar';
import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { useTeacherOptions } from '@/features/admin/timetable';
import { useAcademicYear } from '@/features/admin/use-academic-year';
import { useCampus } from '@/features/campus/campus';
import { adminGenerator } from '@/lib/api';
import { useApi } from '@/lib/data';

type NumKey = Exclude<keyof GenerationSettings, 'id' | 'academic_year_id'>;
const WEIGHTS: NumKey[] = ['weight_teacher_availability_preferred', 'weight_gap_violation', 'weight_daily_load_violation', 'weight_double_period_broken', 'weight_frequency_spread'];
type ConstraintKey = 'max_periods_per_day' | 'max_periods_per_week' | 'min_gap_between_periods' | 'max_consecutive_periods';

/** Solver defaults + soft-constraint weights, and per-teacher load limits (web: /admin/timetable/settings). */
export default function GeneratorSettings() {
  const { t } = useTranslation();
  const g = (k: string, o?: Record<string, unknown>) => t(`app.tgs_${k}`, o);
  const toast = useToast();
  const { campusId } = useCampus();
  const years = useAcademicYear();
  const yearId = years.id;
  const settingsRes = useApi(yearId ? ['admin', 'tt-gen-settings', yearId, campusId ?? 'school'] : null, ([, , y]) => adminGenerator.settings(y, campusId));
  const constraintsRes = useApi(yearId ? ['admin', 'tt-constraints', yearId] : null, ([, , y]) => adminGenerator.teacherConstraints(y));
  const teachers = useTeacherOptions();
  const [form, setForm] = useState<Record<NumKey, string> | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [savingTeacher, setSavingTeacher] = useState<string | null>(null);

  const loaded = settingsRes.data ?? null;
  const loadedKey = loaded ? `${loaded.id}:${loaded.academic_year_id}` : null;
  useEffect(() => {
    if (!loaded) return setForm(null);
    setForm({
      default_max_periods_per_day: String(loaded.default_max_periods_per_day),
      default_min_gap_between_periods: String(loaded.default_min_gap_between_periods),
      solver_time_limit_seconds: String(loaded.solver_time_limit_seconds),
      weight_teacher_availability_preferred: String(loaded.weight_teacher_availability_preferred),
      weight_gap_violation: String(loaded.weight_gap_violation),
      weight_daily_load_violation: String(loaded.weight_daily_load_violation),
      weight_double_period_broken: String(loaded.weight_double_period_broken),
      weight_frequency_spread: String(loaded.weight_frequency_spread),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedKey]);

  async function save() {
    if (!form || !yearId) return;
    setSaving(true);
    try {
      const n = (k: NumKey, fallback: number) => parseInt(form[k], 10) || fallback;
      const r = await adminGenerator.updateSettings({
        campus_id: campusId,
        academic_year_id: yearId,
        default_max_periods_per_day: n('default_max_periods_per_day', 1),
        default_min_gap_between_periods: parseInt(form.default_min_gap_between_periods, 10) || 0,
        solver_time_limit_seconds: Math.min(600, n('solver_time_limit_seconds', 60)),
        ...Object.fromEntries(WEIGHTS.map((k) => [k, parseInt(form[k], 10) || 0])),
      });
      if (!r.success) return toast.error(r.error || g('save_failed'));
      toast.success(g('saved'));
      settingsRes.mutate();
    } finally {
      setSaving(false);
    }
  }

  const byTeacher = new Map((constraintsRes.data ?? []).map((c) => [c.teacher_id, c]));
  const q = search.trim().toLowerCase();
  const rows = teachers
    .map((tc) => {
      const c = byTeacher.get(tc.value);
      return { teacherId: tc.value, name: tc.label, max_periods_per_day: c?.max_periods_per_day ?? null, max_periods_per_week: c?.max_periods_per_week ?? null, min_gap_between_periods: c?.min_gap_between_periods ?? 0, max_consecutive_periods: c?.max_consecutive_periods ?? null };
    })
    .filter((r) => !q || r.name.toLowerCase().includes(q));

  async function saveConstraint(teacherId: string, patch: Partial<Record<ConstraintKey, number | null>>) {
    if (!yearId) return;
    const cur = rows.find((r) => r.teacherId === teacherId);
    setSavingTeacher(teacherId);
    try {
      const r = await adminGenerator.upsertTeacherConstraint(teacherId, {
        teacher_id: teacherId,
        campus_id: campusId,
        academic_year_id: yearId,
        max_periods_per_day: cur?.max_periods_per_day ?? null,
        max_periods_per_week: cur?.max_periods_per_week ?? null,
        min_gap_between_periods: cur?.min_gap_between_periods ?? 0,
        max_consecutive_periods: cur?.max_consecutive_periods ?? null,
        ...patch,
        ...(patch.min_gap_between_periods === null ? { min_gap_between_periods: 0 } : {}),
      } as Parameters<typeof adminGenerator.upsertTeacherConstraint>[1]);
      if (!r.success) return toast.error(r.error || g('teacher_save_failed'));
      toast.success(g('teacher_saved'));
      constraintsRes.mutate();
    } finally {
      setSavingTeacher(null);
    }
  }

  const numField = (k: NumKey, label: string) => (
    <View key={k} className="min-w-[45%] flex-1 gap-1">
      <Label className="text-xs">{label}</Label>
      <Input value={form?.[k] ?? ''} keyboardType="number-pad" onChangeText={(v) => setForm((f) => (f ? { ...f, [k]: v.replace(/\D/g, '') } : f))} />
    </View>
  );

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: g('title') }} />
      <ScrollView contentContainerClassName="gap-4 p-4 pb-10" keyboardShouldPersistTaps="handled">
        <Text className="text-muted-foreground text-sm">{g('subtitle')}</Text>
        <View className="gap-1">
          <Label>{t('app.tr_f_year')}</Label>
          <Picker value={yearId ?? ''} onChange={years.pick} placeholder={t('app.tr_ph_year')} options={years.years.map((y) => ({ value: y.id, label: `${y.name}${y.is_current ? ` ${t('app.tr_current')}` : ''}` }))} />
        </View>

        <Card>
          <CardContent className="gap-3 pt-4">
            <View className="flex-row items-center gap-2">
              <Icon as={SlidersHorizontal} className="text-foreground size-4" />
              <Text className="font-semibold">{g('global_title')}</Text>
            </View>
            <Text className="text-muted-foreground text-xs">{g('global_desc')}</Text>
            {settingsRes.isLoading || !form ? (
              <LoadingList rows={3} />
            ) : (
              <>
                <View className="flex-row flex-wrap gap-3">
                  {numField('default_max_periods_per_day', g('f_max_day'))}
                  {numField('default_min_gap_between_periods', g('f_min_gap'))}
                  {numField('solver_time_limit_seconds', g('f_time_limit'))}
                </View>
                <Separator />
                <Text className="text-sm font-medium">{g('weights_title')}</Text>
                <Text className="text-muted-foreground text-xs">{g('weights_desc')}</Text>
                <View className="flex-row flex-wrap gap-3">{WEIGHTS.map((k) => numField(k, g(`w_${k}`)))}</View>
                <Button onPress={save} disabled={saving} className="self-end">
                  <Icon as={Save} className="text-primary-foreground size-4" />
                  <Text>{g('save_btn')}</Text>
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="gap-3 pt-4">
            <Text className="font-semibold">{g('teachers_title')}</Text>
            <Text className="text-muted-foreground text-xs">{g('teachers_desc')}</Text>
            <SearchBar value={search} onChangeText={setSearch} placeholder={g('search_ph')} />
            {constraintsRes.isLoading ? (
              <LoadingList rows={3} />
            ) : rows.length === 0 ? (
              <Text className="text-muted-foreground py-4 text-center text-sm">{g('no_teachers')}</Text>
            ) : (
              rows.map((r, i) => (
                <View key={r.teacherId} className="gap-2">
                  {i > 0 ? <Separator /> : null}
                  <Text className="font-medium">
                    {r.name}
                    {savingTeacher === r.teacherId ? <Text className="text-muted-foreground text-xs"> · {g('saving')}</Text> : null}
                  </Text>
                  <View className="flex-row gap-2">
                    <ConstraintInput label={g('c_max_day')} value={r.max_periods_per_day} nullable onCommit={(v) => saveConstraint(r.teacherId, { max_periods_per_day: v })} />
                    <ConstraintInput label={g('c_max_week')} value={r.max_periods_per_week} nullable onCommit={(v) => saveConstraint(r.teacherId, { max_periods_per_week: v })} />
                  </View>
                  <View className="flex-row gap-2">
                    <ConstraintInput label={g('c_min_gap')} value={r.min_gap_between_periods} onCommit={(v) => saveConstraint(r.teacherId, { min_gap_between_periods: v ?? 0 })} />
                    <ConstraintInput label={g('c_max_consecutive')} value={r.max_consecutive_periods} nullable onCommit={(v) => saveConstraint(r.teacherId, { max_consecutive_periods: v })} />
                  </View>
                </View>
              ))
            )}
          </CardContent>
        </Card>
      </ScrollView>
    </View>
  );
}

/** Saves on blur when the value changed; empty = "Default" (null) for nullable limits (web: onBlur inputs). */
function ConstraintInput({ label, value, nullable, onCommit }: { label: string; value: number | null; nullable?: boolean; onCommit: (v: number | null) => void }) {
  const { t } = useTranslation();
  const [text, setText] = useState(value == null ? '' : String(value));
  useEffect(() => setText(value == null ? '' : String(value)), [value]);
  return (
    <View className="flex-1 gap-1">
      <Label className="text-xs">{label}</Label>
      <Input
        value={text}
        keyboardType="number-pad"
        placeholder={nullable ? t('app.tgs_default') : '0'}
        onChangeText={(v) => setText(v.replace(/\D/g, ''))}
        onBlur={() => {
          const next = text === '' ? (nullable ? null : 0) : parseInt(text, 10);
          if (next !== value) onCommit(next);
        }}
      />
    </View>
  );
}
