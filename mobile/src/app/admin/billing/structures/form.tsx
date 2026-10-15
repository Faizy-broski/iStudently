import type { PeriodType } from '@studently/api-client';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Trash2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { useSWRConfig } from 'swr';

import { useConfirm } from '@/components/app/confirm';
import { FilterChips, MultiChips } from '@/components/app/filter-chips';
import { DateField } from '@/components/app/date-field';
import { Picker } from '@/components/app/picker';
import { Screen } from '@/components/app/screen';
import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { MULTI_INSTANCE_PERIODS, PERIOD_KEY, PERIOD_TYPES } from '@/features/admin/fees-shared';
import { useCampus } from '@/features/campus/campus';
import { adminAcademics, adminFees } from '@/lib/api';
import { useApi } from '@/lib/data';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Add (one row per selected grade, like the web) or edit a fee structure. */
export default function FeeStructureForm() {
  const { t } = useTranslation();
  const s = (k: string) => t(`fees.structures.${k}`);
  const toast = useToast();
  const confirm = useConfirm();
  const { mutate } = useSWRConfig();
  const { year, id } = useLocalSearchParams<{ year: string; id?: string }>();
  const editing = !!id;
  const { campusId, scopeId } = useCampus();
  const grades = useApi(['admin', 'grades', campusId ?? 'school'], () => adminAcademics.grades(campusId));
  const categories = useApi(scopeId ? ['admin', 'fee-categories', scopeId] : null, ([, , sid]) => adminFees.categories(sid as string));
  const existingList = useApi(scopeId && editing ? ['admin', 'fee-structures', scopeId, year] : null, ([, , sid, y]) => adminFees.structures(sid as string, y as string));
  const existing = existingList.data?.find((x) => x.id === id);

  const [gradeIds, setGradeIds] = useState<string[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [periodType, setPeriodType] = useState<PeriodType>('monthly');
  const [periodNumber, setPeriodNumber] = useState('');
  const [periodName, setPeriodName] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!existing) return;
    setGradeIds([existing.grade_level_id]);
    setCategoryId(existing.fee_category_id);
    setPeriodType(existing.period_type);
    setPeriodNumber(existing.period_number ? String(existing.period_number) : '');
    setPeriodName(existing.period_name ?? '');
    setAmount(String(existing.amount));
    setDueDate(existing.due_date?.slice(0, 10) ?? '');
  }, [existing]);

  const refresh = () => mutate((k) => Array.isArray(k) && k[0] === 'admin' && k[1] === 'fee-structures');

  async function save() {
    const amt = parseFloat(amount);
    if (gradeIds.length === 0 || !categoryId || !(amt >= 0) || !amount || !DATE.test(dueDate)) return toast.error(s('fillRequired'));
    const multi = MULTI_INSTANCE_PERIODS.includes(periodType);
    if (multi && !periodNumber) return toast.error(s('periodNumberRequired'));
    const base = {
      academic_year: year,
      fee_category_id: categoryId,
      period_type: periodType,
      period_name: periodType === 'monthly' ? null : periodName.trim() || null,
      period_number: multi ? parseInt(periodNumber, 10) : null,
      amount: amt,
      due_date: dueDate,
    };
    setBusy(true);
    const results = editing
      ? [await adminFees.updateStructure(scopeId!, id!, { ...base, grade_level_id: gradeIds[0] })]
      : await Promise.all(gradeIds.map((g) => adminFees.createStructure(scopeId!, { ...base, grade_level_id: g })));
    setBusy(false);
    const failed = results.filter((r) => !r.success);
    if (failed.length) return toast.error(failed[0].error || t('app.error_title'));
    refresh();
    if (editing) {
      toast.success(s('updateSuccess'));
      return router.back();
    }
    // A structure is only a template: nothing is billed until fees are generated (web: toast with a Generate action).
    const go = await confirm({ title: s('createSuccess'), body: s('createSuccessGenerateHint'), confirmLabel: s('generateFeesAction') });
    if (go) router.replace({ pathname: '/admin/billing/generate', params: { grades: gradeIds.join(',') } });
    else router.back();
  }

  if (editing && existingList.isLoading) return <LoadingList rows={5} />;

  return (
    <>
      <Stack.Screen options={{ title: editing ? s('editStructure') : s('addStructure') }} />
      <Screen scroll edges={['bottom']}>
        <Text variant="muted">{`${s('academicYear')}: ${year}`}</Text>
        <View className="gap-1.5">
          <Label>{s('selectGrade')}</Label>
          {editing ? (
            <Picker value={gradeIds[0] ?? ''} onChange={(v) => setGradeIds([v])} options={(grades.data ?? []).map((g) => ({ value: g.id, label: g.name }))} />
          ) : (
            <>
              {(grades.data?.length ?? 0) > 0 ? (
                <Pressable
                  onPress={() => setGradeIds(gradeIds.length === (grades.data ?? []).length ? [] : (grades.data ?? []).map((g) => g.id))}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: gradeIds.length === (grades.data ?? []).length }}
                  className="flex-row items-center gap-2 py-1">
                  <Checkbox checked={gradeIds.length === (grades.data ?? []).length} onCheckedChange={() => setGradeIds(gradeIds.length === (grades.data ?? []).length ? [] : (grades.data ?? []).map((g) => g.id))} />
                  <Text className="text-sm font-medium">{s('selectAll')}</Text>
                </Pressable>
              ) : (
                <Text className="text-muted-foreground text-sm">{s('notAvailable')}</Text>
              )}
              <MultiChips<string> value={gradeIds} onChange={setGradeIds} options={(grades.data ?? []).map((g) => ({ value: g.id, label: g.name }))} />
              <Text className="text-muted-foreground text-xs">{s('selectMultipleGradesHint')}</Text>
            </>
          )}
        </View>
        <View className="gap-1.5">
          <Label>{s('selectCategory')}</Label>
          <Picker value={categoryId} onChange={setCategoryId} options={(categories.data ?? []).filter((c) => c.is_active).map((c) => ({ value: c.id, label: `${c.name} (${c.code})` }))} />
        </View>
        <View className="gap-1.5">
          <Label>{s('periodType')}</Label>
          <FilterChips<PeriodType> value={periodType} onChange={setPeriodType} options={PERIOD_TYPES.map((p) => ({ value: p, label: s(PERIOD_KEY[p]) }))} />
        </View>
        {MULTI_INSTANCE_PERIODS.includes(periodType) ? (
          <View className="gap-1.5">
            <Label>{s('periodNumber')}</Label>
            <Input value={periodNumber} onChangeText={(v) => setPeriodNumber(v.replace(/\D/g, ''))} keyboardType="number-pad" placeholder="1" />
            <Text className="text-muted-foreground text-xs">{s('periodNumberHint')}</Text>
          </View>
        ) : null}
        {periodType !== 'monthly' ? (
          <View className="gap-1.5">
            <Label>{s('periodName')}</Label>
            <Input value={periodName} onChangeText={setPeriodName} placeholder={s('periodNamePlaceholder')} />
            <Text className="text-muted-foreground text-xs">{s('periodNameHint')}</Text>
          </View>
        ) : null}
        <View className="gap-1.5">
          <Label>{t('fees.payments.th_amount')}</Label>
          <Input value={amount} onChangeText={(v) => setAmount(v.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" placeholder="0.00" />
        </View>
        <View className="gap-1.5">
          <Label>{t('app.fe_due_date')}</Label>
          <DateField value={dueDate} onChange={(v) => setDueDate(v ?? '')} />
        </View>
        <Button onPress={save} disabled={busy || !scopeId}>
          <Text>{t('app.bl_save')}</Text>
        </Button>
        {editing ? (
          <Button
            variant="ghost"
            onPress={async () => {
              if (!(await confirm({ title: t('app.fe_delete_structure'), destructive: true, confirmLabel: t('app.bl_delete') }))) return;
              const res = await adminFees.deleteStructure(scopeId!, id!);
              if (!res.success) return toast.error(res.error || t('app.error_title'));
              refresh();
              router.back();
            }}>
            <Icon as={Trash2} className="text-destructive size-4" />
            <Text className="text-destructive">{t('app.bl_delete')}</Text>
          </Button>
        ) : null}
      </Screen>
    </>
  );
}
