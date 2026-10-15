import { Stack } from 'expo-router';
import { Save } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { FilterChips } from '@/components/app/filter-chips';
import { Picker } from '@/components/app/picker';
import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { usePortalAcademic } from '@/features/portal/academic';
import { teacher } from '@/lib/api';
import { useApi } from '@/lib/data';

const SORTS = ['due_date', 'assigned_date', 'title', 'points'] as const;
type Sort = (typeof SORTS)[number];
type Config = { assignment_sorting: Sort; weight_assignment_types: boolean; weight_assignments: boolean; default_assigned_date: boolean; default_due_date: boolean; anomalous_max: string; latency: string };

/** Parse the stored key → string values like the web hook (useTeacherGradebookConfig). */
function parse(raw: Record<string, string>): Config {
  return {
    assignment_sorting: (SORTS as readonly string[]).includes(raw.assignment_sorting) ? (raw.assignment_sorting as Sort) : 'due_date',
    weight_assignment_types: raw.weight_assignment_types !== 'false',
    weight_assignments: raw.weight_assignments !== 'false',
    default_assigned_date: raw.default_assigned_date !== 'false',
    default_due_date: raw.default_due_date !== 'false',
    anomalous_max: String(parseInt(raw.anomalous_max ?? '100', 10) || 100),
    latency: raw.latency != null && raw.latency !== '' ? String(parseInt(raw.latency, 10)) : '',
  };
}

/** Gradebook defaults overridden for one of the teacher's course periods (web: /teacher/grades/configuration). */
export default function TeacherGradebookConfiguration() {
  const { t } = useTranslation();
  const k = (key: string) => t(`teacherPages.gradesConfiguration.${key}`);
  const toast = useToast();
  const academic = usePortalAcademic();
  const [cpId, setCpId] = useState('');
  const config = useApi(cpId ? ['teacher', 'gb-config', cpId] : null, ([, , c]) => teacher.gradebookConfig(c as string));
  const [edit, setEdit] = useState<{ cp: string; value: Config } | null>(null);
  const [saving, setSaving] = useState(false);
  const loaded = config.data ? parse(config.data) : null;
  const form = edit && edit.cp === cpId ? edit.value : loaded;
  const dirty = !!edit && edit.cp === cpId;
  const set = (patch: Partial<Config>) => form && setEdit({ cp: cpId, value: { ...form, ...patch } });
  const cp = academic.coursePeriods.find((c) => c.id === cpId) ?? null;

  async function save() {
    if (!cpId || !form) return;
    setSaving(true);
    try {
      const values: [string, string][] = [
        ['assignment_sorting', form.assignment_sorting],
        ['weight_assignment_types', String(form.weight_assignment_types)],
        ['weight_assignments', String(form.weight_assignments)],
        ['default_assigned_date', String(form.default_assigned_date)],
        ['default_due_date', String(form.default_due_date)],
        ['anomalous_max', String(parseInt(form.anomalous_max, 10) || 100)],
        ['latency', form.latency ? String(parseInt(form.latency, 10)) : 'null'],
      ];
      for (const [key, value] of values) {
        const r = await teacher.saveGradebookConfig(cpId, key, value);
        if (!r.success) throw new Error(r.error || k('saveFailed'));
      }
      toast.success(k('saveSuccess'));
      setEdit(null);
      config.mutate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : k('saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: k('pageTitle') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" keyboardShouldPersistTaps="handled">
        <Text variant="muted">{k('pageSubtitle')}</Text>
        <Card>
          <CardHeader>
            <CardTitle>{k('coursePeriodOverride')}</CardTitle>
          </CardHeader>
          <CardContent className="gap-3">
            <View className="gap-1.5">
              <Label>{k('coursePeriod')}</Label>
              <Picker
                value={cpId || null}
                onChange={setCpId}
                placeholder={academic.coursePeriods.length ? k('selectCoursePeriod') : k('noCoursePeriodsAvailable')}
                options={academic.coursePeriods.map((c) => ({ value: c.id, label: `${c.short_name || c.title || k('coursePeriod')}${c.section?.name ? ` — ${c.section.name}` : ''}` }))}
              />
            </View>
            <View className="bg-muted/50 rounded-lg p-3">
              <Text className="text-sm font-medium">{k('selected')}</Text>
              <Text className="text-muted-foreground mt-1 text-sm">{cp ? cp.short_name || cp.title : k('chooseCoursePeriodHint')}</Text>
            </View>
            {config.error ? <Text className="text-sm text-red-500">{config.error.message}</Text> : null}
          </CardContent>
        </Card>
        {cpId && config.isLoading ? <LoadingList rows={4} /> : null}
        {form ? (
          <Card>
            <CardHeader>
              <CardTitle>{k('gradebookDefaults')}</CardTitle>
            </CardHeader>
            <CardContent className="gap-4">
              <View className="gap-1.5">
                <Label>{k('sortAssignmentsBy')}</Label>
                <FilterChips<Sort> value={form.assignment_sorting} onChange={(v) => set({ assignment_sorting: v })} options={SORTS.map((s) => ({ value: s, label: k(`sortOption_${s}`) }))} />
              </View>
              <Row label={k('weightAssignmentTypes')} value={form.weight_assignment_types} onChange={(v) => set({ weight_assignment_types: v })} />
              <Row label={k('weightAssignments')} value={form.weight_assignments} onChange={(v) => set({ weight_assignments: v })} />
              <Row label={k('defaultAssignedDate')} value={form.default_assigned_date} onChange={(v) => set({ default_assigned_date: v })} />
              <Row label={k('defaultDueDate')} value={form.default_due_date} onChange={(v) => set({ default_due_date: v })} />
              <View className="gap-1.5">
                <Label>{k('anomalousMaxPoints')}</Label>
                <Input value={form.anomalous_max} onChangeText={(v) => set({ anomalous_max: v.replace(/[^0-9]/g, '') })} keyboardType="number-pad" />
                <Text className="text-muted-foreground text-xs">{k('anomalousMaxHint')}</Text>
              </View>
              <View className="gap-1.5">
                <Label>{k('latencyMinutes')}</Label>
                <Input value={form.latency} onChangeText={(v) => set({ latency: v.replace(/[^0-9]/g, '') })} keyboardType="number-pad" placeholder={k('none')} />
                <Text className="text-muted-foreground text-xs">{k('latencyHint')}</Text>
              </View>
              <Button className="bg-[#0369a1]" onPress={save} disabled={saving || !dirty}>
                <Icon as={Save} className="size-4 text-white" />
                <Text className="text-white">{k('saveOverride')}</Text>
              </Button>
            </CardContent>
          </Card>
        ) : null}
      </ScrollView>
    </>
  );
}

function Row({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View className="flex-row items-center gap-3">
      <Switch checked={value} onCheckedChange={onChange} />
      <Text className="flex-1 text-sm">{label}</Text>
    </View>
  );
}
