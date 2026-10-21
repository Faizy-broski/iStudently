import type { GradebookConfig, GroupedMarkingPeriods, MarkingPeriod } from '@studently/api-client';
import { Stack } from 'expo-router';
import { Save } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { KeyboardAvoidingView, ScrollView } from '@/components/app/keyboard';
import { Picker } from '@/components/app/picker';
import { ErrorState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { CheckRow } from '@/features/admin/report-students';
import { useCampus } from '@/features/campus/campus';
import { adminGrades } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

type Sort = GradebookConfig['assignment_sorting'];
const bySort = (a: MarkingPeriod, b: MarkingPeriod) => (a.sort_order ?? 0) - (b.sort_order ?? 0);

function Form({ config, periods }: { config: GradebookConfig; periods: GroupedMarkingPeriods | null }) {
  const { t } = useTranslation();
  const s = (k: string) => t(`school.grades_module.configuration.${k}`);
  const toast = useToast();
  const { campusId } = useCampus();
  const [sorting, setSorting] = useState<Sort>(config.assignment_sorting || 'due_date');
  const [flags, setFlags] = useState({
    auto: config.auto_save_final_grades ?? true,
    weight: config.weight_assignment_types ?? true,
    weightAssignments: config.weight_assignments ?? true,
    assigned: config.default_assigned_date ?? true,
    due: config.default_due_date ?? true,
    hideLetter: config.hide_letter_grades ?? false,
    hidePrev: config.hide_prev_quarters ?? false,
    eligibility: config.eligibility_cumulative ?? false,
  });
  const [anomalous, setAnomalous] = useState(String(config.anomalous_max ?? 100));
  const [latency, setLatency] = useState(config.latency != null ? String(config.latency) : '');
  const [weights, setWeights] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(config).filter(([k]) => k.startsWith('SEM-') || k.startsWith('FY-')).map(([k, v]) => [k, String(v ?? '')])),
  );
  const [saving, setSaving] = useState(false);
  const flag = (k: keyof typeof flags) => (v: boolean) => setFlags({ ...flags, [k]: v });
  const total = (keys: string[]) => keys.reduce((sum, k) => sum + (parseFloat(weights[k] || '0') || 0), 0);

  const sems = [...(periods?.SEM ?? [])].sort(bySort);
  const gradedSems = sems.filter((x) => x.does_grades);
  const qtrsOf = (semId: string) => (periods?.QTR ?? []).filter((q) => q.parent_id === semId).sort(bySort);
  const fy = periods?.FY?.[0];
  const semKeys = gradedSems.flatMap((sem) => qtrsOf(sem.id).map((q) => `SEM-${q.id}`));
  const fyCols = fy?.does_grades ? sems.flatMap((sem) => [...qtrsOf(sem.id).map((q) => ({ key: `FY-${q.id}`, mp: q })), ...(sem.does_grades ? [{ key: `FY-${sem.id}`, mp: sem }] : [])]) : [];

  async function save() {
    if (semKeys.length && Math.abs(total(semKeys) - 100) > 0.01) return toast.error(s('total_error'));
    if (fy?.does_grades && Math.abs(total(fyCols.map((c) => c.key)) - 100) > 0.01) return toast.error(`"${fy.title}" — ${s('total_error')}`);
    const yn = (v: boolean) => (v ? 'Y' : 'N');
    const configs = [
      { key: 'ASSIGNMENT_SORTING', value: sorting },
      { key: 'AUTO_SAVE_FINAL_GRADES', value: yn(flags.auto) },
      { key: 'WEIGHT', value: yn(flags.weight) },
      { key: 'WEIGHT_ASSIGNMENTS', value: yn(flags.weightAssignments) },
      { key: 'DEFAULT_ASSIGNED', value: yn(flags.assigned) },
      { key: 'DEFAULT_DUE', value: yn(flags.due) },
      { key: 'LETTER_GRADE_ALL', value: yn(flags.hideLetter) },
      { key: 'HIDE_PREVIOUS_ASSIGNMENT_TYPES', value: yn(flags.hidePrev) },
      { key: 'ANOMALOUS_MAX', value: anomalous || '100' },
      { key: 'ELIGIBILITY_CUMULITIVE', value: yn(flags.eligibility) },
      ...(latency ? [{ key: 'LATENCY', value: latency }] : []),
      ...Object.entries(weights)
        .filter(([, v]) => v !== '')
        .map(([key, value]) => ({ key, value })),
    ];
    setSaving(true);
    try {
      const r = await adminGrades.saveGradebookConfigBatch(configs, campusId);
      if (!r.success) return toast.error(r.error || s('config_save_failed'));
      toast.success(s('config_saved'));
    } finally {
      setSaving(false);
    }
  }

  const totalBadge = (keys: string[]) => {
    const sum = total(keys);
    const ok = Math.abs(sum - 100) < 0.01;
    return <Text className={cn('text-sm font-semibold', ok ? 'text-success' : 'text-destructive')}>{ok ? s('total_ok') : `${s('total_label')} = ${sum.toFixed(1)}% — ${s('total_error')}`}</Text>;
  };
  const pct = (key: string, label: string, tag?: string) => (
    <View key={key} className="w-[30%] gap-1">
      <Text className="text-muted-foreground text-xs" numberOfLines={1}>
        {label}
        {tag ? ` (${tag})` : ''}
      </Text>
      <View className="flex-row items-center gap-1">
        <Input value={weights[key] ?? ''} onChangeText={(v) => setWeights({ ...weights, [key]: v.replace(/[^0-9.]/g, '') })} keyboardType="decimal-pad" className="h-9 flex-1 text-center" />
        <Text className="text-muted-foreground text-sm">%</Text>
      </View>
    </View>
  );

  return (
    <>
      <Card>
        <CardContent className="gap-2 pt-4">
          <Text className="text-sm font-semibold">{s('assignments_section')}</Text>
          <Label>{s('sort_by')}</Label>
          <Picker
            value={sorting}
            onChange={(v) => setSorting(v as Sort)}
            options={(['due_date', 'assigned_date', 'title', 'points'] as const).map((v) => ({ value: v, label: s(`sort_${v}`) }))}
          />
          <CheckRow label={s('auto_save_final')} value={flags.auto} onChange={flag('auto')} />
          <CheckRow label={s('weight_types')} value={flags.weight} onChange={flag('weight')} />
          <CheckRow label={s('weight_assignments')} value={flags.weightAssignments} onChange={flag('weightAssignments')} />
          <CheckRow label={s('default_assigned_today')} value={flags.assigned} onChange={flag('assigned')} />
          <CheckRow label={s('default_due_today')} value={flags.due} onChange={flag('due')} />
          <CheckRow label={s('hide_letter_grades')} value={flags.hideLetter} onChange={flag('hideLetter')} />
          <CheckRow label={s('hide_prev_quarters')} value={flags.hidePrev} onChange={flag('hidePrev')} />
          <Label>{s('anomalous_max')}</Label>
          <Input value={anomalous} onChangeText={setAnomalous} keyboardType="number-pad" />
          <Text className="text-muted-foreground text-xs">{s('anomalous_max_help')}</Text>
          <Label>{s('latency')}</Label>
          <Input value={latency} onChangeText={(v) => setLatency(v.replace(/\D/g, ''))} keyboardType="number-pad" placeholder={s('latency_none')} />
          <Text className="text-muted-foreground text-xs">{s('latency_help')}</Text>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="gap-2 pt-4">
          <Text className="text-sm font-semibold">{s('eligibility_section')}</Text>
          <CheckRow label={s('eligibility_cumulative')} value={flags.eligibility} onChange={flag('eligibility')} />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="gap-3 pt-4">
          <Text className="text-sm font-semibold">{s('final_grading_section')}</Text>
          <Text className="text-muted-foreground text-xs">{s('final_grading_help')}</Text>
          {!gradedSems.length && !fy?.does_grades ? <Text className="text-muted-foreground text-sm italic">{s('no_graded_periods')}</Text> : null}
          {gradedSems.length ? (
            <View className="border-info-soft dark:border-border gap-3 rounded-xl border p-3">
              <View className="gap-1">
                <Text className="text-sm font-semibold">{gradedSems.map((x) => x.title).join(' + ')}</Text>
                {semKeys.length ? totalBadge(semKeys) : null}
              </View>
              {gradedSems.map((sem) => {
                const qtrs = qtrsOf(sem.id);
                return (
                  <View key={sem.id} className="gap-2">
                    <Text className="text-muted-foreground text-xs font-medium">{sem.title}</Text>
                    {qtrs.length ? <View className="flex-row flex-wrap gap-3">{qtrs.map((q) => pct(`SEM-${q.id}`, q.title))}</View> : <Text className="text-muted-foreground text-xs">{s('no_quarters')}</Text>}
                  </View>
                );
              })}
            </View>
          ) : null}
          {fy?.does_grades ? (
            <View className="gap-3 rounded-xl border border-info-soft bg-info-soft p-3">
              <View className="gap-1">
                <Text className="text-sm font-semibold">{fy.title}</Text>
                {fyCols.length ? totalBadge(fyCols.map((c) => c.key)) : null}
              </View>
              <View className="flex-row flex-wrap gap-3">{fyCols.map((c) => pct(c.key, c.mp.title, c.mp.mp_type === 'SEM' ? 'SEM' : undefined))}</View>
            </View>
          ) : null}
        </CardContent>
      </Card>
      <Button onPress={save} disabled={saving}>
        <Icon as={Save} className="text-primary-foreground size-4" />
        <Text>{t('common.save')}</Text>
      </Button>
    </>
  );
}

/** Gradebook settings and final grading percentages (web: /admin/grades/configuration). */
export default function GradebookConfiguration() {
  const { t } = useTranslation();
  const s = (k: string) => t(`school.grades_module.configuration.${k}`);
  const { campusId } = useCampus();
  const config = useApi(['admin', 'gradebook-config', campusId ?? 'school'], () => adminGrades.gradebookConfig(campusId));
  const periods = useApi(['admin', 'mp-grouped', campusId ?? 'school'], () => adminGrades.markingPeriodsGrouped(campusId));
  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: s('title') }} />
      <KeyboardAvoidingView className="flex-1">
        <ScrollView contentContainerClassName="gap-3 p-4 pb-10" keyboardShouldPersistTaps="handled">
          <Text className="text-muted-foreground text-sm">{s('subtitle')}</Text>
          {config.isLoading || periods.isLoading ? (
            <LoadingList rows={6} />
          ) : config.error || !config.data ? (
            <ErrorState message={config.error?.message} onRetry={() => config.mutate()} />
          ) : (
            <Form key={campusId ?? 'school'} config={config.data} periods={periods.data ?? null} />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
