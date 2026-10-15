import { HISTORY_MP_TYPES, historySchoolYears, type HistoryMarkingPeriod, type HistoryMPType } from '@studently/api-client';
import { Stack } from 'expo-router';
import { Plus, Save, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';

import { DateField } from '@/components/app/date-field';
import { Picker } from '@/components/app/picker';
import { ErrorState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { useCampus } from '@/features/campus/campus';
import { adminHistoricalGrades } from '@/lib/api';
import { useApi } from '@/lib/data';

type Row = HistoryMarkingPeriod & { _dirty?: boolean; _isNew?: boolean; _deleted?: boolean };
type Fields = Pick<Row, 'mp_type' | 'name' | 'short_name' | 'post_end_date' | 'school_year'>;
const YEARS = historySchoolYears();

function RowFields({ value, onChange }: { value: Fields; onChange: (patch: Partial<Fields>) => void }) {
  const { t } = useTranslation();
  const h = (k: string) => t(`school.grades_module.history_marking_periods.${k}`);
  return (
    <View className="gap-2">
      <View className="flex-row gap-2">
        <View className="flex-1 gap-1">
          <Label>{h('th_type')}</Label>
          <Picker value={value.mp_type} onChange={(v) => onChange({ mp_type: v as HistoryMPType })} options={HISTORY_MP_TYPES.map((x) => ({ value: x, label: h(`mp_type_${x}`) }))} />
        </View>
        <View className="flex-1 gap-1">
          <Label>{h('th_school_year')}</Label>
          <Picker value={value.school_year || ''} onChange={(v) => onChange({ school_year: v })} placeholder={h('select_placeholder')} options={YEARS.map((y) => ({ value: y, label: y }))} />
        </View>
      </View>
      <View className="flex-row gap-2">
        <View className="flex-[2] gap-1">
          <Label>{h('th_name')}</Label>
          <Input value={value.name} onChangeText={(v) => onChange({ name: v })} placeholder={h('period_name_placeholder')} />
        </View>
        <View className="flex-1 gap-1">
          <Label>{h('th_short_name')}</Label>
          <Input value={value.short_name ?? ''} onChangeText={(v) => onChange({ short_name: v || null })} placeholder={h('short_placeholder')} />
        </View>
      </View>
      <DateField label={h('th_grade_post_date')} value={value.post_end_date ?? ''} onChange={(v) => onChange({ post_end_date: v || null })} clearable />
    </View>
  );
}

function Editor({ initial }: { initial: HistoryMarkingPeriod[] }) {
  const { t } = useTranslation();
  const h = (k: string, o?: Record<string, unknown>) => t(`school.grades_module.history_marking_periods.${k}`, o);
  const toast = useToast();
  const { campusId } = useCampus();
  const res = useApi(['admin', 'history-mps', campusId ?? 'school'], () => adminHistoricalGrades.historyMarkingPeriods(campusId));
  const [rows, setRows] = useState<Row[]>(initial);
  const blank: Fields = { mp_type: 'quarter', name: '', short_name: null, post_end_date: null, school_year: '' };
  const [draft, setDraft] = useState<Fields>(blank);
  const [saving, setSaving] = useState(false);

  const update = (id: string, patch: Partial<Fields>) => setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch, _dirty: true } : r)));
  const remove = (r: Row) => setRows((prev) => (r._isNew ? prev.filter((x) => x.id !== r.id) : prev.map((x) => (x.id === r.id ? { ...x, _deleted: true } : x))));
  const add = () => {
    if (!draft.name.trim()) return toast.error(h('name_required'));
    setRows((prev) => [...prev, { ...draft, name: draft.name.trim(), short_name: draft.short_name?.trim() || null, id: `new-${Date.now()}`, _isNew: true, _dirty: true }]);
    setDraft(blank);
  };

  async function save() {
    if (rows.some((r) => !r._deleted && !r.name.trim())) return toast.error(h('name_required'));
    setSaving(true);
    let errors = 0;
    try {
      const body = (r: Row) => ({ mp_type: r.mp_type, name: r.name.trim(), short_name: r.short_name || null, post_end_date: r.post_end_date || null, school_year: r.school_year || '' });
      for (const r of rows.filter((x) => x._deleted && !x._isNew)) if (!(await adminHistoricalGrades.deleteHistoryMarkingPeriod(r.id)).success) errors++;
      for (const r of rows.filter((x) => x._isNew && !x._deleted)) if (!(await adminHistoricalGrades.createHistoryMarkingPeriod(body(r), campusId)).success) errors++;
      for (const r of rows.filter((x) => x._dirty && !x._isNew && !x._deleted)) if (!(await adminHistoricalGrades.updateHistoryMarkingPeriod(r.id, body(r))).success) errors++;
      if (errors) toast.error(h('toast_ops_failed', { count: errors }));
      else toast.success(h('toast_saved'));
      const fresh = await res.mutate();
      if (fresh) setRows(fresh);
    } catch {
      toast.error(h('toast_save_failed'));
    } finally {
      setSaving(false);
    }
  }

  const visible = rows.filter((r) => !r._deleted);
  const dirty = rows.some((r) => r._dirty || r._deleted || r._isNew);
  return (
    <>
      <View className="flex-row items-center gap-2">
        <Text className="text-muted-foreground flex-1 text-sm">{h('marking_periods_count', { count: visible.length })}</Text>
        <Button size="sm" onPress={save} disabled={!dirty || saving}>
          <Icon as={Save} className="text-primary-foreground size-4" />
          <Text>{t('school.grades_module.common.save')}</Text>
        </Button>
      </View>
      {visible.map((r) => (
        <Card key={r.id}>
          <CardContent className="gap-2 pt-4">
            <View className="flex-row items-center">
              <Text className="flex-1 font-semibold">{r.name || '—'}</Text>
              <Pressable onPress={() => remove(r)} hitSlop={8} className="p-1" accessibilityLabel={t('common.delete')}>
                <Icon as={Trash2} className="text-destructive size-4" />
              </Pressable>
            </View>
            <RowFields value={r} onChange={(p) => update(r.id, p)} />
          </CardContent>
        </Card>
      ))}
      <Card>
        <CardContent className="gap-3 pt-4">
          <RowFields value={draft} onChange={(p) => setDraft({ ...draft, ...p })} />
          <Button variant="outline" onPress={add}>
            <Icon as={Plus} className="text-foreground size-4" />
            <Text>{t('common.add')}</Text>
          </Button>
        </CardContent>
      </Card>
    </>
  );
}

/** Past marking periods (year / semester / quarter) used for historical grades (web: /admin/grades/history-marking-periods). */
export default function HistoryMarkingPeriods() {
  const { t } = useTranslation();
  const h = (k: string) => t(`school.grades_module.history_marking_periods.${k}`);
  const { campusId } = useCampus();
  const res = useApi(['admin', 'history-mps', campusId ?? 'school'], () => adminHistoricalGrades.historyMarkingPeriods(campusId));
  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: h('title') }} />
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerClassName="gap-3 p-4 pb-10" keyboardShouldPersistTaps="handled">
          <Text className="text-muted-foreground text-sm">{h('subtitle')}</Text>
          {res.isLoading ? (
            <LoadingList rows={3} />
          ) : res.error || !res.data ? (
            <ErrorState message={res.error?.message || h('toast_load_failed')} onRetry={() => res.mutate()} />
          ) : (
            <Editor key={campusId ?? 'school'} initial={res.data} />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
