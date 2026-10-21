import type { DisciplineField, DisciplineFieldType, DisciplineTargetType } from '@studently/api-client';
import { Stack } from 'expo-router';
import { Info, ListChecks, Minus, Plus, TrendingDown, TrendingUp } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { DataList } from '@/components/app/data-list';
import { FilterChips } from '@/components/app/filter-chips';
import { Picker } from '@/components/app/picker';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { useAttendanceScope } from '@/features/admin/attendance';
import { PointsBadge } from '@/features/admin/discipline';
import { IconTile, RowActions, RowPill } from '@/components/app/layout';
import { adminDiscipline } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

const TARGETS: DisciplineTargetType[] = ['student', 'teacher', 'staff'];
const TYPES: DisciplineFieldType[] = ['select', 'multiple_radio', 'multiple_checkbox', 'text', 'textarea', 'checkbox', 'numeric', 'date'];
const WITH_OPTIONS: DisciplineFieldType[] = ['select', 'multiple_radio', 'multiple_checkbox'];
const TYPE_CLS: Record<DisciplineFieldType, string> = {
  select: 'bg-info-soft text-brand dark:text-brand-secondary',
  multiple_radio: 'bg-chart-6/10 text-chart-6',
  multiple_checkbox: 'bg-info-soft text-brand dark:text-brand-secondary',
  text: 'bg-muted text-muted-foreground',
  textarea: 'bg-muted text-muted-foreground',
  checkbox: 'bg-success-soft text-success',
  numeric: 'bg-warning-soft text-warning',
  date: 'bg-info-soft text-brand dark:text-brand-secondary',
};

interface FormState {
  name: string;
  field_type: DisciplineFieldType;
  options_text: string;
  penalty: string;
  penaltySign: '+' | '-';
  sort_order: string;
}
const emptyForm = (): FormState => ({ name: '', field_type: 'text', options_text: '', penalty: '', penaltySign: '-', sort_order: '0' });

/** Referral form builder: custom fields per target type (web: /admin/discipline/referral-form). */
export default function ReferralFormBuilder() {
  const { t } = useTranslation();
  const d = (k: string, o?: Record<string, unknown>) => t(`discipline.${k}`, o);
  const toast = useToast();
  const { schoolId } = useAttendanceScope();
  const [target, setTarget] = useState<DisciplineTargetType>('student');
  const [editing, setEditing] = useState<DisciplineField | 'new' | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const list = useApi(schoolId ? ['admin', 'discipline-fields-all', schoolId, target] : null, ([, , , tt]) => adminDiscipline.getFields(schoolId, tt as DisciplineTargetType, true));

  const openEdit = (f: DisciplineField) => {
    const pts = f.penalty_points;
    setForm({ name: f.name, field_type: f.field_type, options_text: (f.options ?? []).join('\n'), penalty: pts != null ? String(Math.abs(pts)) : '', penaltySign: pts != null && pts > 0 ? '+' : '-', sort_order: String(f.sort_order) });
    setEditing(f);
  };
  const options = () => {
    if (!WITH_OPTIONS.includes(form.field_type)) return null;
    const lines = form.options_text.split('\n').map((l) => l.trim()).filter(Boolean);
    return lines.length ? lines : null;
  };
  const penalty = () => {
    const m = parseFloat(form.penalty) || 0;
    return m <= 0 ? null : form.penaltySign === '-' ? -m : m;
  };

  async function save() {
    if (!form.name.trim()) return toast.error(d('validation.fieldNameRequired'));
    setSaving(true);
    try {
      const body = { name: form.name.trim(), field_type: form.field_type, options: options(), sort_order: parseInt(form.sort_order, 10) || 0, penalty_points: penalty() };
      const res = editing === 'new' ? await adminDiscipline.createField({ ...body, school_id: schoolId, target_type: target }) : await adminDiscipline.updateField((editing as DisciplineField).id, body);
      if (!res.success) return toast.error(res.error || d(editing === 'new' ? 'errors.addField' : 'errors.updateField'));
      toast.success(d(editing === 'new' ? 'toasts.fieldAdded' : 'toasts.fieldUpdated'));
      setEditing(null);
      list.mutate();
    } finally {
      setSaving(false);
    }
  }

  async function remove(f: DisciplineField) {
    const res = await adminDiscipline.deleteField(f.id);
    if (!res.success) return toast.error(res.error || d('errors.deleteField'));
    toast.success(d('toasts.fieldDeletedWithName', { name: f.name }));
    list.mutate();
  }

  async function toggleActive(f: DisciplineField) {
    const res = await adminDiscipline.updateField(f.id, { is_active: !f.is_active });
    if (!res.success) return toast.error(res.error || d('errors.updateField'));
    list.mutate();
  }

  const step = (delta: number) => setForm((f) => ({ ...f, penalty: String(Math.max(0, parseInt(f.penalty || '0', 10) + delta)) }));

  return (
    <>
      <Stack.Screen options={{ title: d('referralForm') }} />
      <View className="bg-background flex-1">
        <DataList
          header={
            <View className="gap-3 p-4">
              <Text variant="muted">{d('referralFormSubtitle')}</Text>
              <Button
                onPress={() => {
                  setForm(emptyForm());
                  setEditing('new');
                }}>
                <Icon as={Plus} className="text-primary-foreground size-4" />
                <Text>{d('addField')}</Text>
              </Button>
              <FilterChips<DisciplineTargetType> value={target} onChange={setTarget} options={TARGETS.map((x) => ({ value: x, label: d(`targetTypes.${x}`) }))} />
              <View className="border-info-soft dark:border-border flex-row gap-2 rounded-xl border p-3">
                <Icon as={Info} className="text-muted-foreground size-4" />
                <Text className="flex-1 text-sm">{d('fieldsInfo')}</Text>
              </View>
            </View>
          }
          items={list.data}
          error={list.error}
          isLoading={list.isLoading}
          onRefresh={() => list.mutate()}
          emptyTitle={`${d('noFieldsConfigured')} ${d('addField')} ${d('toGetStarted')}`}
          keyExtractor={(f) => f.id}
          renderItem={(f) => (
            <View className={cn('gap-1.5 px-4 py-3', !f.is_active && 'opacity-60')}>
              <View className="flex-row flex-wrap items-center gap-2">
                <IconTile icon={ListChecks} tone={f.is_active ? 'brand' : 'muted'} size={32} />
                <Text className="text-sm font-semibold">{f.name}</Text>
                <View className={cn('rounded-full px-2 py-0.5', TYPE_CLS[f.field_type])}>
                  <Text className={cn('text-xs', TYPE_CLS[f.field_type].split(' ')[1])}>{d(`fieldTypes.${f.field_type}`)}</Text>
                </View>
                {f.penalty_points != null ? <PointsBadge pts={f.penalty_points} /> : null}
                {!f.is_active ? (
                  <View className="rounded-full bg-muted px-2 py-0.5">
                    <Text className="text-xs text-muted-foreground">{d('inactive')}</Text>
                  </View>
                ) : null}
              </View>
              {f.options?.length ? <Text className="text-muted-foreground text-xs" numberOfLines={2}>{`${d('options')}: ${f.options.join(', ')}`}</Text> : null}
              <Text className="text-muted-foreground text-xs">{`${d('sort_order')}: ${f.sort_order}`}</Text>
              <RowActions onEdit={() => openEdit(f)} onDelete={() => remove(f)}>
                <RowPill label={f.is_active ? d('disable') : d('enable')} tone={f.is_active ? 'muted' : 'success'} onPress={() => toggleActive(f)} />
              </RowActions>
            </View>
          )}
        />
      </View>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90%] w-[94vw] max-w-md">
          <DialogHeader>
            <DialogTitle>{editing === 'new' ? d('addReferralFormField') : d('editField')}</DialogTitle>
          </DialogHeader>
          <ScrollView contentContainerClassName="gap-4" keyboardShouldPersistTaps="handled">
            <View className="gap-1.5">
              <Label>{`${d('titleLabel')} *`}</Label>
              <Input value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} placeholder={d('titlePlaceholder')} />
            </View>
            <View className="gap-1.5">
              <Label>{d('dataType')}</Label>
              <Picker value={form.field_type} onChange={(v) => setForm({ ...form, field_type: v as DisciplineFieldType })} options={TYPES.map((x) => ({ value: x, label: d(`fieldTypes.${x}`) }))} />
            </View>
            {WITH_OPTIONS.includes(form.field_type) ? (
              <>
                <View className="gap-1.5">
                  <Label>{`${d('options')} (${d('onePerLine')})`}</Label>
                  <Textarea value={form.options_text} onChangeText={(v) => setForm({ ...form, options_text: v })} placeholder={'Skipping Class\nFighting\nInsubordination\nOther'} className="min-h-28" />
                </View>
                <View className={cn('gap-2 rounded-lg border p-3', form.penaltySign === '+' ? 'border-success/30 bg-success-soft' : 'border-destructive/30 bg-destructive-soft')}>
                  <View className="flex-row items-center gap-1.5">
                    <Icon as={form.penaltySign === '+' ? TrendingUp : TrendingDown} className={cn('size-4', form.penaltySign === '+' ? 'text-success' : 'text-destructive')} />
                    <Text className={cn('text-sm font-medium', form.penaltySign === '+' ? 'text-success' : 'text-destructive')}>{t('app.dc_point_impact_optional')}</Text>
                  </View>
                  <Text className="text-muted-foreground text-xs">{t('app.dc_point_impact_hint')}</Text>
                  <View className="flex-row flex-wrap items-center gap-2">
                    <Button size="sm" variant={form.penaltySign === '-' ? 'destructive' : 'outline'} onPress={() => setForm({ ...form, penaltySign: '-' })}>
                      <Text>{`− ${t('app.dc_deduct')}`}</Text>
                    </Button>
                    <Button size="sm" variant="outline" className={form.penaltySign === '+' ? 'border-success bg-success' : undefined} onPress={() => setForm({ ...form, penaltySign: '+' })}>
                      <Text className={form.penaltySign === '+' ? 'text-white' : undefined}>{`+ ${t('app.dc_add_points')}`}</Text>
                    </Button>
                    <View className="flex-row items-center">
                      <Pressable onPress={() => step(-1)} className="border-input rounded-s-md border p-2" accessibilityLabel={t('common.remove')}>
                        <Icon as={Minus} className="text-foreground size-3" />
                      </Pressable>
                      <Input value={form.penalty} onChangeText={(v) => setForm({ ...form, penalty: v.replace(/[^0-9.]/g, '') })} keyboardType="decimal-pad" placeholder="0" className="h-8 w-14 rounded-none text-center" />
                      <Pressable onPress={() => step(1)} className="border-input rounded-e-md border p-2" accessibilityLabel={t('common.add')}>
                        <Icon as={Plus} className="text-foreground size-3" />
                      </Pressable>
                    </View>
                    <Text className="text-muted-foreground text-xs">{t('app.dc_pts_per_selection')}</Text>
                  </View>
                </View>
              </>
            ) : null}
            <View className="gap-1.5">
              <Label>{d('sort_order')}</Label>
              <Input value={form.sort_order} onChangeText={(v) => setForm({ ...form, sort_order: v.replace(/[^0-9-]/g, '') })} keyboardType="number-pad" className="w-24" />
            </View>
          </ScrollView>
          <DialogFooter>
            <Button variant="outline" onPress={() => setEditing(null)}>
              <Text>{d('cancel')}</Text>
            </Button>
            <Button onPress={save} disabled={saving}>
              <Text>{editing === 'new' ? d('addField') : d('saveChanges')}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
